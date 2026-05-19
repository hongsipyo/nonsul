import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/client';
import { EXAM_PARSE_SYSTEM_PROMPT } from '@/lib/claude/prompts/exam-parse';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile, readdir, mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

const execAsync = promisify(exec);

/**
 * PDF 각 페이지를 PNG 이미지로 변환 (pdftoppm 사용)
 * 표/그래프가 있는 페이지를 이미지로 보존하기 위함
 */
async function pdfToPageImages(pdfBuffer: Buffer): Promise<{ page: number; buffer: Buffer }[]> {
  const tempDir = await mkdtemp(join(tmpdir(), 'nonsul-pdf-'));
  const pdfPath = join(tempDir, 'input.pdf');
  const outPrefix = join(tempDir, 'page');

  try {
    await require('fs').promises.writeFile(pdfPath, pdfBuffer);

    // pdftoppm: PDF → PNG (200 DPI for decent quality + small size)
    await execAsync(`pdftoppm -png -r 200 "${pdfPath}" "${outPrefix}"`);

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

    if (downloadError || !fileData) throw new Error('PDF 다운로드 실패');

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString('base64');

    // 1. AI 파싱 (텍스트 + 표/그래프 인식)
    const parsed = await generateJSON({
      systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
      prompt: '이 PDF의 모든 제시문과 문제를 빠짐없이 추출해주세요. 표와 그래프가 있으면 반드시 has_table/has_graph와 table_markdown을 포함. JSON만 반환.',
      pdfBase64: base64,
    });

    // 2. PDF 페이지 이미지 생성 + Storage 업로드
    let pageImageUrls: Record<number, string> = {};
    try {
      const pageImages = await pdfToPageImages(buffer);

      for (const img of pageImages) {
        const fileName = `exam-pages/${examId}/page_${img.page}.png`;
        const { error: uploadErr } = await supabase.storage
          .from('exam-pdfs')
          .upload(fileName, img.buffer, {
            contentType: 'image/png',
            upsert: true,
          });

        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('exam-pdfs')
            .getPublicUrl(fileName);
          pageImageUrls[img.page] = urlData?.publicUrl || '';
        }
      }
    } catch (imgErr) {
      // 이미지 변환 실패해도 텍스트 파싱은 진행
      console.error('PDF 페이지 이미지 변환 실패 (텍스트 파싱은 정상):', imgErr);
    }

    // 3. 제시문에 페이지 이미지 URL 매핑
    const passages = ((parsed as any).passages || []).map((p: any) => ({
      ...p,
      page_image_url: p.page_number ? pageImageUrls[p.page_number] || null : null,
    }));

    const { error: updateError } = await supabase
      .from('exams')
      .update({
        parsed_passages: passages,
        parsed_questions: (parsed as any).questions,
        parsed_metadata: {
          ...((parsed as any).metadata || {}),
          page_image_urls: pageImageUrls,
        },
        status: 'parsed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      passages: passages.length,
      questions: ((parsed as any).questions || []).length,
      pageImages: Object.keys(pageImageUrls).length,
    });
  } catch (err) {
    await supabase.from('exams').update({ status: 'error' }).eq('id', examId);
    const message = err instanceof Error ? err.message : '파싱 중 오류 발생';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
