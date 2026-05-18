import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/client';
import {
  buildCorrectionSystemPrompt,
  buildCorrectionUserPrompt,
} from '@/lib/claude/prompts/correction';
import type { Passage, Question } from '@/types/exam';

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

  if (!exam?.parsed_passages || !answer?.answer_images?.length) {
    return NextResponse.json({ error: '시험 파싱 데이터 또는 답안 이미지가 없습니다' }, { status: 400 });
  }

  await supabase.from('corrections').update({ status: 'processing' }).eq('id', correctionId);

  try {
    const { data: rubric } = await supabase
      .from('rubrics')
      .select('*')
      .eq('exam_id', exam.id)
      .single();

    const examText = examToText(exam.parsed_passages, exam.parsed_questions || []);
    const systemPrompt = buildCorrectionSystemPrompt();
    const userPrompt = buildCorrectionUserPrompt({
      examText,
      rubric: rubric?.items,
    });

    // Download answer images
    const images = [];
    for (const img of answer.answer_images) {
      const { data: imgData } = await supabase.storage
        .from('answer-images')
        .download(img.storage_path);

      if (imgData) {
        const buffer = Buffer.from(await imgData.arrayBuffer());
        const base64 = buffer.toString('base64');
        const ext = img.storage_path.split('.').pop()?.toLowerCase();
        const mimeType = ext === 'png' ? 'image/png' :
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/jpeg';

        images.push({ base64, mimeType });
      }
    }

    const result = await generateJSON({
      systemPrompt,
      prompt: userPrompt,
      images,
    });

    await supabase
      .from('corrections')
      .update({
        margin_comments: (result as any).margin_comments,
        scores: (result as any).scores,
        total_score: (result as any).total_score,
        grade: (result as any).grade,
        summary: (result as any).summary,
        answer_outline: (result as any).answer_outline,
        strengths: (result as any).strengths,
        improvements: (result as any).improvements,
        status: 'completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', correctionId);

    return NextResponse.json({ success: true, correction: result });
  } catch (err) {
    await supabase.from('corrections').update({ status: 'error' }).eq('id', correctionId);
    const message = err instanceof Error ? err.message : '첨삭 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
