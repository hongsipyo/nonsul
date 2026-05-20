import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const date = searchParams.get('date');
  const classId = searchParams.get('class_id');
  const studentId = searchParams.get('student_id');

  let query = supabase
    .from('attendance')
    .select('*, students(name, school, grade)')
    .order('date', { ascending: false });

  if (date) {
    query = query.eq('date', date);
  }
  if (classId) {
    query = query.eq('class_id', classId);
  }
  if (studentId) {
    query = query.eq('student_id', studentId);
  }

  const { data, error } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  if (!body.student_id || !body.date) {
    return NextResponse.json({ error: 'student_id와 date는 필수입니다' }, { status: 400 });
  }

  // Upsert: student_id + date + class_id unique
  const { data, error } = await supabase
    .from('attendance')
    .upsert(
      {
        user_id: user.id,
        student_id: body.student_id,
        class_id: body.class_id || null,
        date: body.date,
        status: body.status || 'present',
        note: body.note || null,
      },
      { onConflict: 'student_id,date,class_id' }
    )
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id는 필수입니다' }, { status: 400 });

  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
