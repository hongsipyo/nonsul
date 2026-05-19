import { NextRequest, NextResponse } from 'next/server';
import { generateJSON } from '@/lib/ai/client';
import { EXAM_PARSE_SYSTEM_PROMPT } from '@/lib/claude/prompts/exam-parse';
import { buildOralExamPrompt } from '@/lib/claude/prompts/oral-exam';

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const file = formData.get('file') as File;
  const university = formData.get('university') as string;
  const year = formData.get('year') as string;
  const session = formData.get('session') as string;

  if (!file || !university) {
    return NextResponse.json({ error: 'PDF 파일과 대학명이 필요합니다' }, { status: 400 });
  }

  try {
    // 1. PDF 파싱
    const buffer = Buffer.from(await file.arrayBuffer());
    const base64 = buffer.toString('base64');

    const parsed = await generateJSON<any>({
      systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
      prompt: '이 구술면접 PDF의 모든 제시문과 문제를 추출해주세요. JSON만 반환.',
      pdfBase64: base64,
    });

    // 2. 파싱된 텍스트로 예시답안 생성
    let examText = '';
    for (const p of parsed.passages || []) {
      examText += `제시문 ${p.label}\n${p.text}\n\n`;
    }
    for (const q of parsed.questions || []) {
      examText += `문제 ${q.number}: ${q.text}\n\n`;
    }

    const result = await generateJSON({
      prompt: buildOralExamPrompt({ examText, university, year, session }),
    });

    return NextResponse.json({
      parsed,
      answer: result,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '구술 분석 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
