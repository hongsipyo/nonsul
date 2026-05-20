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

/**
 * 기존 exam에 추가 파일 업로드
 * 다중 파일 업로드 시 2번째 파일부터 이 엔드포인트 사용
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const file = formData.get('file') as File;
  if (!file) {
    return NextResponse.json({ error: '파일이 필요합니다' }, { status: 400 });
  }

  // exam 존재 확인
  const { data: exam, error } = await supabase
    .from('exams')
    .select('parsed_metadata')
    .eq('id', examId)
    .single();

  if (error || !exam) {
    return NextResponse.json({ error: '시험을 찾을 수 없습니다' }, { status: 404 });
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const contentType = MIME_MAP[ext] || 'application/octet-stream';
  const existingFiles = exam.parsed_metadata?.multi_files || [];
  const fileIndex = existingFiles.length + 1;
  const fileName = `${Date.now()}_exam_${fileIndex}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('exam-pdfs')
    .upload(fileName, file, { contentType });

  if (uploadError) {
    return NextResponse.json({ error: `업로드 실패: ${uploadError.message}` }, { status: 500 });
  }

  const { data: urlData } = supabase.storage.from('exam-pdfs').getPublicUrl(fileName);

  // metadata에 파일 추가
  const updatedFiles = [
    ...existingFiles,
    {
      path: fileName,
      url: urlData?.publicUrl || '',
      original_name: file.name,
    },
  ];

  await supabase
    .from('exams')
    .update({
      parsed_metadata: {
        ...(exam.parsed_metadata || {}),
        multi_files: updatedFiles,
      },
    })
    .eq('id', examId);

  return NextResponse.json({ success: true, fileIndex, fileName });
}
