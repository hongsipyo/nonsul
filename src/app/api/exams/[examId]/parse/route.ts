import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON, EXAM_PARSE_SCHEMA } from '@/lib/ai/client';
import { EXAM_PARSE_SYSTEM_PROMPT } from '@/lib/claude/prompts/exam-parse';
import { exec } from 'child_process';
import { promisify } from 'util';
import { writeFile, readFile, readdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import sharp from 'sharp';

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
  return Buffer.from(await sharp(buffer).jpeg({ quality: 95 }).toBuffer());
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
 * HWP/DOC/DOCX → PDF 변환 (LibreOffice 사용)
 * LibreOffice 없으면 에러 throw
 */
async function convertDocToPdf(buffer: Buffer, ext: string): Promise<Buffer> {
  const tempDir = await mkdtemp(join(tmpdir(), 'nonsul-doc-'));
  const inputPath = join(tempDir, `input.${ext}`);

  try {
    await writeFile(inputPath, buffer);

    // LibreOffice 경로 탐색
    const loPaths = [
      'libreoffice',
      '/Applications/LibreOffice.app/Contents/MacOS/soffice',
      '/usr/bin/libreoffice',
      'soffice',
    ];

    let converted = false;
    for (const loPath of loPaths) {
      try {
        await execAsync(
          `"${loPath}" --headless --convert-to pdf --outdir "${tempDir}" "${inputPath}"`,
          { timeout: 60000 }
        );
        converted = true;
        break;
      } catch {
        continue;
      }
    }

    if (!converted) {
      throw new Error(
        'HWP/Word 파일 변환을 위해 LibreOffice가 필요합니다. ' +
        'PDF로 변환 후 다시 업로드해주세요.'
      );
    }

    const pdfPath = join(tempDir, 'input.pdf');
    return readFile(pdfPath);
  } finally {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
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
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('exam-pdfs')
      .download(exam.original_pdf_path);

    if (downloadError || !fileData) throw new Error('파일 다운로드 실패');

    const rawBuffer = Buffer.from(await fileData.arrayBuffer());
    const filePath = exam.original_pdf_path as string;
    const ext = filePath.split('.').pop()?.toLowerCase() || 'pdf';
    const category = getFileCategory(filePath);

    let parsed: any;
    let pageImageUrls: Record<number, string> = {};

    if (category === 'pdf') {
      // ── PDF: 기존 방식 + OCR 강화 프롬프트 ──
      const base64 = rawBuffer.toString('base64');

      parsed = await generateJSON({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: OCR_ENHANCED_PROMPT,
        pdfBase64: base64,
        responseSchema: EXAM_PARSE_SCHEMA,
      });

      // 페이지 이미지 생성 (300 DPI)
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

    } else if (category === 'image') {
      // ── 이미지(JPG/JPEG/PNG/HEIC): OCR 최적화 후 Gemini에 이미지로 전달 ──
      let imageBuffer: Buffer =
        (ext === 'heic' || ext === 'heif')
          ? await convertHeicToJpeg(rawBuffer)
          : rawBuffer;

      // OCR 최적화 (선명화 + 정규화)
      imageBuffer = await optimizeForOCR(imageBuffer);
      const mimeType = 'image/jpeg';
      const base64 = imageBuffer.toString('base64');

      parsed = await generateJSON({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: OCR_ENHANCED_PROMPT,
        images: [{ base64, mimeType }],
        responseSchema: EXAM_PARSE_SCHEMA,
      });

      // 원본 이미지를 페이지 이미지로 저장
      const imgFileName = `exam-pages/${examId}/page_1.png`;
      await supabase.storage
        .from('exam-pdfs')
        .upload(imgFileName, imageBuffer, { contentType: 'image/jpeg', upsert: true });
      const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(imgFileName);
      pageImageUrls[1] = urlData?.publicUrl || '';

    } else {
      // ── 문서(HWP/DOC/DOCX): PDF로 변환 후 처리 ──
      const pdfBuffer = await convertDocToPdf(rawBuffer, ext);
      const base64 = pdfBuffer.toString('base64');

      parsed = await generateJSON({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: OCR_ENHANCED_PROMPT,
        pdfBase64: base64,
        responseSchema: EXAM_PARSE_SCHEMA,
      });

      // PDF 변환본에서 페이지 이미지 생성
      try {
        const pageImages = await pdfToPageImages(pdfBuffer);
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
        console.error('문서 페이지 이미지 변환 실패:', imgErr);
      }
    }

    // 제시문에 페이지 이미지 URL 매핑
    const passages = (parsed.passages || []).map((p: any) => ({
      ...p,
      page_image_url: p.page_number ? pageImageUrls[p.page_number] || null : null,
    }));

    const { error: updateError } = await supabase
      .from('exams')
      .update({
        parsed_passages: passages,
        parsed_questions: parsed.questions,
        parsed_metadata: {
          ...(parsed.metadata || {}),
          page_image_urls: pageImageUrls,
          original_format: ext,
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
      format: ext,
    });
  } catch (err) {
    await supabase.from('exams').update({ status: 'error' }).eq('id', examId);
    const message = err instanceof Error ? err.message : '파싱 중 오류 발생';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
