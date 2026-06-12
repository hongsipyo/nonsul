import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSms, isSmsConfigured } from '@/lib/sms/solapi';

// 실제 문자 발송. recipient_type(individual/class/all)에 따라 학생 전화번호를 모아 솔라피로 발송.
export async function POST(req: NextRequest) {
  let body: {
    title?: string;
    content?: string;
    type?: string;
    recipient_type?: 'individual' | 'class' | 'all';
    recipient_student_ids?: string[];
    recipient_class_name?: string;
    exam_id?: string;
    student_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  if (!body.content?.trim()) {
    return NextResponse.json({ error: '내용이 비어있습니다' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다' }, { status: 401 });

  // 수신자 전화번호 수집
  let studentQuery = supabase.from('students').select('id, name, phone').not('phone', 'is', null);
  if (body.recipient_type === 'class' && body.recipient_class_name) {
    studentQuery = studentQuery.eq('class_name', body.recipient_class_name);
  } else if (body.recipient_type === 'individual' && body.recipient_student_ids?.length) {
    studentQuery = studentQuery.in('id', body.recipient_student_ids);
  }
  // 'all'이면 필터 없이 전체
  const { data: students, error: stuErr } = await studentQuery;
  if (stuErr) return NextResponse.json({ error: stuErr.message }, { status: 500 });

  const recipients = (students || []).filter((s) => s.phone);
  const phones = recipients.map((s) => s.phone as string);
  const names = recipients.map((s) => s.name);

  if (phones.length === 0) {
    return NextResponse.json({ error: '발송할 전화번호가 없습니다 (학생 전화번호를 먼저 등록하세요)' }, { status: 400 });
  }

  // 발송 (미설정 시 명확한 안내)
  if (!isSmsConfigured()) {
    return NextResponse.json(
      {
        error: '문자 서비스 미설정',
        hint: 'solapi.com 가입 → .env.local에 SOLAPI_API_KEY / SOLAPI_API_SECRET / SOLAPI_SENDER(발신번호) 추가 후 재시작하세요.',
        wouldSendTo: names,
      },
      { status: 503 }
    );
  }

  const send = await sendSms({ to: phones, text: body.content });

  // 발송 결과를 메시지 레코드로 기록
  const status = send.ok && send.sentCount > 0 ? 'sent' : 'failed';
  const { data: msg } = await supabase
    .from('messages')
    .insert({
      user_id: user.id,
      title: body.title || body.type || '문자',
      content: body.content,
      type: body.type || '일반',
      status,
      recipient_type: body.recipient_type || 'individual',
      recipient_student_ids: body.recipient_student_ids || [],
      recipient_class_name: body.recipient_class_name,
      recipient_names: names,
      exam_id: body.exam_id || null,
      student_id: body.student_id || null,
      sent_at: status === 'sent' ? new Date().toISOString() : null,
    })
    .select()
    .single();

  return NextResponse.json({
    ok: send.ok,
    sentCount: send.sentCount,
    failedCount: send.failedCount,
    recipients: names,
    error: send.error,
    message: msg,
  });
}
