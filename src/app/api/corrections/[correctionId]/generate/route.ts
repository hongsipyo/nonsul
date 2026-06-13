import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON, CORRECTION_SCHEMA, MODELS_PRO } from '@/lib/ai/client';
import {
  buildCorrectionSystemPrompt,
  buildCorrectionUserPrompt,
} from '@/lib/claude/prompts/correction';
import type { Passage, Question, MarginComment } from '@/types/exam';
import { renderRedPenImages, renderRedPenPDF, renderManuscriptImages, renderManuscriptPDF } from '@/lib/export/red-pen-server';

function examToText(passages: Passage[], questions: Question[]): string {
  let text = '';
  for (const p of passages) text += `제시문 ${p.label}\n${p.text}\n\n`;
  for (const q of questions) {
    text += `문제 ${q.number}: ${q.text}`;
    if (q.wordLimit) text += ` (${q.wordLimit}자 내외)`;
    text += '\n\n';
  }
  return text;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ correctionId: string }> }
) {
  const { correctionId } = await params;
  const supabase = await createClient();

  const { data: correction } = await supabase
    .from('corrections')
    .select('*, student_answers(*), exams(*)')
    .eq('id', correctionId)
    .single();

  if (!correction) {
    return NextResponse.json({ error: '첨삭을 찾을 수 없습니다' }, { status: 404 });
  }

  const exam = correction.exams;
  const answer = correction.student_answers;

  const hasImages = Array.isArray(answer?.answer_images) && answer.answer_images.length > 0;
  const hasText = typeof answer?.answer_text === 'string' && answer.answer_text.trim().length > 0;
  if (!exam?.parsed_passages || (!hasImages && !hasText)) {
    return NextResponse.json({ error: '시험 파싱 데이터 또는 학생 답안(이미지·텍스트)이 없습니다' }, { status: 400 });
  }

  await supabase.from('corrections').update({ status: 'processing' }).eq('id', correctionId);

  try {
    const { data: rubric } = await supabase
      .from('rubrics')
      .select('*')
      .eq('exam_id', exam.id)
      .maybeSingle();

    const examText = examToText(exam.parsed_passages, exam.parsed_questions || []);
    const systemPrompt = buildCorrectionSystemPrompt();
    const answerText: string = hasText ? answer.answer_text : '';
    const userPrompt = buildCorrectionUserPrompt({
      examText,
      rubric: rubric?.items,
      ...(hasText ? { answerText } : {}),
    });

    // Download answer images (base64 for AI + raw buffer for red-pen rendering)
    const images: { base64: string; mimeType: string }[] = [];
    const pageBuffers: { buffer: Buffer; page: number }[] = [];
    if (hasImages) {
      for (let i = 0; i < answer.answer_images.length; i++) {
        const img = answer.answer_images[i];
        const { data: imgData, error: dlError } = await supabase.storage
          .from('answer-images')
          .download(img.storage_path);

        if (dlError || !imgData) {
          console.error(`답안 이미지 다운로드 실패: ${img.storage_path}`, dlError);
          continue;
        }

        const buffer = Buffer.from(await imgData.arrayBuffer());
        const base64 = buffer.toString('base64');
        const ext = img.storage_path.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' :
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/jpeg';

        images.push({ base64, mimeType });
        pageBuffers.push({ buffer, page: img.page ?? i + 1 });
      }

      if (images.length === 0) {
        throw new Error('답안 이미지를 다운로드할 수 없습니다');
      }
    }

    const result = await generateJSON({
      systemPrompt,
      prompt: userPrompt,
      ...(images.length ? { images } : {}),
      responseSchema: CORRECTION_SCHEMA,
      models: MODELS_PRO,
    });

    const r = result as Record<string, unknown>;
    const marginComments = (r.margin_comments as MarginComment[]) || [];

    // ── 서버에서 빨간펜 마킹본 산출 (제미나이식: 학생 원고지 위 직접 마킹) ──
    let correctedImages: { page: number; storage_path: string; url: string }[] | undefined;
    let correctedPdfPath: string | undefined;
    try {
      const renderOpts = {
        comments: marginComments,
        answerOutline: r.answer_outline as string | undefined,
        summary: r.summary as string | undefined,
        strengths: r.strengths as string | undefined,
        improvements: r.improvements as string | undefined,
        brand: '프로세스' as const,
        studentName: answer.student_name as string | undefined,
        examTitle: exam.title as string | undefined,
      };

      // 1) 페이지별 마킹 PNG → corrected-files 업로드
      //    이미지 답안 = 학생 사진 위 직접 마킹 / 텍스트 답안 = 실양식 원고지 위 조판+마킹
      const annotated = hasImages
        ? await renderRedPenImages(pageBuffers, renderOpts)
        : await renderManuscriptImages(answerText, renderOpts);
      correctedImages = [];
      for (const a of annotated) {
        const path = `${correctionId}/red-pen-p${a.page}.png`;
        const { error: upErr } = await supabase.storage
          .from('corrected-files')
          .upload(path, a.buffer, { contentType: 'image/png', upsert: true });
        if (upErr) {
          console.error('마킹 PNG 업로드 실패:', upErr);
          continue;
        }
        const { data: urlData } = supabase.storage.from('corrected-files').getPublicUrl(path);
        correctedImages.push({ page: a.page, storage_path: path, url: urlData.publicUrl });
      }

      // 2) 인쇄용 PDF → corrected-files 업로드
      const pdfBuf = hasImages
        ? await renderRedPenPDF(pageBuffers, renderOpts)
        : await renderManuscriptPDF(answerText, renderOpts);
      const pdfPath = `${correctionId}/red-pen.pdf`;
      const { error: pdfErr } = await supabase.storage
        .from('corrected-files')
        .upload(pdfPath, pdfBuf, { contentType: 'application/pdf', upsert: true });
      if (!pdfErr) correctedPdfPath = pdfPath;
      else console.error('마킹 PDF 업로드 실패:', pdfErr);
    } catch (renderErr) {
      // 렌더 실패해도 첨삭 데이터는 저장(폴백: 클라이언트 우측 여백 표시)
      console.error('빨간펜 서버 렌더 실패:', renderErr);
    }

    await supabase
      .from('corrections')
      .update({
        margin_comments: marginComments,
        scores: r.scores,
        total_score: r.total_score,
        grade: r.grade,
        summary: r.summary,
        answer_outline: r.answer_outline,
        strengths: r.strengths,
        improvements: r.improvements,
        ...(correctedImages && correctedImages.length ? { corrected_images: correctedImages } : {}),
        ...(correctedPdfPath ? { corrected_pdf_path: correctedPdfPath } : {}),
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', correctionId);

    return NextResponse.json({ success: true, correction: result, corrected_images: correctedImages, corrected_pdf_path: correctedPdfPath });
  } catch (err) {
    await supabase.from('corrections').update({ status: 'error' }).eq('id', correctionId);
    const message = err instanceof Error ? err.message : '첨삭 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
