import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 그 주(시험) 우수답안 모아보기. is_best_answer 컬럼 없으면 빈 배열(안전).
export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('corrections')
    .select(`
      id, total_score, grade, summary, best_answer_text, best_answer_at,
      student_answers!inner(student_name, student_school, students(class_name)),
      exams(title, university)
    `)
    .eq('is_best_answer', true)
    .order('best_answer_at', { ascending: false });

  // 컬럼 미적용 등으로 에러 시 빈 배열
  if (error) return NextResponse.json([]);
  return NextResponse.json(data || []);
}
