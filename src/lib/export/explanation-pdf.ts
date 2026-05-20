/**
 * 해설지 PDF 내보내기
 * 프로세스 논술학원 해설지 형식 기준
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

interface ExplanationSection {
  type: string;
  question_number?: number;
  passage_label?: string;
  content: string;
  word_count?: number;
}

interface ExplanationPDFData {
  examTitle: string;
  university?: string;
  year?: string;
  className?: string;
  lessonNumber?: string;
  sections: ExplanationSection[];
  brand?: '프로세스' | '독립';
}

const SECTION_COLORS: Record<string, [number, number, number]> = {
  '논제분석': [37, 99, 235],     // blue
  '제시문분석': [22, 163, 74],   // green
  '문제해결': [147, 51, 234],    // purple
  '예시답안': [220, 38, 38],     // red
  '요약연습': [217, 119, 6],     // amber
};

export async function generateExplanationPDF(data: ExplanationPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadPretendardFont(doc);

  const pageWidth = 210;
  const margin = 18;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  function checkPage(needed: number) {
    if (y + needed > 275) {
      doc.addPage();
      y = margin;
    }
  }

  function drawLine(color: [number, number, number] = [220, 220, 220]) {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
  }

  // ========== 표지 ==========
  // 배경 (프로세스: 오렌지 악센트)
  const accentColor: [number, number, number] = data.brand === '프로세스' ? [255, 119, 0] : [37, 99, 235];

  // 상단 악센트 라인
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // 표지 레이아웃
  y = 80;

  // 학년도/반 정보
  if (data.year || data.className) {
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(12);
    doc.setTextColor(140, 140, 140);
    const subInfo = [data.year, data.className, data.lessonNumber].filter(Boolean).join(' | ');
    doc.text(subInfo, pageWidth / 2, y, { align: 'center' });
    y += 12;
  }

  // 시험 제목
  doc.setFont('Pretendard', 'bold');
  doc.setFontSize(28);
  doc.setTextColor(30, 30, 30);
  const titleLines = doc.splitTextToSize(data.examTitle, contentWidth);
  doc.text(titleLines, pageWidth / 2, y, { align: 'center' });
  y += titleLines.length * 12 + 8;

  // "해설"
  doc.setFontSize(20);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text('해설', pageWidth / 2, y, { align: 'center' });
  y += 15;

  // 대학교
  if (data.university) {
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(14);
    doc.setTextColor(100, 100, 100);
    doc.text(data.university, pageWidth / 2, y, { align: 'center' });
    y += 10;
  }

  // 브랜드
  const brandName = data.brand === '프로세스' ? '프로세스 논술' : '독립 논술';
  doc.setFontSize(11);
  doc.setTextColor(160, 160, 160);
  doc.text(brandName, pageWidth / 2, 260, { align: 'center' });

  // 유의사항 (뒷면 대용)
  doc.addPage();
  y = margin + 30;
  doc.setFont('Pretendard', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(100, 100, 100);
  const notice = '정답의 확인보다 \'문제 해결 과정\'에 주목해야 합니다.\n복습 과정에서 해체를 세밀하게 하고, 예시답안의 서술 구조를 이해하세요.';
  const noticeLines = doc.splitTextToSize(notice, contentWidth - 20);
  // 박스
  doc.setFillColor(248, 248, 248);
  doc.roundedRect(margin, y - 8, contentWidth, noticeLines.length * 6 + 16, 3, 3, 'F');
  doc.text(noticeLines, margin + 10, y);
  y += noticeLines.length * 6 + 20;

  // ========== 본문 섹션 ==========
  doc.addPage();
  y = margin;

  for (const section of data.sections) {
    const color = SECTION_COLORS[section.type] || [60, 60, 60];

    // 섹션 헤더
    checkPage(25);

    // 악센트 바
    doc.setFillColor(color[0], color[1], color[2]);
    doc.rect(margin, y, 3, 8, 'F');

    // 섹션 타입
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(color[0], color[1], color[2]);

    let sectionTitle = section.type;
    if (section.question_number) sectionTitle += ` — 문제 ${section.question_number}`;
    if (section.passage_label) sectionTitle += ` — ${section.passage_label}`;

    doc.text(sectionTitle, margin + 6, y + 6);
    y += 14;

    // 분량 표시 (예시답안)
    if (section.word_count) {
      doc.setFont('Pretendard', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(160, 160, 160);
      doc.text(`${section.word_count}자`, pageWidth - margin, y - 8, { align: 'right' });
    }

    // 본문 내용 — 마크다운 텍스트를 줄 단위로 렌더링
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(40, 40, 40);

    const lines = section.content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        y += 3;
        continue;
      }

      // 마크다운 헤딩 처리
      if (trimmed.startsWith('### ')) {
        checkPage(12);
        doc.setFont('Pretendard', 'bold');
        doc.setFontSize(11);
        doc.setTextColor(60, 60, 60);
        const headingText = trimmed.replace(/^###\s+/, '');
        doc.text(headingText, margin + 2, y);
        y += 6;
        doc.setFont('Pretendard', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        continue;
      }

      if (trimmed.startsWith('## ')) {
        checkPage(14);
        doc.setFont('Pretendard', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(50, 50, 50);
        const headingText = trimmed.replace(/^##\s+/, '');
        doc.text(headingText, margin + 2, y);
        y += 7;
        doc.setFont('Pretendard', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(40, 40, 40);
        continue;
      }

      // 볼드 마크다운 (**text**) 제거 (jsPDF에서 인라인 볼드 처리 한계)
      const cleanLine = trimmed.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');

      // 불릿 리스트
      const isBullet = cleanLine.startsWith('- ') || cleanLine.startsWith('• ');
      const isNumbered = /^\d+[\.\)]\s/.test(cleanLine);

      let textX = margin + 2;
      let printText = cleanLine;
      let textWidth = contentWidth - 4;

      if (isBullet) {
        checkPage(8);
        doc.text('•', margin + 2, y);
        textX = margin + 7;
        printText = cleanLine.replace(/^[-•]\s+/, '');
        textWidth = contentWidth - 9;
      } else if (isNumbered) {
        checkPage(8);
        const numMatch = cleanLine.match(/^(\d+[\.\)])\s/);
        if (numMatch) {
          doc.text(numMatch[1], margin + 2, y);
          textX = margin + 10;
          printText = cleanLine.replace(/^\d+[\.\)]\s+/, '');
          textWidth = contentWidth - 12;
        }
      }

      // ☆ / ★ 핵심 포인트 강조
      if (printText.includes('☆') || printText.includes('★')) {
        doc.setFont('Pretendard', 'bold');
        doc.setTextColor(220, 38, 38);
      }

      const wrapped = doc.splitTextToSize(printText, textWidth);
      checkPage(wrapped.length * 5);
      doc.text(wrapped, textX, y);
      y += wrapped.length * 5 + 1;

      // 색상 복원
      doc.setFont('Pretendard', 'normal');
      doc.setTextColor(40, 40, 40);
    }

    y += 6;
    drawLine();
  }

  // ========== 페이지 번호 + 푸터 ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);

    // 표지(1페이지)는 페이지 번호 생략
    if (i > 1) {
      doc.text(`${i - 1} / ${totalPages - 1}`, pageWidth / 2, 290, { align: 'center' });
    }

    // 브랜드 푸터
    doc.text(brandName, pageWidth - margin, 290, { align: 'right' });
  }

  return doc;
}
