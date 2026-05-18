import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateJSON } from '@/lib/ai/client';
import { EXAM_PARSE_SYSTEM_PROMPT } from '@/lib/claude/prompts/exam-parse';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data: exam, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (error || !exam) {
    return NextResponse.json({ error: '시험을 찾을 수 없습니다' }, { status: 404 });
  }

  await supabase.from('exams').update({ status: 'parsing' }).eq('id', examId);

  try {
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('exam-pdfs')
      .download(exam.original_pdf_path);

    if (downloadError || !fileData) throw new Error('PDF 다운로드 실패');

    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString('base64');

    const parsed = await generateJSON({
      systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
      prompt: '이 PDF의 모든 제시문과 문제를 빠짐없이 추출해주세요. JSON만 반환.',
      pdfBase64: base64,
    });

    const { error: updateError } = await supabase
      .from('exams')
      .update({
        parsed_passages: (parsed as any).passages,
        parsed_questions: (parsed as any).questions,
        parsed_metadata: (parsed as any).metadata,
        status: 'parsed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      passages: (parsed as any).passages?.length || 0,
      questions: (parsed as any).questions?.length || 0,
    });
  } catch (err) {
    await supabase.from('exams').update({ status: 'error' }).eq('id', examId);
    const message = err instanceof Error ? err.message : '파싱 중 오류 발생';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
