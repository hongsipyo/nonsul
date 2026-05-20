import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON, RUBRIC_SCHEMA } from '@/lib/ai/client';
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
    const prompt = buildRubricGenerationPrompt(examText, exam.scoring_note || undefined);

    const rubricData = await generateJSON({ prompt, responseSchema: RUBRIC_SCHEMA });

    // Upsert rubric
    const { data: existing } = await supabase
      .from('rubrics')
      .select('id')
      .eq('exam_id', examId)
      .maybeSingle();

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
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: '채점기준이 없습니다' }, { status: 404 });
  return NextResponse.json(data);
}
