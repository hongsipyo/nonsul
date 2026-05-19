import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const file = formData.get('file') as File;
  const title = formData.get('title') as string;
  const university = formData.get('university') as string;
  const scoringNote = formData.get('scoringNote') as string;

  if (!file || !title) {
    return NextResponse.json({ error: '파일과 제목이 필요합니다' }, { status: 400 });
  }

  // Storage 키는 ASCII만 허용 — 한글 파일명 무관하게 타임스탬프 사용
  const fileName = `${Date.now()}_exam.pdf`;

  const { error: uploadError } = await supabase.storage
    .from('exam-pdfs')
    .upload(fileName, file, { contentType: 'application/pdf' });

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(fileName);

  const { data: exam, error: insertError } = await supabase
    .from('exams')
    .insert({
      title,
      university: university || null,
      scoring_note: scoringNote || null,
      original_pdf_path: fileName,
      original_pdf_url: urlData?.publicUrl || '',
      status: 'uploaded',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(exam, { status: 201 });
}
