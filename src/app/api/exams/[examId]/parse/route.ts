import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON, EXAM_PARSE_SCHEMA, MODELS_PRO } from '@/lib/ai/client';
import { EXAM_PARSE_SYSTEM_PROMPT } from '@/lib/claude/prompts/exam-parse';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, readdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';
import mammoth from 'mammoth';

const execAsync = promisify(exec);

type FileCategory = 'pdf' | 'image' | 'document';

function getFileCategory(filePath: string): FileCategory {
  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext)) return 'image';
  return 'document'; // hwp, doc, docx
}

function getMimeType(ext: string): string {
  const map: Record<string, string> = {
    pdf: 'application/pdf',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    heic: 'image/jpeg', // 변환 후
    heif: 'image/jpeg',
    hwp: 'application/pdf', // 변환 후
    doc: 'application/pdf',
    docx: 'application/pdf',
  };
  return map[ext] || 'application/octet-stream';
}

/**
 * HEIC/HEIF → JPEG 변환 (sharp 사용)
 */
async function convertHeicToJpeg(buffer: Buffer): Promise<Buffer> {
  try {
    return Buffer.from(await sharp(buffer).jpeg({ quality: 95 }).toBuffer());
  } catch {
    // Vercel의 sharp에 HEIC 디코더 없음 — 클라이언트에서 이미 변환됐어야 함
    throw new Error('HEIC 파일은 지원되지 않습니다. JPG/PNG로 변환 후 업로드해주세요.');
  }
}

/**
 * 이미지 최적화: OCR 정확도 최대화를 위해 고해상도 + 선명하게 처리
 */
async function optimizeForOCR(buffer: Buffer): Promise<Buffer> {
  return Buffer.from(
    await sharp(buffer)
      .resize({ width: 3000, withoutEnlargement: true }) // 최대 3000px 폭
      .sharpen({ sigma: 1.5 }) // 선명하게
      .normalize() // 대비 최적화
      .jpeg({ quality: 95 })
      .toBuffer()
  );
}

/**
 * PDF 각 페이지를 PNG 이미지로 변환 (pdftoppm 사용)
 * 300 DPI로 OCR 품질 최대화
 */
