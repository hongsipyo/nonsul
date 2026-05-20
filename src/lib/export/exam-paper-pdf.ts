/**
 * 수업자료(시험지) PDF 생성
 * 프로세스 논술학원 실물 시험지 형식
 *
 * 구조:
 * 1. 표지: 학년도/대학/반+강/시험시간/브랜드
 * 2. 유의사항
 * 3. 문항별: 문항 헤더 + 지문(제시문 텍스트) + 문제
 * 4. 보충문제 (있으면)
 * 5. 마지막: 대학 이름 + 브랜드
 *
 * 매 페이지: 우상단 "ⓟ 프로세스 논술", 하단 브랜드+페이지번호+오렌지 라인
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
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };
  doc.addFileToVFS('Pretendard-Regular.ttf', toBase64(regularBuf));
  doc.addFont('Pretendard-Regular.ttf', 'Pretendard', 'normal');
  doc.addFileToVFS('Pretendard-Bold.ttf', toBase64(boldBuf));
  doc.addFont('Pretendard-Bold.ttf', 'Pretendard', 'bold');
  doc.setFont('Pretendard', 'normal');
}

interface Passage {
  label: string;
  text: string;
  source?: string;
}

interface Question {
  number: number | string;
  text: string;
  wordLimit?: number;
  points?: number;
}

export interface ExamPaperPDFData {
  examTitle: string;
  university?: string;
  year?: string;
  className?: string;
  lessonNumber?: string;
  examTime?: string; // "90분" 등
  supplementTime?: string; // "보충문항: 30분"
  passages: Passage[];
  questions: Question[];
  brand?: '프로세스' | '독립';
}

export async function generateExamPaperPDF(data: ExamPaperPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadPretendardFont(doc);

  const PW = 210;
  const PH = 297;
  const ML = 22; // margin left
  const MR = 20; // margin right
  const MT = 30; // margin top (본문, 우상단 로고 공간 확보)
  const CW = PW - ML - MR;
  let y = MT;

  const ORANGE: [number, number, number] = [230, 120, 30];
  const footerText = '과정중심 방법중심 과학적 논술교육 프로세스 논술학원';

  function setN(size = 10.5) {
    doc.setFont('Pretendard', 'normal'); doc.setFontSize(size); doc.setTextColor(30, 30, 30);
  }
  function setB(size = 10.5) {
    doc.setFont('Pretendard', 'bold'); doc.setFontSize(size); doc.setTextColor(30, 30, 30);
  }

  function newPage() { doc.addPage(); y = MT; }

  function checkPage(needed: number) {
    if (y + needed > PH - 28) { newPage(); }
  }

  /** 본문 텍스트 렌더링: 들여쓰기 + 양쪽정렬 느낌 */
  function renderParagraph(text: string, indent = 3, fontSize = 10.5, lineH = 5.5) {
    setN(fontSize);
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) { y += 3; continue; }

      // 첫 줄 들여쓰기
      const firstLineW = CW - indent;
      const restW = CW;

      const allLines = doc.splitTextToSize(trimmed, restW);

      // 첫 줄은 indent
      if (allLines.length > 0) {
        checkPage(lineH + 2);
        doc.text(allLines[0], ML + indent, y);
        y += lineH;
      }
      // 나머지 줄
      for (let i = 1; i < allLines.length; i++) {
        checkPage(lineH + 2);
        doc.text(allLines[i], ML, y);
        y += lineH;
      }
    }
  }

  // ========== 1. 표지 ==========
  y = 30;

  // 우상단 "ⓟ 프로세스 논술" (필기체 느낌은 폰트 한계로 일반 텍스트)
  doc.setFont('Pretendard', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.text('ⓟ 프로세스 논술', PW - MR, 25, { align: 'right' });

  // 학년도
  y = 65;
  setB(16);
  const yearText = data.year ? `${data.year}학년도 수시논술 대비` : '수시논술 대비';
  doc.text(yearText, PW / 2, y, { align: 'center' });

  // 대학교 + 반/강 (박스)
  y = 100;
  const boxTop = y - 5;

  // 대학교 (큰 글씨)
  setB(30);
  const uniText = data.university || data.examTitle;
  doc.text(uniText, PW / 2, y + 15, { align: 'center' });

  // 반/강
  const classLine = [data.className, data.lessonNumber].filter(Boolean).join(' ');
  if (classLine) {
    setB(20);
    doc.text(classLine, PW / 2, y + 35, { align: 'center' });
  }

  const boxBottom = y + (classLine ? 45 : 25);
  // 박스 테두리
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.5);
  doc.rect(40, boxTop, PW - 80, boxBottom - boxTop);

  // 시험 시간
  y = boxBottom + 20;
  if (data.examTime || data.supplementTime) {
    setN(11);
    doc.setTextColor(80, 80, 80);
    let timeText = '<시험 시간: ';
    if (data.examTime) timeText += data.examTime;
    if (data.supplementTime) timeText += ` + ${data.supplementTime}`;
    timeText += '>';
    doc.text(timeText, PW / 2, y, { align: 'center' });
  }

  // 하단 브랜드
  y = 235;
  doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.setLineWidth(0.8);
  doc.line(40, y, PW - 40, y);
  y += 8;

  setB(13);
  doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.text('ⓟ 프로세스 논술구술 전문학원', PW / 2, y, { align: 'center' });
  y += 7;
  setN(9);
  doc.setTextColor(100, 100, 100);
  doc.text('http://www.processnonsul.com  대치/평촌/목동/분당', PW / 2, y, { align: 'center' });

  // ========== 2. 유의사항 ==========
  newPage();
  y = PH / 2 - 20; // 페이지 중하단에 배치

  setB(11);
  doc.text('<수험생 유의사항>', ML, y);
  y += 8;

  setN(10.5);
  const notices = [
    '1. 시험 시간은 총 90분입니다.',
    '2. 무조건 시간내 답안을 완성해서 제출해야 합니다.',
    '3. 보충 문제는 문제 분석 및 개요작성만 하세요.',
    '4. 예시답안의 철저한 복습을 통해 정해진 자수내 답안구성 및 서술을 익히도록 합시다.',
  ];
  for (const n of notices) {
    const lines = doc.splitTextToSize(n, CW);
    for (const l of lines) {
      doc.text(l, ML, y);
      y += 5.5;
    }
    y += 1;
  }
  y += 4;
  setN(10);
  doc.text('※ 90분 동안 본 문항 답안을 작성한 뒤, 30분 간 보충문제의 개요를 작성해보세요.', ML, y);

  // ========== 3. 본문 (문항 + 제시문) ==========
  newPage();

  // 지시문
  setN(10.5);
  doc.text('※ 다음을 읽고 물음에 답하시오.', ML, y);
  y += 10;

  // 각 문항 순서대로
  for (let qi = 0; qi < data.questions.length; qi++) {
    const q = data.questions[qi];

    checkPage(20);

    // 문항 헤더
    setB(11);
    let qHeader = `[문항 ${q.number}] ${q.text}`;
    if (q.wordLimit) qHeader += ` (띄어쓰기 포함 ${q.wordLimit}자`;
    if (q.points) qHeader += `/${q.points}점)`;
    else if (q.wordLimit) qHeader += ')';

    const qLines = doc.splitTextToSize(qHeader, CW);
    for (const ql of qLines) {
      checkPage(6);
      doc.text(ql, ML, y);
      y += 6;
    }
    y += 6;

    // 해당 문항과 관련된 제시문 본문 (모든 제시문 출력)
    // 첫 번째 문항에서만 제시문 전체 출력 (중복 방지)
    if (qi === 0) {
      for (const p of data.passages) {
        checkPage(15);

        // 제시문 라벨
        setB(10.5);
        doc.text(p.label, ML, y);
        y += 6;

        // 제시문 본문
        renderParagraph(p.text);

        // 출처
        if (p.source) {
          y += 2;
          setN(9);
          doc.setTextColor(100, 100, 100);
          doc.text(`- ${p.source}`, ML + 5, y);
          setN(10.5);
          y += 3;
        }

        y += 6;
      }
    }

    // 문항 사이 간격
    if (qi < data.questions.length - 1) {
      y += 8;
      // 다음 문항은 새 페이지에서 시작 (제시문 있을 수 있음)
      newPage();
    }
  }

  // ========== 4. 마지막 페이지: 대학 이름 + 브랜드 ==========
  newPage();
  // 상단 구분선
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(ML, MT - 5, PW - MR, MT - 5);

  // 상단 좌: 강사/정보
  setN(9);
  doc.setTextColor(100, 100, 100);
  const infoLine = [data.year ? `${data.year}학년도 수시대비` : '', '프로세스 논술', classLine].filter(Boolean).join(' ');
  doc.text(infoLine, ML, MT);

  // 중앙: 대학 이름 (크게)
  y = PH / 2 - 20;
  setB(28);
  doc.setTextColor(30, 30, 30);
  doc.text(data.university || data.examTitle, PW / 2, y, { align: 'center' });

  // 하단 브랜드 배너 (오렌지 박스)
  const bannerY = PH - 55;
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.rect(ML, bannerY, CW, 28, 'F');

  doc.setFont('Pretendard', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('수시 전략 수립 전문가 집단, 대입 실전 논·구술 최강', PW / 2, bannerY + 7, { align: 'center' });

  doc.setFont('Pretendard', 'bold');
  doc.setFontSize(14);
  doc.text('프로세스 논·구술 & 수시 컨설팅', PW / 2, bannerY + 16, { align: 'center' });

  doc.setFont('Pretendard', 'normal');
  doc.setFontSize(8);
  doc.text('www.processnonsul.com 대치/분당/목동/평촌', PW / 2, bannerY + 23, { align: 'center' });

  // ========== 헤더/푸터 ==========
  const totalPages = doc.getNumberOfPages();
  const coverPages = 2; // 표지 + 유의사항

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // 우상단 로고 (모든 페이지)
    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
    doc.text('ⓟ 프로세스 논술', PW - MR, 18, { align: 'right' });

    // 본문 페이지만 하단 처리
    if (i > coverPages && i < totalPages) {
      const pageNum = i - coverPages;

      // 하단 오렌지 라인
      doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
      doc.setLineWidth(0.8);
      doc.line(ML, PH - 15, PW - MR, PH - 15);

      // 하단 좌: 브랜드 텍스트
      doc.setFont('Pretendard', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text(footerText, ML, PH - 10);

      // 하단 우: 페이지 번호
      doc.setFont('Pretendard', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`${pageNum}`, PW - MR, PH - 10, { align: 'right' });
    }
  }

  return doc;
}
