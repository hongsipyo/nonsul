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
  const formData = await req.formData();
  const file = formData.get('file') as File;
  const title = formData.get('title') as string;
  const university = formData.get('university') as string;

  if (!file || !title) {
    return NextResponse.json({ error: '파일과 제목이 필요합니다' }, { status: 400 });
  }

  // 1. Upload PDF to Supabase Storage
  const fileName = `${Date.now()}_${file.name}`;
  const { error: uploadError } = await supabase.storage
    .from('exam-pdfs')
    .upload(fileName, file, { contentType: 'application/pdf' });

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(fileName);

  // 2. Create exam record
  const { data: exam, error: insertError } = await supabase
    .from('exams')
    .insert({
      title,
      university: university || null,
      original_pdf_path: fileName,
      original_pdf_url: urlData.publicUrl,
      status: 'uploaded',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(exam, { status: 201 });
}
