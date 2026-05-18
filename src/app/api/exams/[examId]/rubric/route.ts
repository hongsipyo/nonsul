import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClaudeClient } from '@/lib/claude/client';
import { buildRubricGenerationPrompt } from '@/lib/claude/prompts/rubric-generation';
import type { Passage, Question } from '@/types/exam';

function examToText(passages: Passage[], questions: Question[]): string {
  let text = '';
  for (const p of passages) {
    text += `제시문 ${p.label}\n${p.text}\n\n`;
  }
  for (const q of questions) {
    text += `문제 ${q.number}: ${q.text}`;
    if (q.wordLimit) text += ` (${q.wordLimit}자 내외)`;
    text += '\n\n';
  }
  return text;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (!exam?.parsed_passages) {
    return NextResponse.json({ error: '먼저 시험을 파싱해주세요' }, { status: 400 });
  }

  try {
    const examText = examToText(exam.parsed_passages, exam.parsed_questions || []);
    const prompt = buildRubricGenerationPrompt(examText);

    const claude = getClaudeClient();
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    const responseText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('');

    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

    const rubricData = JSON.parse(jsonMatch[0]);

    // Upsert rubric
    const { data: existing } = await supabase
      .from('rubrics')
      .select('id')
      .eq('exam_id', examId)
      .single();

    if (existing) {
      await supabase
        .from('rubrics')
        .update({ items: rubricData.items, global_deductions: rubricData.global_deductions })
        .eq('id', existing.id);
    } else {
      await supabase.from('rubrics').insert({
        exam_id: examId,
        items: rubricData.items,
        global_deductions: rubricData.global_deductions,
      });
    }

    return NextResponse.json({ success: true, rubric: rubricData });
  } catch (err) {
    const message = err instanceof Error ? err.message : '채점기준 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('rubrics')
    .select('*')
    .eq('exam_id', examId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}
