import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('messages')
    .insert({
      user_id: user.id,
      title: body.title,
      content: body.content,
      type: body.type || '일반',
      status: body.status || 'sent',
      recipient_type: body.recipient_type || 'individual',
      recipient_student_ids: body.recipient_student_ids || [],
      recipient_class_name: body.recipient_class_name,
      recipient_names: body.recipient_names || [],
      exam_id: body.exam_id || null,
      student_id: body.student_id || null,
      sent_at: body.status === 'sent' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
