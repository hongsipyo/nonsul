import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateExplanationPDF, type ExplanationPDFData } from '@/lib/export/explanation-pdf';

// 서버사이드 렌더(fs 폰트·실로고) → Node 런타임
export const runtime = 'nodejs';

/**
 * 프로세스 양식 PDF 생성 엔드포인트 — 채팅·데스크탑·코워크(MCP generate_process_pdf)가 호출.
 * generated_materials의 저장된 자료(content JSON)를 실양식 PDF로 렌더 → corrected-files 버킷 저장 → URL 반환.
 * body: { type: '해설지', materialId }  (현재 해설지 지원, 채점기준표·첨삭은 후속 확장)
 */
export async function POST(req: NextRequest) {
  try {
    const { type, materialId } = (await req.json()) as { type?: string; materialId?: string };
    if (!materialId) {
      return NextResponse.json({ error: 'materialId가 필요합니다' }, { status: 400 });
    }
    // service_role 클라이언트 — MCP·코워크 등 외부(비로그인) 호출 허용. 선택적 시크릿 헤더 가드.
    const secret = process.env.PROCESS_PDF_SECRET;
    if (secret && req.headers.get('x-process-key') !== secret) {
      return NextResponse.json({ error: '인증 실패(x-process-key)' }, { status: 401 });
    }
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL as string,
      process.env.SUPABASE_SERVICE_ROLE_KEY as string,
    );

    if (type === '해설지' || type === undefined) {
      const { data: mat } = await supabase
        .from('generated_materials')
        .select('content, brand, exams(title, university, exam_year)')
        .eq('id', materialId)
        .single();

      if (!mat?.content) {
        return NextResponse.json({ error: '자료를 찾을 수 없거나 content가 비어 있습니다' }, { status: 404 });
      }

      const examRaw = mat.exams as unknown;
      const exam = ((Array.isArray(examRaw) ? examRaw[0] : examRaw) ?? {}) as Record<string, unknown>;
      const content = mat.content as Record<string, unknown>;
      const pdfData: ExplanationPDFData = {
        examTitle: (exam.title as string) || '시험',
        university: exam.university as string | undefined,
        year: exam.exam_year != null ? String(exam.exam_year) : undefined,
        brand: (mat.brand as '프로세스' | '독립') || '프로세스',
        overview: content.overview as ExplanationPDFData['overview'],
        passage_analyses: content.passage_analyses as ExplanationPDFData['passage_analyses'],
        solutions: content.solutions as ExplanationPDFData['solutions'],
        scoring_criteria: content.scoring_criteria as ExplanationPDFData['scoring_criteria'],
        model_answers: content.model_answers as ExplanationPDFData['model_answers'],
        sections: content.sections as ExplanationPDFData['sections'],
      };

      const doc = await generateExplanationPDF(pdfData);
      const ab = doc.output('arraybuffer');
      const path = `materials/${materialId}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('corrected-files')
        .upload(path, Buffer.from(ab), { contentType: 'application/pdf', upsert: true });
      if (upErr) {
        return NextResponse.json({ error: `버킷 업로드 실패: ${upErr.message}` }, { status: 500 });
      }
      const { data: urlData } = supabase.storage.from('corrected-files').getPublicUrl(path);
      await supabase.from('generated_materials').update({ file_path: path, file_url: urlData.publicUrl }).eq('id', materialId);

      return NextResponse.json({ url: urlData.publicUrl, path, type: '해설지' });
    }

    return NextResponse.json({ error: `지원하지 않는 type: ${type} (현재 '해설지'만 — 채점기준표·첨삭은 후속)` }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : '프로세스 PDF 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