async function pdfToPageImages(pdfBuffer: Buffer): Promise<{ page: number; buffer: Buffer }[]> {
  const tempDir = await mkdtemp(join(tmpdir(), 'nonsul-pdf-'));
  const pdfPath = join(tempDir, 'input.pdf');
  const outPrefix = join(tempDir, 'page');

  try {
    await writeFile(pdfPath, pdfBuffer);
    // 300 DPI로 향상 (기존 200 → 300): OCR 정확도 크게 향상
    await execAsync(`pdftoppm -png -r 300 "${pdfPath}" "${outPrefix}"`);

    const files = await readdir(tempDir);
    const pageFiles = files
      .filter((f) => f.startsWith('page-') && f.endsWith('.png'))
      .sort();

    const images: { page: number; buffer: Buffer }[] = [];
    for (let i = 0; i < pageFiles.length; i++) {
      const buf = await readFile(join(tempDir, pageFiles[i]));
      images.push({ page: i + 1, buffer: buf });
    }

    return images;
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

/**
 * DOCX → 텍스트 추출 (mammoth 사용, Vercel 호환)
 */
async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  if (!result.value || result.value.trim().length === 0) {
    throw new Error('DOCX에서 텍스트를 추출할 수 없습니다.');
  }
  return result.value;
}

/**
 * HWP → 텍스트 추출 (hwp.js 사용, Vercel 호환)
 */
async function extractHwpText(buffer: Buffer): Promise<string> {
  try {
    const hwpjs = await import('hwp.js');
    const parsed = hwpjs.parse(buffer);
    const texts: string[] = [];

    // hwp.js parse 결과에서 텍스트 추출
    function walkNode(node: any) {
      if (!node) return;
      if (typeof node === 'string') { texts.push(node); return; }
      if (node.text) texts.push(node.text);
      if (node.content) texts.push(node.content);
      if (node.children) {
        for (const child of node.children) walkNode(child);
      }
      if (Array.isArray(node)) {
        for (const item of node) walkNode(item);
      }
    }

    walkNode(parsed);

    if (texts.length === 0) {
      throw new Error('HWP 텍스트 추출 실패');
    }
    return texts.join('\n');
  } catch {
    throw new Error(
      'HWP 파일 텍스트 추출에 실패했습니다. PDF로 변환 후 다시 업로드해주세요.'
    );
  }
}

/**
 * 문서(DOCX/HWP/DOC) 텍스트 추출
 */
async function extractDocText(buffer: Buffer, ext: string): Promise<string> {
  if (ext === 'docx') {
    return extractDocxText(buffer);
  }
  if (ext === 'hwp') {
    return extractHwpText(buffer);
  }
  if (ext === 'doc') {
    throw new Error('DOC(구형 Word) 파일은 지원되지 않습니다. DOCX 또는 PDF로 변환 후 업로드해주세요.');
  }
  throw new Error(`지원하지 않는 파일 형식: ${ext}`);
}

/**
 * OCR 최적화 프롬프트
 */
const OCR_ENHANCED_PROMPT = `이 시험지의 모든 제시문과 문제를 빠짐없이 추출해주세요.

## OCR 지침 (정확도 최우선)
- 한 글자도 빠뜨리지 말고 원문 그대로 추출
- 비슷한 글자 주의: 가/기, 은/운, 를/를, 의/외, 대/내, 해/혜
- 띄어쓰기와 문장부호 원문 그대로 유지
- 괄호 안 내용 정확히: (가), (나), ①, ②
- 한자 병기 있으면 그대로 포함
- 표/그래프가 있으면 has_table/has_graph=true, table_markdown에 정확한 markdown 표 작성
- 읽기 어려운 부분은 [판독불가]로 표시
- page_number는 이미지 순서 (1부터 시작)

JSON만 반환하세요.`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (error || !exam) {
    return NextResponse.json({ error: '시험을 찾을 수 없습니다' }, { status: 404 });
  }

  await supabase.from('exams').update({ status: 'parsing' }).eq('id', examId);

  try {
    // 다중 파일 여부 확인
    const multiFiles: { path: string; url: string; original_name: string }[] =
      exam.parsed_metadata?.multi_files || [];

    // 파일 경로 목록: 다중이면 multi_files, 단일이면 original_pdf_path
    const filePaths = multiFiles.length > 0
      ? multiFiles.map((f: any) => f.path)
      : [exam.original_pdf_path as string];

    // 모든 파일 다운로드
    const downloadedFiles: { buffer: Buffer; path: string; ext: string; category: FileCategory }[] = [];
    for (const fp of filePaths) {
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('exam-pdfs')
        .download(fp);
      if (downloadError || !fileData) throw new Error(`파일 다운로드 실패: ${fp}`);
      const ext = fp.split('.').pop()?.toLowerCase() || 'pdf';
      downloadedFiles.push({
        buffer: Buffer.from(await fileData.arrayBuffer()),
        path: fp,
        ext,
        category: getFileCategory(fp),
      });
    }

    let parsed: any;
    let pageImageUrls: Record<number, string> = {};
    const firstExt = downloadedFiles[0].ext;
    const firstCategory = downloadedFiles[0].category;

    // ── 다중 이미지 파일: 모두 OCR 최적화해서 한번에 Gemini에 전달 ──
    const allImages = downloadedFiles.filter((f) => f.category === 'image');
    const allPdfs = downloadedFiles.filter((f) => f.category === 'pdf');
    const allDocs = downloadedFiles.filter((f) => f.category === 'document');

    if (allImages.length > 0 && allPdfs.length === 0 && allDocs.length === 0) {
      // 전부 이미지: 여러 장을 한번에 OCR
      const images: { base64: string; mimeType: string }[] = [];

      for (let i = 0; i < allImages.length; i++) {
        const f = allImages[i];
        const isHeic = f.ext === 'heic' || f.ext === 'heif';

        if (isHeic) {
          // HEIC: sharp 변환 불가 (Vercel), Gemini에 raw로 전달
          images.push({ base64: f.buffer.toString('base64'), mimeType: 'image/heic' });
          // 페이지 이미지는 원본 저장
          const imgFileName = `exam-pages/${examId}/page_${i + 1}.heic`;
          await supabase.storage
            .from('exam-pdfs')
            .upload(imgFileName, f.buffer, { contentType: 'image/heic', upsert: true });
          const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(imgFileName);
          pageImageUrls[i + 1] = urlData?.publicUrl || '';
        } else {
          const imageBuffer = await optimizeForOCR(f.buffer);
          images.push({ base64: imageBuffer.toString('base64'), mimeType: 'image/jpeg' });
          const imgFileName = `exam-pages/${examId}/page_${i + 1}.png`;
          await supabase.storage
            .from('exam-pdfs')
            .upload(imgFileName, imageBuffer, { contentType: 'image/jpeg', upsert: true });
          const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(imgFileName);
          pageImageUrls[i + 1] = urlData?.publicUrl || '';
        }
      }

      const pageCount = images.length;
      parsed = await generateJSON({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: `이 시험지는 총 ${pageCount}장의 이미지입니다. ` + OCR_ENHANCED_PROMPT,
        images,
        responseSchema: EXAM_PARSE_SCHEMA,
        models: MODELS_PRO,
      });

    } else if (allPdfs.length === 1 && allImages.length === 0 && allDocs.length === 0) {
      // 단일 PDF
      const rawBuffer = allPdfs[0].buffer;
      const base64 = rawBuffer.toString('base64');

      parsed = await generateJSON({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: OCR_ENHANCED_PROMPT,
        pdfBase64: base64,
        responseSchema: EXAM_PARSE_SCHEMA,
        models: MODELS_PRO,
      });

      try {
        const pageImages = await pdfToPageImages(rawBuffer);
        for (const img of pageImages) {
          const fileName = `exam-pages/${examId}/page_${img.page}.png`;
          const { error: uploadErr } = await supabase.storage
            .from('exam-pdfs')
            .upload(fileName, img.buffer, { contentType: 'image/png', upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(fileName);
            pageImageUrls[img.page] = urlData?.publicUrl || '';
          }
        }
      } catch (imgErr) {
        console.error('PDF 페이지 이미지 변환 실패:', imgErr);
      }

    } else if (allDocs.length > 0 && allImages.length === 0 && allPdfs.length === 0) {
      // 문서(HWP/DOCX): 텍스트 직접 추출 → Gemini에 텍스트로 전달 (OCR 불필요)
      const docText = await extractDocText(allDocs[0].buffer, allDocs[0].ext);

      parsed = await generateJSON({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: `아래는 시험지 원문 텍스트입니다. 제시문과 문제를 구조화하여 JSON으로 반환하세요.\n\n## 지침\n- 원문 텍스트를 그대로 사용 (수정 금지)\n- 제시문 라벨: (가), (나), (다) 등\n- 문제 번호, 배점, 자수 정확히 추출\n- 표/그래프가 텍스트로 표현되어 있으면 table_markdown에 포함\n\nJSON만 반환하세요.\n\n## 원문\n${docText}`,
        responseSchema: EXAM_PARSE_SCHEMA,
        models: MODELS_PRO,
      });

    } else {
      // 혼합 파일: 이미지와 PDF를 모두 이미지로 변환해서 합침
      const images: { base64: string; mimeType: string }[] = [];
      let pageIdx = 1;

      for (const f of downloadedFiles) {
        if (f.category === 'image') {
          const isHeic = f.ext === 'heic' || f.ext === 'heif';
          if (isHeic) {
            images.push({ base64: f.buffer.toString('base64'), mimeType: 'image/heic' });
            const imgFileName = `exam-pages/${examId}/page_${pageIdx}.heic`;
            await supabase.storage
              .from('exam-pdfs')
              .upload(imgFileName, f.buffer, { contentType: 'image/heic', upsert: true });
            const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(imgFileName);
            pageImageUrls[pageIdx] = urlData?.publicUrl || '';
          } else {
            const imageBuffer = await optimizeForOCR(f.buffer);
            images.push({ base64: imageBuffer.toString('base64'), mimeType: 'image/jpeg' });
            const imgFileName = `exam-pages/${examId}/page_${pageIdx}.png`;
            await supabase.storage
              .from('exam-pdfs')
              .upload(imgFileName, imageBuffer, { contentType: 'image/jpeg', upsert: true });
            const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(imgFileName);
            pageImageUrls[pageIdx] = urlData?.publicUrl || '';
          }
          pageIdx++;
        } else if (f.category === 'pdf') {
          try {
            const pageImgs = await pdfToPageImages(f.buffer);
            for (const img of pageImgs) {
              const optimized = await optimizeForOCR(img.buffer);
              images.push({ base64: optimized.toString('base64'), mimeType: 'image/jpeg' });

              const imgFileName = `exam-pages/${examId}/page_${pageIdx}.png`;
              await supabase.storage
                .from('exam-pdfs')
                .upload(imgFileName, optimized, { contentType: 'image/jpeg', upsert: true });
              const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(imgFileName);
              pageImageUrls[pageIdx] = urlData?.publicUrl || '';
              pageIdx++;
            }
          } catch {
            // PDF→이미지 변환 실패 시 PDF 직접 전달은 혼합에서 불가, skip
          }
        }
      }

      parsed = await generateJSON({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: `이 시험지는 총 ${images.length}장의 이미지입니다. ` + OCR_ENHANCED_PROMPT,
        images,
        responseSchema: EXAM_PARSE_SCHEMA,
        models: MODELS_PRO,
      });
    }

    // 제시문에 페이지 이미지 URL 매핑
    const passages = (parsed.passages || []).map((p: any) => ({
      ...p,
      page_image_url: p.page_number ? pageImageUrls[p.page_number] || null : null,
    }));

    // ★표/그래프 크롭 — figures.bbox(정규화)로 페이지 이미지에서 표 영역만 잘라 저장
    //   텍스트로 뜯어 깨지는 것 대신 원본 크롭 이미지로 렌더하기 위함.
    const pageBufCache: Record<number, Buffer | null> = {};
    async function getPageBuf(page: number): Promise<Buffer | null> {
      if (page in pageBufCache) return pageBufCache[page];
      const url = pageImageUrls[page];
      if (!url) return (pageBufCache[page] = null);
      try {
        const resp = await fetch(url);
        const buf = Buffer.from(await resp.arrayBuffer());
        return (pageBufCache[page] = buf);
      } catch {
        return (pageBufCache[page] = null);
      }
    }
    for (const p of passages) {
      if (!Array.isArray(p.figures) || !p.figures.length) continue;
      for (let fi = 0; fi < p.figures.length; fi++) {
        const fig = p.figures[fi];
        const page = fig.page_number || p.page_number;
        if (!page || !fig.bbox) continue;
        const pageBuf = await getPageBuf(page);
        if (!pageBuf) continue;
        try {
          const meta = await sharp(pageBuf).metadata();
          const W = meta.width || 0, H = meta.height || 0;
          if (!W || !H) continue;
          // bbox에 약간 여유(padding) — 제목·범례 잘림 방지
          const pad = 0.01;
          const left = Math.max(0, Math.round((fig.bbox.x - pad) * W));
          const top = Math.max(0, Math.round((fig.bbox.y - pad) * H));
          const width = Math.min(W - left, Math.round((fig.bbox.w + pad * 2) * W));
          const height = Math.min(H - top, Math.round((fig.bbox.h + pad * 2) * H));
          if (width < 10 || height < 10) continue;
          const crop = await sharp(pageBuf).extract({ left, top, width, height }).png().toBuffer();
          const safeLabel = String(p.label || 'p').replace(/[^0-9A-Za-z가-힣]/g, '');
          const fname = `exam-figures/${examId}/page${page}_${safeLabel}_${fi}.png`;
          const { error: cropErr } = await supabase.storage
            .from('exam-pdfs')
            .upload(fname, crop, { contentType: 'image/png', upsert: true });
          if (!cropErr) {
            const { data: u } = supabase.storage.from('exam-pdfs').getPublicUrl(fname);
            fig.url = u?.publicUrl || undefined;
          }
        } catch (e) {
          console.error(`figure 크롭 실패 (${p.label} #${fi}):`, e);
        }
      }
    }

    const { error: updateError } = await supabase
      .from('exams')
      .update({
        parsed_passages: passages,
        parsed_questions: parsed.questions,
        parsed_metadata: {
          ...(exam.parsed_metadata || {}),
          ...(parsed.metadata || {}),
          page_image_urls: pageImageUrls,
          original_format: firstExt,
          file_count: downloadedFiles.length,
        },
        status: 'parsed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      passages: passages.length,
      questions: (parsed.questions || []).length,
      pageImages: Object.keys(pageImageUrls).length,
      fileCount: downloadedFiles.length,
    });
  } catch (err) {
    await supabase.from('exams').update({ status: 'error' }).eq('id', examId);
    const message = err instanceof Error ? err.message : '파싱 중 오류 발생';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
