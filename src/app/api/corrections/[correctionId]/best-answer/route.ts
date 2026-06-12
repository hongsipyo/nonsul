import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// 우수답안 지정/해제 (토글). 반당 1개 = 같은 시험(회차)의 기존 우수답안은 자동 해제.
// best_answer_text(OCR 전문)를 함께 넘기면 저장.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ correctionId: string }> }
) {
  const { correctionId } = await params;
  let body: { best_answer_text?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* 본문 없어도 됨 */
  }

  const supabase = await createClient();

  const { data: corr, error } = await supabase
    .from('corrections')
    .select('id, exam_id, is_best_answer')
    .eq('id', correctionId)
    .single();
  if (error || !corr) return NextResponse.json({ error: '첨삭을 찾을 수 없습니다' }, { status: 404 });

  const makeBest = !corr.is_best_answer;

  if (makeBest) {
    // 같은 시험의 기존 우수답안 해제 (반당/회차당 1개)
    await supabase
      .from('corrections')
      .update({ is_best_answer: false })
      .eq('exam_id', corr.exam_id)
      .eq('is_best_answer', true);

    const { error: upErr } = await supabase
      .from('corrections')
      .update({
        is_best_answer: true,
        best_answer_at: new Date().toISOString(),
        ...(body.best_answer_text ? { best_answer_text: body.best_answer_text } : {}),
      })
      .eq('id', correctionId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  } else {
    const { error: upErr } = await supabase
      .from('corrections')
      .update({ is_best_answer: false })
      .eq('id', correctionId);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  return NextResponse.json({ is_best_answer: makeBest });
}
