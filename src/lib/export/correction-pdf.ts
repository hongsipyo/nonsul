/**
 * 첨삭 결과 PDF 내보내기
 * jsPDF + Pretendard 폰트
 */

import jsPDF from 'jspdf';

async function loadPretendardFont(doc: jsPDF) {
  const [regularBuf, boldBuf] = await Promise.all([
    fetch('/fonts/Pretendard-Regular.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/Pretendard-Bold.ttf').then((r) => r.arrayBuffer()),
  ]);

  const toBase64 = (buf: ArrayBuffer) => {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  doc.addFileToVFS('Pretendard-Regular.ttf', toBase64(regularBuf));
  doc.addFont('Pretendard-Regular.ttf', 'Pretendard', 'normal');
  doc.addFileToVFS('Pretendard-Bold.ttf', toBase64(boldBuf));
  doc.addFont('Pretendard-Bold.ttf', 'Pretendard', 'bold');
  doc.setFont('Pretendard', 'normal');
}

interface CorrectionPDFData {
  studentName: string;
  studentSchool?: string;
  examTitle: string;
  university?: string;
  totalScore?: number;
  grade?: string;
  answerOutline?: string;
  marginComments?: {
    text: string;
    type: 'praise' | 'improvement' | 'error' | 'suggestion';
  }[];
  scores?: {
    question_number: number;
    point_scores: { name: string; earned: number; max: number; notes?: string }[];
    deductions: { name: string; count: number; deduction: number }[];
    subtotal: number;
  }[];
  strengths?: string;
  improvements?: string;
  summary?: string;
  brand?: '프로세스' | '독립';
}

const TYPE_LABELS: Record<string, string> = {
  praise: '칭찬',
  improvement: '개선',
  error: '오류',
  suggestion: '제안',
};

const TYPE_COLORS: Record<string, [number, number, number]> = {
  praise: [22, 163, 74],      // green
  improvement: [37, 99, 235],  // blue
  error: [220, 38, 38],       // red
  suggestion: [217, 119, 6],   // amber
};

export async function generateCorrectionPDF(data: CorrectionPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadPretendardFont(doc);

  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > 280) {
      doc.addPage();
      y = margin;
    }
  }

  function drawLine() {
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 4;
  }

  // ========== HEADER ==========
  // Brand
  if (data.brand === '프로세스') {
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(255, 119, 0);
    doc.text('프로세스 논술학원', margin, y);
    y += 4;
  }

  // Title
  doc.setFont('Pretendard', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(0, 0, 0);
  doc.text('첨삭 결과', margin, y + 6);
  y += 12;
  doc.setFont('Pretendard', 'normal');

  // Student info (점수/등급은 학생용 PDF에 포함하지 않음)
  doc.setFontSize(11);
  doc.setTextColor(80, 80, 80);
  const infoLine = [
    data.studentName,
    data.studentSchool,
    data.examTitle,
    data.university,
  ].filter(Boolean).join(' | ');
  doc.text(infoLine, margin, y);
  y += 8;

  drawLine();

  // ========== ANSWER OUTLINE ==========
  if (data.answerOutline) {
    checkPage(20);
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('학생 답안 전개 요약', margin, y);
    y += 6;

    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const outlineLines = doc.splitTextToSize(data.answerOutline, contentWidth);
    doc.text(outlineLines, margin, y);
    y += outlineLines.length * 5 + 6;
    drawLine();
  }

  // 점수/채점 상세는 학생용 PDF에 포함하지 않음 (선생님이 웹에서만 확인)

  // ========== COMMENTS ==========
  if (data.marginComments && data.marginComments.length > 0) {
    checkPage(15);
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text(`코멘트 (${data.marginComments.length}개)`, margin, y);
    y += 7;

    for (const comment of data.marginComments) {
      checkPage(12);
      const color = TYPE_COLORS[comment.type] || [100, 100, 100];
      const label = TYPE_LABELS[comment.type] || comment.type;

      // Type badge
      doc.setFontSize(8);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(`[${label}]`, margin, y);

      // Comment text
      doc.setFont('Pretendard', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(40, 40, 40);
      const commentLines = doc.splitTextToSize(comment.text, contentWidth - 15);
      doc.text(commentLines, margin + 15, y);
      y += Math.max(commentLines.length * 4.5, 5) + 2;
    }
    drawLine();
  }

  // ========== STRENGTHS ==========
  if (data.strengths) {
    checkPage(20);
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(22, 163, 74);
    doc.text('잘한 부분', margin, y);
    y += 6;

    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const strengthLines = doc.splitTextToSize(data.strengths, contentWidth);
    doc.text(strengthLines, margin, y);
    y += strengthLines.length * 5 + 6;
  }

  // ========== IMPROVEMENTS ==========
  if (data.improvements) {
    checkPage(20);
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(37, 99, 235);
    doc.text('개선 포인트', margin, y);
    y += 6;

    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    const improvementLines = doc.splitTextToSize(data.improvements, contentWidth);
    doc.text(improvementLines, margin, y);
    y += improvementLines.length * 5 + 6;
  }

  // ========== SUMMARY ==========
  if (data.summary) {
    checkPage(25);
    drawLine();
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 0, 0);
    doc.text('종합 총평', margin, y);
    y += 6;

    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);
    const summaryLines = doc.splitTextToSize(data.summary, contentWidth);
    doc.text(summaryLines, margin, y);
    y += summaryLines.length * 5 + 6;
  }

  // ========== FOOTER ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(
      `${i} / ${totalPages}`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
    if (data.brand === '프로세스') {
      doc.text('프로세스 논술학원', pageWidth - margin, 290, { align: 'right' });
    }
  }

  return doc;
}
