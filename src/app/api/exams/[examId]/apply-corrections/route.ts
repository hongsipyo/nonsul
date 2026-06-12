import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ProofreadIssue {
  type: string;
  original: string;
  corrected: string;
  reason: string;
}

function applyCorrections(text: string, issues: ProofreadIssue[]): string {
  let result = text;
  // 긴 original부터 적용 (짧은 것이 긴 것의 부분일 수 있으므로)
  const sorted = [...issues].sort((a, b) => b.original.length - a.original.length);
  for (const issue of sorted) {
    if (issue.original && issue.corrected && issue.original !== issue.corrected) {
      result = result.split(issue.original).join(issue.corrected);
    }
  }
  return result;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ examId: string }> }
) {
  const { examId } = await params;

  let body: { issues: ProofreadIssue[]; target: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const { issues, target } = body;
  if (!issues?.length) {
    return NextResponse.json({ error: '교정 항목이 없습니다' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: exam } = await supabase
    .from('exams')
    .select('*')
    .eq('id', examId)
    .single();

  if (!exam) {
    return NextResponse.json({ error: '시험을 찾을 수 없습니다' }, { status: 404 });
  }

  try {
    if (target === 'OCR 파싱') {
      // parsed_passages 교정
      const correctedPassages = (exam.parsed_passages || []).map((p: any) => ({
        ...p,
        text: applyCorrections(p.text, issues),
      }));

      // parsed_questions 교정
      const correctedQuestions = (exam.parsed_questions || []).map((q: any) => ({
        ...q,
        text: applyCorrections(q.text, issues),
      }));

      const { error: updateError } = await supabase
        .from('exams')
        .update({
          parsed_passages: correctedPassages,
          parsed_questions: correctedQuestions,
        })
        .eq('id', examId);

      if (updateError) throw new Error(updateError.message);

      const applied = issues.filter(i => i.original !== i.corrected).length;
      return NextResponse.json({
        success: true,
        applied,
        message: `${applied}건 교정 반영 완료`,
      });
    }

    return NextResponse.json({ error: '지원하지 않는 교정 대상' }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '교정 반영 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
