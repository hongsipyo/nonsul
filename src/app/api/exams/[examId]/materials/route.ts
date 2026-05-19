import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateExamPptx } from '@/lib/export/pptx-generator';
import { generateJSON } from '@/lib/ai/client';
import { buildExplanationPrompt } from '@/lib/claude/prompts/explanation-generation';
import type { Passage, Question, BrandType } from '@/types/exam';

function examToText(passages: Passage[], questions: Question[]): string {
  let text = '';
  for (const p of passages) text += `제시문 ${p.label}\n${p.text}\n\n`;
  for (const q of questions) {
    text += `문제 ${q.number}: ${q.text}`;
    if (q.wordLimit) text += ` (${q.wordLimit}자 내외)`;
    text += '\n\n';
  }
  return text;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const materialType = body.type as string;
  const brand = (body.brand || '프로세스') as BrandType;

  const supabase = await createClient();
  const { data: exam } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (!exam?.parsed_passages) {
    return NextResponse.json({ error: '먼저 시험을 파싱해주세요' }, { status: 400 });
  }

  try {
    if (materialType === 'ppt') {
      const pptx = generateExamPptx({
        title: exam.title,
        passages: exam.parsed_passages,
        questions: exam.parsed_questions || [],
        brand,
        pageImageUrls: exam.parsed_metadata?.page_image_urls || {},
      });

      const buffer = await pptx.write({ outputType: 'nodebuffer' }) as Buffer;

      const brandTag = brand === '프로세스' ? 'process' : 'indie';
      const fileName = `ppt/${examId}_${brandTag}_${Date.now()}.pptx`;

      const { error: uploadError } = await supabase.storage
        .from('materials')
        .upload(fileName, buffer, {
          contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        });

      if (uploadError) {
        throw new Error(`PPT 업로드 실패: ${uploadError.message}`);
      }

      const { data: urlData } = supabase.storage.from('materials').getPublicUrl(fileName);

      await supabase.from('generated_materials').insert({
        exam_id: examId,
        type: 'ppt',
        brand,
        file_path: fileName,
        file_url: urlData?.publicUrl || '',
      });

      return NextResponse.json({ success: true, url: urlData?.publicUrl, type: 'ppt' });
    }

    if (materialType === '해설지') {
      const { data: rubric } = await supabase
        .from('rubrics')
        .select('*')
        .eq('exam_id', examId)
        .maybeSingle();

      const examText = examToText(exam.parsed_passages, exam.parsed_questions || []);
      const rubricJson = rubric ? JSON.stringify(rubric.items) : '채점기준 없음';

      const explanationData = await generateJSON({
        prompt: buildExplanationPrompt(examText, rubricJson),
      });

      await supabase.from('generated_materials').insert({
        exam_id: examId,
        type: '해설지',
        brand,
        content: explanationData,
      });

      return NextResponse.json({ success: true, content: explanationData, type: '해설지' });
    }

    return NextResponse.json({ error: '지원하지 않는 자료 유형' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '자료 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from('generated_materials')
    .select('*')
    .eq('exam_id', examId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
