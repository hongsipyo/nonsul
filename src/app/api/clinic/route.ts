import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

  const { data, error } = await supabase
    .from('clinic_appointments')
    .select('*, students(name, school, grade)')
    .order('date', { ascending: true })
    .order('time_slot', { ascending: true });

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

  if (!body.student_id || !body.date || !body.time_slot) {
    return NextResponse.json({ error: 'student_id, date, time_slot은 필수입니다' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('clinic_appointments')
    .insert({
      user_id: user.id,
      student_id: body.student_id,
      date: body.date,
      time_slot: body.time_slot,
      topic: body.topic || null,
      status: body.status || 'reserved',
      note: body.note || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const id = body.id as string;
  if (!id) return NextResponse.json({ error: 'id는 필수입니다' }, { status: 400 });

  const allowed: Record<string, unknown> = {};
  if (body.status !== undefined) allowed.status = body.status;
  if (body.note !== undefined) allowed.note = body.note;

  const { data, error } = await supabase
    .from('clinic_appointments')
    .update(allowed)
    .eq('id', id)
    .select('*, students(name, school, grade)')
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
    .from('clinic_appointments')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
