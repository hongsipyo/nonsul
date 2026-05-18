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
  const formData = await req.formData();
  const examId = formData.get('examId') as string;
  const studentName = formData.get('studentName') as string;
  const studentSchool = formData.get('studentSchool') as string;
  const files = formData.getAll('files') as File[];

  if (!examId || files.length === 0) {
    return NextResponse.json({ error: '시험 ID와 답안 이미지가 필요합니다' }, { status: 400 });
  }

  // 1. Upload answer images
  const answerImages = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const fileName = `answers/${examId}/${Date.now()}_${i}.${file.name.split('.').pop()}`;
    const { error: uploadError } = await supabase.storage
      .from('answer-images')
      .upload(fileName, file);

    if (uploadError) {
      return NextResponse.json({ error: `이미지 업로드 실패: ${uploadError.message}` }, { status: 500 });
    }

    const { data: urlData } = supabase.storage.from('answer-images').getPublicUrl(fileName);
    answerImages.push({ page: i + 1, storage_path: fileName, url: urlData.publicUrl });
  }

  // 2. Create student_answer record
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

  // 3. Create correction record (processing status)
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
