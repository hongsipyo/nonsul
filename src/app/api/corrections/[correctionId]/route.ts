import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ correctionId: string }> }
) {
  const { correctionId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('corrections')
    .select(`
      *,
      student_answers(student_name, student_school, answer_images),
      exams(title, university)
    `)
    .eq('id', correctionId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ correctionId: string }> }
) {
  const { correctionId } = await params;
  const body = await req.json();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('corrections')
    .update({ ...body, updated_at: new Date().toISOString() })
    .eq('id', correctionId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
