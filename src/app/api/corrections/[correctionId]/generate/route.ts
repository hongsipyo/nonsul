import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClaudeClient } from '@/lib/claude/client';
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

  // 1. Get correction + answer + exam + rubric
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

  // Update status
  await supabase.from('corrections').update({ status: 'processing' }).eq('id', correctionId);

  try {
    // 2. Get rubric
    const { data: rubric } = await supabase
      .from('rubrics')
      .select('*')
      .eq('exam_id', exam.id)
      .single();

    // 3. Build prompts
    const examText = examToText(exam.parsed_passages, exam.parsed_questions || []);
    const systemPrompt = buildCorrectionSystemPrompt();
    const userPrompt = buildCorrectionUserPrompt({
      examText,
      rubric: rubric?.items,
    });

    // 4. Build image content blocks for answer images
    const imageBlocks = [];
    for (const img of answer.answer_images) {
      // Download image from storage
      const { data: imgData } = await supabase.storage
        .from('answer-images')
        .download(img.storage_path);

      if (imgData) {
        const buffer = Buffer.from(await imgData.arrayBuffer());
        const base64 = buffer.toString('base64');
        const ext = img.storage_path.split('.').pop()?.toLowerCase();
        const mediaType = ext === 'png' ? 'image/png' :
          ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
          ext === 'heic' ? 'image/jpeg' : 'image/jpeg';

        imageBlocks.push({
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: mediaType as 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
            data: base64,
          },
        });
      }
    }

    // 5. Call Claude
    const claude = getClaudeClient();
    const response = await claude.messages.create({
      model: 'claude-opus-4-20250514',
      max_tokens: 8000,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: [
            ...imageBlocks,
            { type: 'text', text: userPrompt },
          ],
        },
      ],
    });

    // 6. Parse response
    const responseText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

    const result = JSON.parse(jsonMatch[0]);

    // 7. Update correction
    await supabase
      .from('corrections')
      .update({
        margin_comments: result.margin_comments,
        scores: result.scores,
        total_score: result.total_score,
        grade: result.grade,
        summary: result.summary,
        answer_outline: result.answer_outline,
        strengths: result.strengths,
        improvements: result.improvements,
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
