/**
 * 채점기준표 PDF 내보내기
 * 프로세스 논술학원 채점기준표 형식 기준
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

interface ScoringPoint {
  category: string;
  name: string;
  points: number;
  checklist?: string[];
}

interface DeductionItem {
  name: string;
  condition?: string;
  deduction: number;
}

interface RubricItem {
  question_number: number;
  total_points: number;
  scoring_points: ScoringPoint[];
  deduction_items?: DeductionItem[];
}

interface GlobalDeduction {
  name: string;
  per_instance?: number;
  max_deduction?: number;
}

interface RubricPDFData {
  examTitle: string;
  university?: string;
  items: RubricItem[];
  globalDeductions?: GlobalDeduction[];
  brand?: '프로세스' | '독립';
}

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  '보편적': [37, 99, 235],    // blue
  '기초': [22, 163, 74],      // green
  '심화': [147, 51, 234],     // purple
};

export async function generateRubricPDF(data: RubricPDFData): Promise<jsPDF> {
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

  const accentColor: [number, number, number] = data.brand === '프로세스' ? [255, 119, 0] : [37, 99, 235];
  const brandName = data.brand === '프로세스' ? '프로세스 논술' : '독립 논술';

  // ========== 헤더 ==========
  // 상단 악센트 라인
  doc.setFillColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.rect(0, 0, pageWidth, 3, 'F');

  y = margin + 2;

  // 브랜드
  doc.setFont('Pretendard', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.text(brandName, margin, y);
  y += 6;

  // 제목
  doc.setFont('Pretendard', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(30, 30, 30);
  doc.text('채점기준표', margin, y);
  y += 10;

  // 시험명
  doc.setFont('Pretendard', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(80, 80, 80);
  const titleLine = [data.examTitle, data.university].filter(Boolean).join(' — ');
  doc.text(titleLine, margin, y);
  y += 10;

  // 구분선
  doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  doc.setLineWidth(0.2);
  y += 8;

  // ========== 문제별 채점기준 ==========
  for (const item of data.items) {
    checkPage(40);

    // 문제 헤더 (배경 박스)
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(margin, y - 2, contentWidth, 12, 2, 2, 'F');

    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text(`문제 ${item.question_number}`, margin + 4, y + 6);

    // 총점
    doc.setFontSize(13);
    doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
    doc.text(`${item.total_points}점`, pageWidth - margin - 4, y + 6, { align: 'right' });
    y += 16;

    // 득점포인트 테이블 헤더
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(120, 120, 120);

    const colX = {
      category: margin + 2,
      name: margin + 25,
      points: pageWidth - margin - 25,
      checklist: margin + 25,
    };

    doc.text('구분', colX.category, y);
    doc.text('득점포인트', colX.name, y);
    doc.text('배점', colX.points, y);
    y += 2;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // 득점포인트 항목
    for (const sp of item.scoring_points) {
      checkPage(20);

      const catColor = CATEGORY_COLORS[sp.category] || [100, 100, 100];

      // 카테고리 뱃지
      doc.setFont('Pretendard', 'normal');
      doc.setFontSize(8);
      doc.setFillColor(catColor[0], catColor[1], catColor[2]);
      const catWidth = doc.getTextWidth(sp.category) + 4;
      doc.roundedRect(colX.category, y - 3.5, catWidth, 5, 1, 1, 'F');
      doc.setTextColor(255, 255, 255);
      doc.text(sp.category, colX.category + 2, y);

      // 포인트명
      doc.setFont('Pretendard', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(40, 40, 40);
      doc.text(sp.name, colX.name, y);

      // 배점
      doc.setFont('Pretendard', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text(`${sp.points}점`, colX.points, y);
      y += 6;

      // 체크리스트
      if (sp.checklist && sp.checklist.length > 0) {
        doc.setFont('Pretendard', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(80, 80, 80);

        for (const check of sp.checklist) {
          checkPage(8);
          doc.text('□', colX.checklist + 2, y);
          const checkLines = doc.splitTextToSize(check, contentWidth - 35);
          doc.text(checkLines, colX.checklist + 8, y);
          y += checkLines.length * 4.5 + 1;
        }
      }

      y += 2;
    }

    // 감점 항목
    if (item.deduction_items && item.deduction_items.length > 0) {
      checkPage(15);
      y += 2;

      doc.setFont('Pretendard', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(220, 38, 38);
      doc.text('감점 요소', margin + 2, y);
      y += 5;

      for (const d of item.deduction_items) {
        checkPage(8);
        doc.setFont('Pretendard', 'normal');
        doc.setFontSize(9);

        // 감점명
        doc.setTextColor(60, 60, 60);
        doc.text(`• ${d.name}`, margin + 4, y);

        // 조건
        if (d.condition) {
          const condLines = doc.splitTextToSize(d.condition, contentWidth - 50);
          doc.setTextColor(120, 120, 120);
          doc.text(condLines, margin + 40, y);
        }

        // 감점 점수
        doc.setTextColor(220, 38, 38);
        doc.text(`${d.deduction}점`, pageWidth - margin - 4, y, { align: 'right' });
        y += 6;
      }
    }

    y += 6;
    doc.setDrawColor(200, 200, 200);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  }

  // ========== 공통 감점 ==========
  if (data.globalDeductions && data.globalDeductions.length > 0) {
    checkPage(30);

    doc.setFillColor(255, 245, 245);
    doc.roundedRect(margin, y - 2, contentWidth, 10, 2, 2, 'F');
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(220, 38, 38);
    doc.text('공통 감점 사항', margin + 4, y + 5);
    y += 14;

    for (const gd of data.globalDeductions) {
      checkPage(8);
      doc.setFont('Pretendard', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`• ${gd.name}`, margin + 4, y);

      let detail = '';
      if (gd.per_instance) detail += `건당 ${gd.per_instance}점`;
      if (gd.max_deduction) detail += (detail ? ', ' : '') + `최대 ${gd.max_deduction}점`;

      if (detail) {
        doc.setTextColor(220, 38, 38);
        doc.text(detail, pageWidth - margin - 4, y, { align: 'right' });
      }
      y += 7;
    }
  }

  // ========== 페이지 번호 + 푸터 ==========
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(160, 160, 160);
    doc.text(`${i} / ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
    doc.text(brandName, pageWidth - margin, 290, { align: 'right' });
  }

  return doc;
}
