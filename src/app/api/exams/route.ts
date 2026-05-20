import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const MIME_MAP: Record<string, string> = {
  pdf: 'application/pdf',
  hwp: 'application/haansofthwp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  heic: 'image/heic',
  heif: 'image/heif',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(MIME_MAP));

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

  // 파일 크기 제한 (20MB)
  const MAX_FILE_SIZE = 20 * 1024 * 1024;
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '파일 크기가 20MB를 초과합니다' }, { status: 413 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return NextResponse.json({ error: `지원하지 않는 파일 형식: .${ext}` }, { status: 400 });
  }

  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const timestamp = Date.now();
  const fileName = `${timestamp}_exam.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('exam-pdfs')
    .upload(fileName, file, { contentType });

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
      parsed_metadata: {
        multi_files: [{
          path: fileName,
          url: urlData?.publicUrl || '',
          original_name: file.name,
        }],
      },
      status: 'uploaded',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(exam, { status: 201 });
}
