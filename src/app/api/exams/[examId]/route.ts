import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }
  const supabase = await createClient();

  // 허용 필드만 화이트리스트 (mass assignment 방지)
  const allowed: Record<string, unknown> = {};
  const ALLOWED_FIELDS = ['title', 'university', 'exam_year', 'scoring_note', 'status'];
  for (const key of ALLOWED_FIELDS) {
    if (body[key] !== undefined) allowed[key] = body[key];
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('exams')
    .update(allowed)
    .eq('id', examId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { error } = await supabase.from('exams').delete().eq('id', examId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
