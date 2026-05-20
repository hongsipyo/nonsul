import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  // Whitelist allowed fields
  const allowed: Record<string, unknown> = {};
  const FIELDS = ['date', 'time_slot', 'topic', 'status', 'note'];
  for (const key of FIELDS) {
    if (body[key] !== undefined) allowed[key] = body[key];
  }

  const { data, error } = await supabase
    .from('clinic_appointments')
    .update(allowed)
    .eq('id', appointmentId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ appointmentId: string }> }
) {
  const { appointmentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '인증이 필요합니다' }, { status: 401 });

  const { error } = await supabase
    .from('clinic_appointments')
    .delete()
    .eq('id', appointmentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
