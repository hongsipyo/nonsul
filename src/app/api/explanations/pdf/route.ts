import { NextRequest, NextResponse } from 'next/server';
import { generateExplanationPDF, type ExplanationPDFData } from '@/lib/export/explanation-pdf';

// 서버사이드 렌더(fs 폰트·실로고 로딩) → Node 런타임 필수
export const runtime = 'nodejs';

/**
 * 해설지 PDF 서버 렌더 엔드포인트.
 * 웹앱 다운로드 버튼·MCP generate_process_pdf·데스크탑/채팅이 공유한다.
 * body = ExplanationPDFData → application/pdf 바이트 반환.
 */
export async function POST(req: NextRequest) {
  try {
    const data = (await req.json()) as ExplanationPDFData;
    if (!data || (!data.overview && !data.sections)) {
      return NextResponse.json({ error: '해설 데이터가 비어 있습니다' }, { status: 400 });
    }
    const doc = await generateExplanationPDF(data);
    const ab = doc.output('arraybuffer');
    const filename = encodeURIComponent(`${data.examTitle || '해설지'}_해설.pdf`);
    return new NextResponse(Buffer.from(ab), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : '해설지 PDF 생성 오류';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
