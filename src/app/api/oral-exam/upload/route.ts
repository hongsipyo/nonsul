import { NextRequest, NextResponse } from 'next/server';
import { generateJSON, EXAM_PARSE_SCHEMA, ORAL_EXAM_SCHEMA } from '@/lib/ai/client';
import { EXAM_PARSE_SYSTEM_PROMPT } from '@/lib/claude/prompts/exam-parse';
import { buildOralExamPrompt } from '@/lib/claude/prompts/oral-exam';
import sharp from 'sharp';

function getFileExt(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

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
    return NextResponse.json({ error: '파일과 대학명이 필요합니다' }, { status: 400 });
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = getFileExt(file);
    const isImage = ['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext);

    let parsed: any;

    if (isImage) {
      // 이미지: OCR 최적화 후 이미지로 전달
      let imageBuffer = buffer;
      if (ext === 'heic' || ext === 'heif') {
        imageBuffer = Buffer.from(await sharp(buffer).jpeg({ quality: 95 }).toBuffer());
      }
      imageBuffer = Buffer.from(
        await sharp(imageBuffer)
          .resize({ width: 3000, withoutEnlargement: true })
          .sharpen({ sigma: 1.5 })
          .normalize()
          .jpeg({ quality: 95 })
          .toBuffer()
      );

      parsed = await generateJSON<any>({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: '이 구술면접 시험지의 모든 제시문과 문제를 추출해주세요. JSON만 반환.',
        images: [{ base64: imageBuffer.toString('base64'), mimeType: 'image/jpeg' }],
        responseSchema: EXAM_PARSE_SCHEMA,
      });
    } else {
      // PDF (또는 기타): base64로 전달
      parsed = await generateJSON<any>({
        systemPrompt: EXAM_PARSE_SYSTEM_PROMPT,
        prompt: '이 구술면접 PDF의 모든 제시문과 문제를 추출해주세요. JSON만 반환.',
        pdfBase64: buffer.toString('base64'),
        responseSchema: EXAM_PARSE_SCHEMA,
      });
    }

    // 파싱된 텍스트로 예시답안 생성
    let examText = '';
    for (const p of parsed.passages || []) {
      examText += `제시문 ${p.label}\n${p.text}\n\n`;
    }
    for (const q of parsed.questions || []) {
      examText += `문제 ${q.number}: ${q.text}\n\n`;
    }

    const result = await generateJSON({
      prompt: buildOralExamPrompt({ examText, university, year, session }),
      responseSchema: ORAL_EXAM_SCHEMA,
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
