import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getClaudeClient } from '@/lib/claude/client';
import { EXAM_PARSE_SYSTEM_PROMPT, buildExamParseUserPrompt } from '@/lib/claude/prompts/exam-parse';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;
  const supabase = await createClient();

  // 1. Get exam record
  const { data: exam, error } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (error || !exam) {
    return NextResponse.json({ error: '시험을 찾을 수 없습니다' }, { status: 404 });
  }

  // 2. Update status to parsing
  await supabase.from('exams').update({ status: 'parsing' }).eq('id', examId);

  try {
    // 3. Download PDF from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('exam-pdfs')
      .download(exam.original_pdf_path);

    if (downloadError || !fileData) {
      throw new Error('PDF 다운로드 실패');
    }

    // 4. Convert PDF to base64 for Claude Vision
    const buffer = Buffer.from(await fileData.arrayBuffer());
    const base64 = buffer.toString('base64');

    // 5. Call Claude Vision API
    const claude = getClaudeClient();
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      system: EXAM_PARSE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64,
              },
            },
            {
              type: 'text',
              text: buildExamParseUserPrompt(1),
            },
          ],
        },
      ],
    });

    // 6. Parse response
    const responseText = response.content
      .filter((block) => block.type === 'text')
      .map((block) => (block as any).text)
      .join('');

    // Extract JSON from response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('AI 응답에서 JSON을 찾을 수 없습니다');

    const parsed = JSON.parse(jsonMatch[0]);

    // 7. Update exam with parsed data
    const { error: updateError } = await supabase
      .from('exams')
      .update({
        parsed_passages: parsed.passages,
        parsed_questions: parsed.questions,
        parsed_metadata: parsed.metadata,
        status: 'parsed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', examId);

    if (updateError) throw updateError;

    return NextResponse.json({
      success: true,
      passages: parsed.passages?.length || 0,
      questions: parsed.questions?.length || 0,
    });
  } catch (err) {
    await supabase.from('exams').update({ status: 'error' }).eq('id', examId);
    const message = err instanceof Error ? err.message : '파싱 중 오류 발생';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
