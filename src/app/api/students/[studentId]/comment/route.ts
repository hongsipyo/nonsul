import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getClaudeClient } from '@/lib/claude/client';
import { buildStudentCommentPrompt } from '@/lib/claude/prompts/student-comment';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const supabase = createAdminClient();

  // 1. Get student
  const { data: student } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (!student) {
    return NextResponse.json({ error: '학생을 찾을 수 없습니다' }, { status: 404 });
  }

  // 2. Get all corrections for this student
  const { data: answers } = await supabase
    .from('student_answers')
    .select('id, exam_id')
    .eq('student_id', studentId);

  if (!answers || answers.length === 0) {
    return NextResponse.json({ error: '첨삭 기록이 없습니다' }, { status: 400 });
  }

  const answerIds = answers.map((a) => a.id);
  const { data: corrections } = await supabase
    .from('corrections')
    .select(`
      id, grade, total_score, strengths, improvements, summary, created_at,
      exams(title)
    `)
    .in('answer_id', answerIds)
    .eq('status', 'completed')
    .order('created_at', { ascending: true });

  if (!corrections || corrections.length === 0) {
    return NextResponse.json({ error: '완료된 첨삭이 없습니다' }, { status: 400 });
  }

  try {
    const prompt = buildStudentCommentPrompt({
      studentName: student.name,
      corrections: corrections.map((c: any) => ({
        examTitle: c.exams?.title || '시험',
        date: new Date(c.created_at).toLocaleDateString('ko-KR'),
        grade: c.grade || '-',
        totalScore: c.total_score || 0,
        strengths: c.strengths || '',
        improvements: c.improvements || '',
        summary: c.summary || '',
      })),
    });

    const claude = getClaudeClient();
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => (b as any).text)
      .join('');

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');

    return NextResponse.json(JSON.parse(jsonMatch[0]));
  } catch (err) {
    const message = err instanceof Error ? err.message : '코멘트 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
