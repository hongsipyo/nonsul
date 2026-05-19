import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('corrections')
    .select(`
      *,
      student_answers!inner(student_name, student_school, answer_images),
      exams!inner(title, university)
    `)
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

  const examId = formData.get('examId') as string;
  const studentName = formData.get('studentName') as string;
  const studentSchool = formData.get('studentSchool') as string;
  const files = formData.getAll('files') as File[];

  if (!examId || files.length === 0) {
    return NextResponse.json({ error: '시험 ID와 답안 이미지가 필요합니다' }, { status: 400 });
  }

  // Upload answer images — 파일명은 ASCII로 (한글 파일명 무관)
  const answerImages = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const ext = (file.name.split('.').pop() || 'jpg').replace(/[^\w]/g, '') || 'jpg';
    const fileName = `answers/${examId}/${Date.now()}_${i}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('answer-images')
      .upload(fileName, file);

    if (uploadError) {
      return NextResponse.json({ error: `이미지 업로드 실패: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('answer-images').getPublicUrl(fileName);
    answerImages.push({
      page: i + 1,
      storage_path: fileName,
      url: urlData?.publicUrl || '',
    });
  }

  const { data: answer, error: answerError } = await supabase
    .from('student_answers')
    .insert({
      exam_id: examId,
      student_name: studentName || null,
      student_school: studentSchool || null,
      answer_images: answerImages,
    })
    .select()
    .single();

  if (answerError) {
    return NextResponse.json({ error: answerError.message }, { status: 500 });
  }

  const { data: correction, error: corrError } = await supabase
    .from('corrections')
    .insert({
      answer_id: answer.id,
      exam_id: examId,
      status: 'uploaded',
    })
    .select()
    .single();

  if (corrError) {
    return NextResponse.json({ error: corrError.message }, { status: 500 });
  }

  return NextResponse.json({
    answerId: answer.id,
    correctionId: correction.id,
  }, { status: 201 });
}
