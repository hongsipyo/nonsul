import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { generateJSON, BEST_ANSWER_SCHEMA } from "@/lib/ai/client";
import { buildBestAnswerSelectionPrompt } from '@/lib/claude/prompts/best-answer';
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
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = createAdminClient();

  // 1. Get exam
  const { data: exam } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (!exam?.parsed_passages) {
    return NextResponse.json({ error: '시험 데이터가 없습니다' }, { status: 400 });
  }

  // 2. Get all completed corrections for this exam
  const { data: corrections } = await supabase
    .from('corrections')
    .select(`
      id, total_score, grade, answer_outline,
      student_answers(student_name, answer_text)
    `)
    .eq('exam_id', examId)
    .eq('status', 'completed')
    .order('total_score', { ascending: false });

  if (!corrections || corrections.length < 2) {
    return NextResponse.json({ error: '우수답안 선정을 위해 최소 2개 이상의 첨삭이 필요합니다' }, { status: 400 });
  }

  // 3. Get rubric
  const { data: rubric } = await supabase
    .from('rubrics')
    .select('items')
    .eq('exam_id', examId)
    .maybeSingle();

  try {
    const examText = examToText(exam.parsed_passages, exam.parsed_questions || []);
    const answersWithScores = corrections.map((c: any) => ({
      studentName: c.student_answers?.student_name || '이름없음',
      answerText: c.student_answers?.answer_text || c.answer_outline || '(텍스트 없음)',
      totalScore: c.total_score || 0,
      correctionId: c.id,
    }));

    const prompt = buildBestAnswerSelectionPrompt({
      examText,
      rubricJson: rubric ? JSON.stringify(rubric.items) : '없음',
      answersWithScores,
    });

    const result = await generateJSON({ prompt, responseSchema: BEST_ANSWER_SCHEMA });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '우수답안 선정 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
