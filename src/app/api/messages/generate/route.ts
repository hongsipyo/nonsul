import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON, MESSAGE_SCHEMA } from '@/lib/ai/client';
import { buildMessagePrompt } from '@/lib/claude/prompts/message-generation';
import type { MessageType } from '@/types/exam';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const messageType = (body.type || '일반') as MessageType;
  const supabase = await createClient();

  try {
    // 학생 정보 조회 (개별 발송 시)
    let studentName: string | undefined;
    let corrections: any[] | undefined;

    if (body.student_id) {
      const { data: student } = await supabase
        .from('students')
        .select('name')
        .eq('id', body.student_id)
        .single();
      studentName = student?.name;

      // 상담/시험결과용: 최근 첨삭 이력 조회
      if (messageType === '상담' || messageType === '시험결과') {
        const { data: answers } = await supabase
          .from('student_answers')
          .select('id')
          .eq('student_id', body.student_id);

        if (answers?.length) {
          const { data: corrs } = await supabase
            .from('corrections')
            .select('total_score, grade, exams(title)')
            .in('answer_id', answers.map((a: any) => a.id))
            .eq('status', 'completed')
            .order('created_at', { ascending: false })
            .limit(5);

          corrections = corrs?.map((c: any) => ({
            examTitle: c.exams?.title || '시험',
            score: c.total_score || 0,
            grade: c.grade || '-',
          }));
        }
      }
    }

    const prompt = buildMessagePrompt({
      type: messageType,
      studentName,
      className: body.class_name,
      examTitle: body.exam_title,
      score: body.score,
      grade: body.grade,
      strengths: body.strengths,
      improvements: body.improvements,
      corrections,
      customNote: body.custom_note,
    });

    const result = await generateJSON({
      prompt,
      responseSchema: MESSAGE_SCHEMA,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '문자 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
