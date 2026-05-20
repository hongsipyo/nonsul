import { NextRequest, NextResponse } from 'next/server';
import { generateJSON, ORAL_EXAM_SCHEMA } from '@/lib/ai/client';
import { buildOralExamPrompt } from '@/lib/claude/prompts/oral-exam';

export async function POST(req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 });
  }

  const { examText, university, year, session } = body;

  if (!examText || !university) {
    return NextResponse.json({ error: '문제 텍스트와 대학명이 필요합니다' }, { status: 400 });
  }

  try {
    const prompt = buildOralExamPrompt({ examText, university, year, session });
    const result = await generateJSON({ prompt, responseSchema: ORAL_EXAM_SCHEMA });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '구술 예시답안 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
