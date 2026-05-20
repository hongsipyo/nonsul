import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '20mb',
    },
  },
};

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

  const title = formData.get('title') as string;
  const university = formData.get('university') as string;
  const scoringNote = formData.get('scoringNote') as string;

  // 다중 파일 ('files') 또는 단일 파일 ('file') 둘 다 지원
  const multiFiles = formData.getAll('files') as File[];
  const singleFile = formData.get('file') as File | null;
  const files: File[] = multiFiles.length > 0
    ? multiFiles.filter((f) => f instanceof File && f.size > 0)
    : singleFile ? [singleFile] : [];

  if (files.length === 0 || !title) {
    return NextResponse.json({ error: '파일과 제목이 필요합니다' }, { status: 400 });
  }

  // 파일 확장자 검증
  for (const file of files) {
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: `지원하지 않는 파일 형식입니다: ${file.name}` },
        { status: 400 }
      );
    }
  }

  const timestamp = Date.now();
  const uploadedPaths: string[] = [];
  const uploadedUrls: string[] = [];

  // 모든 파일 업로드
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const contentType = MIME_MAP[ext] || 'application/octet-stream';
    const fileName = files.length === 1
      ? `${timestamp}_exam.${ext}`
      : `${timestamp}_exam_${i + 1}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('exam-pdfs')
      .upload(fileName, file, { contentType });

    if (uploadError) {
      return NextResponse.json(
        { error: `업로드 실패 (${file.name}): ${uploadError.message}` },
        { status: 500 }
      );
    }

    const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(fileName);
    uploadedPaths.push(fileName);
    uploadedUrls.push(urlData?.publicUrl || '');
  }

  const { data: exam, error: insertError } = await supabase
    .from('exams')
    .insert({
      title,
      university: university || null,
      scoring_note: scoringNote || null,
      // 단일 파일: 기존 호환 유지, 다중 파일: 첫 번째를 대표로
      original_pdf_path: uploadedPaths[0],
      original_pdf_url: uploadedUrls[0],
      // 다중 파일 정보는 metadata에 저장
      parsed_metadata: files.length > 1 ? {
        multi_files: uploadedPaths.map((path, i) => ({
          path,
          url: uploadedUrls[i],
          original_name: files[i].name,
        })),
      } : null,
      status: 'uploaded',
    })
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json(exam, { status: 201 });
}
