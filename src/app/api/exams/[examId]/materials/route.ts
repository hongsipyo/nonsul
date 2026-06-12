import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateExamPptx } from '@/lib/export/pptx-generator';
import { generateJSON, SECTIONS_SCHEMA, PROOFREAD_SCHEMA, MODELS_PRO } from '@/lib/ai/client';
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

const PROOFREAD_PROMPT = `당신은 한국어 교정 전문가이다. 아래 텍스트에서 오류를 찾아 교정하라.

## 검수 항목
1. 맞춤법 오류 (예: "됬다"→"됐다")
2. 띄어쓰기 오류 (예: "할수있다"→"할 수 있다")
3. 문장부호 오류 (쉼표, 마침표, 괄호 등)
4. 조사 오류 (예: "을/를", "이/가", "은/는" 잘못된 사용)
5. 어법 오류 (예: "~로써"↔"~로서")

## 규칙
- 발견된 문제만 보고. 정상인 부분은 언급하지 말 것.
- 원문의 의미와 내용은 절대 바꾸지 말 것. 표기/띄어쓰기만 교정.
- original: 원문에서 해당 부분 (앞뒤 맥락 포함 30자 이내)
- corrected: 교정된 결과 (같은 길이의 맥락)
- 문제 없으면 issues를 빈 배열로

## 검수 대상 텍스트
`;

interface ProofreadIssue {
  type: string;
  original: string;
  corrected: string;
  reason: string;
}

/** 교정 결과를 텍스트에 적용 */
function applyCorrections(text: string, issues: ProofreadIssue[]): string {
  let result = text;
  // 긴 original부터 적용 (짧은 것이 긴 것의 일부일 수 있으므로)
  const sorted = [...issues].sort((a, b) => b.original.length - a.original.length);
  for (const issue of sorted) {
    if (issue.original && issue.corrected && issue.original !== issue.corrected) {
      result = result.split(issue.original).join(issue.corrected);
    }
  }
  return result;
}

/** 제시문/문제 텍스트를 자동 교정 */
async function proofreadPassagesAndQuestions(
  passages: Passage[],
  questions: Question[],
): Promise<{ passages: Passage[]; questions: Question[] }> {
  try {
    const allText = examToText(passages, questions);
    const truncated = allText.length > 15000 ? allText.substring(0, 15000) : allText;

    const result = await generateJSON<{ issues: ProofreadIssue[] }>({
      prompt: PROOFREAD_PROMPT + truncated,
      responseSchema: PROOFREAD_SCHEMA,
    });

    if (!result.issues || result.issues.length === 0) {
      return { passages, questions };
    }

    // 교정 적용
    const correctedPassages = passages.map(p => ({
      ...p,
      text: applyCorrections(p.text, result.issues),
    }));
    const correctedQuestions = questions.map(q => ({
      ...q,
      text: applyCorrections(q.text, result.issues),
    }));

    return { passages: correctedPassages, questions: correctedQuestions };
  } catch {
    // 교정 실패해도 원본 그대로 진행
    return { passages, questions };
  }
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
      // 띄어쓰기/맞춤법 자동 교정 후 PPT 생성
      const { passages: correctedPassages, questions: correctedQuestions } =
        await proofreadPassagesAndQuestions(
          exam.parsed_passages,
          exam.parsed_questions || [],
        );

      const pptx = generateExamPptx({
        title: exam.title,
        passages: correctedPassages,
        questions: correctedQuestions,
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
        responseSchema: SECTIONS_SCHEMA,
        models: MODELS_PRO,
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
