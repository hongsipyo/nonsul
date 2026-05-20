import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('id', studentId)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const body = await req.json();
  const supabase = await createClient();

  // Whitelist allowed fields
  const allowed: Record<string, unknown> = {};
  const FIELDS = ['name', 'school', 'grade', 'target_university', 'class_name', 'phone', 'email', 'notes'];
  for (const key of FIELDS) {
    if (body[key] !== undefined) allowed[key] = body[key];
  }
  allowed.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from('students')
    .update(allowed)
    .eq('id', studentId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const supabase = await createClient();
  const { error } = await supabase
    .from('students')
    .delete()
    .eq('id', studentId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
