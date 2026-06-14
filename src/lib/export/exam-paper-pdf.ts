/**
 * 수업자료(시험지) PDF 생성
 * 프로세스 논술학원 실물 시험지 형식 — 샘플 PDF와 동일하게
 *
 * 구조:
 * 1. 표지: 우상단 로고 이미지 + 학년도/대학/반+강/시험시간/하단 브랜드(로고+텍스트)
 * 2. 유의사항: 우상단 로고 + 페이지 하단 2/3에 유의사항
 * 3. 문항별: 우상단 로고 + 문항 헤더 + 지문 + 하단 푸터(오렌지라인+브랜드+페이지)
 * 4. 마지막: 상단 정보줄 + 중앙 대학명 + 하단 오렌지 배너(로고+텍스트)
 */

import jsPDF from 'jspdf';

const toBase64 = (buf: ArrayBuffer) => {
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

async function loadFonts(doc: jsPDF) {
  const [batangR, batangB, pretendR, pretendB] = await Promise.all([
    fetch('/fonts/KoPubBatang-Medium.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/KoPubBatang-Bold.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/Pretendard-Regular.ttf').then((r) => r.arrayBuffer()),
    fetch('/fonts/Pretendard-Bold.ttf').then((r) => r.arrayBuffer()),
  ]);
  // KoPub 바탕 — 시험지 본문 메인 폰트 (바탕체, 샘플과 유사)
  doc.addFileToVFS('KoPubBatang-Medium.ttf', toBase64(batangR));
  doc.addFont('KoPubBatang-Medium.ttf', 'KoPubBatang', 'normal');
  doc.addFileToVFS('KoPubBatang-Bold.ttf', toBase64(batangB));
  doc.addFont('KoPubBatang-Bold.ttf', 'KoPubBatang', 'bold');
  // Pretendard — 푸터/배너 등 보조 폰트
  doc.addFileToVFS('Pretendard-Regular.ttf', toBase64(pretendR));
  doc.addFont('Pretendard-Regular.ttf', 'Pretendard', 'normal');
  doc.addFileToVFS('Pretendard-Bold.ttf', toBase64(pretendB));
  doc.addFont('Pretendard-Bold.ttf', 'Pretendard', 'bold');
  doc.setFont('KoPubBatang', 'normal');
}

async function loadLogoPNG(): Promise<string> {
  const res = await fetch('/logos/process-logo.png');
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return 'data:image/png;base64,' + btoa(binary);
}

/** 임의 이미지 URL → dataURL (표/그래프 크롭 이미지 삽입용) */
async function imgUrlToDataUrl(url: string): Promise<string> {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return 'data:image/png;base64,' + btoa(binary);
}

interface Passage {
  label: string;
  text: string;
  source?: string;
  has_table?: boolean;
  has_graph?: boolean;
  page_image_url?: string;
  page_number?: number;
  figures?: { kind: string; caption?: string; url?: string }[];
}

interface Question {
  number: number | string;
  text: string;
  wordLimit?: number;
  points?: number;
  isSupplementary?: boolean;
}

export interface ExamPaperPDFData {
  examTitle: string;
  university?: string;
  year?: string;
  className?: string;
  lessonNumber?: string;
  examTime?: string;
  supplementTime?: string;
  passages: Passage[];
  questions: Question[];
  brand?: '프로세스' | '독립';
  teacherName?: string;
}

export async function generateExamPaperPDF(data: ExamPaperPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadFonts(doc);
  const logoDataUrl = await loadLogoPNG();

  const PW = 210;
  const PH = 297;
  const ML = 22;
  const MR = 20;
  const MT = 32; // 로고 아래 본문 시작
  const CW = PW - ML - MR;
  let y = MT;

  const ORANGE: [number, number, number] = [230, 120, 30];

  // 로고 이미지 크기 (원본 비율 230:50 = 4.6:1)
  const LOGO_W = 42;
  const LOGO_H = LOGO_W / 4.6;
  const LOGO_X = PW - MR - LOGO_W; // 우측 정렬
  const LOGO_Y = 10;

  function setN(size = 10.5) {
    doc.setFont('KoPubBatang', 'normal');
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 30);
  }
  function setB(size = 10.5) {
    doc.setFont('KoPubBatang', 'bold');
    doc.setFontSize(size);
    doc.setTextColor(30, 30, 30);
  }

  function addLogo() {
    doc.addImage(logoDataUrl, 'PNG', LOGO_X, LOGO_Y, LOGO_W, LOGO_H);
  }

  function newPage() {
    doc.addPage();
    y = MT;
  }

  function checkPage(needed: number) {
    if (y + needed > PH - 25) {
      newPage();
    }
  }

  /** 본문 텍스트 렌더링: 첫줄 들여쓰기 */
  function renderParagraph(text: string, indent = 4, fontSize = 10.5, lineH = 5.8) {
    setN(fontSize);
    const paragraphs = text.split('\n');
    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) {
        y += 3;
        continue;
      }

      const allLines = doc.splitTextToSize(trimmed, CW);

      // 첫 줄 들여쓰기
      if (allLines.length > 0) {
        checkPage(lineH + 2);
        doc.text(allLines[0], ML + indent, y);
        y += lineH;
      }
      for (let i = 1; i < allLines.length; i++) {
        checkPage(lineH + 2);
        doc.text(allLines[i], ML, y);
        y += lineH;
      }
    }
  }

  // ========== 1. 표지 ==========
  addLogo();

  // 학년도
  y = 68;
  setB(16);
  const yearText = data.year ? `${data.year}학년도 수시논술 대비` : '수시논술 대비';
  doc.text(yearText, PW / 2, y, { align: 'center' });

  // 대학교 + 반/강 (박스)
  y = 105;
  const uniText = data.university || data.examTitle;
  const classLine = [data.className, data.lessonNumber].filter(Boolean).join(' ');

  // 박스 크기 계산
  const boxPadH = 15;
  const boxPadV = 12;
  const boxContentH = classLine ? 55 : 35;
  const boxTop = y - boxPadV;
  const boxW = PW - 80;
  const boxX = (PW - boxW) / 2;

  // 박스 테두리
  doc.setDrawColor(30, 30, 30);
  doc.setLineWidth(0.8);
  doc.rect(boxX, boxTop, boxW, boxContentH, 'S');

  // 대학교 (큰 글씨)
  setB(32);
  doc.text(uniText, PW / 2, y + 12, { align: 'center' });

  // 반/강
  if (classLine) {
    setB(20);
    doc.text(classLine, PW / 2, y + 32, { align: 'center' });
  }

  // 시험 시간
  const boxBottom = boxTop + boxContentH;
  y = boxBottom + 25;
  if (data.examTime || data.supplementTime) {
    setN(11);
    doc.setTextColor(80, 80, 80);
    let timeText = '<시험 시간: ';
    if (data.examTime) timeText += data.examTime;
    if (data.supplementTime) timeText += ` + ${data.supplementTime}`;
    timeText += '>';
    doc.text(timeText, PW / 2, y, { align: 'center' });
  }

  // 하단 브랜드 영역: 로고 이미지 + 텍스트
  const brandY = 230;

  // 로고 이미지 (큰 버전, 중앙)
  const coverLogoW = 62;
  const coverLogoH = coverLogoW / 4.6;
  const coverLogoX = (PW - coverLogoW) / 2;
  doc.addImage(logoDataUrl, 'PNG', coverLogoX, brandY, coverLogoW, coverLogoH);

  // "논술구술 전문학원" 텍스트 (로고 아래)
  setB(13);
  doc.setTextColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  doc.text('논술구술 전문학원', PW / 2, brandY + coverLogoH + 6, { align: 'center' });

  // 웹사이트 + 지점
  setN(9);
  doc.setTextColor(100, 100, 100);
  doc.text('http://www.processnonsul.com  대치/평촌/목동/분당', PW / 2, brandY + coverLogoH + 13, { align: 'center' });

  // ========== 2. 유의사항 ==========
  newPage();
  addLogo();

  // 유의사항은 페이지 하단 2/3 위치에서 시작 (샘플과 동일)
  y = PH * 0.52;

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
      y += 5.8;
    }
    y += 1;
  }
  y += 5;
  setN(10);
  const supNote = '※ 90분 동안 본 문항 답안을 작성한 뒤, 30분 간 보충문제의 개요를 작성해보세요.';
  const supLines = doc.splitTextToSize(supNote, CW);
  for (const l of supLines) {
    doc.text(l, ML, y);
    y += 5.5;
  }

  // ========== 3. 본문 (문항 + 제시문) ==========
  // 문항을 본문/보충으로 분리
  const mainQuestions = data.questions.filter(q => !q.isSupplementary);
  const suppQuestions = data.questions.filter(q => q.isSupplementary);

  newPage();
  addLogo();

  // 지시문
  setN(10.5);
  doc.text('※ 다음을 읽고 물음에 답하시오.', ML, y);
  y += 10;

  // 각 문항 순서대로
  for (let qi = 0; qi < mainQuestions.length; qi++) {
    const q = mainQuestions[qi];

    // 첫 문항 외에는 새 페이지에서 시작
    if (qi > 0) {
      newPage();
      addLogo();
    }

    checkPage(20);

    // 문항 헤더
    setB(11);
    let qHeader = `[문항 ${q.number}]`;
    if (q.text) qHeader += ` ${q.text}`;
    if (q.wordLimit && q.points) {
      qHeader += ` (띄어쓰기 포함 ${q.wordLimit}자/${q.points}점)`;
    } else if (q.wordLimit) {
      qHeader += ` (띄어쓰기 포함 ${q.wordLimit}자)`;
    } else if (q.points) {
      qHeader += ` (${q.points}점)`;
    }

    const qLines = doc.splitTextToSize(qHeader, CW);
    for (const ql of qLines) {
      checkPage(6);
      doc.text(ql, ML, y);
      y += 6.5;
    }
    y += 6;

    // 첫 번째 문항에서 모든 제시문 출력
    if (qi === 0) {
      for (const p of data.passages) {
        checkPage(15);

        // 제시문 라벨
        setB(10.5);
        doc.text(p.label, ML, y);
        y += 6;

        // ★표/그래프 크롭 이미지 (figures) — 텍스트로 안 뜯고 원본 영역만. 없으면 page_image 폴백.
        const figUrls = (p.figures || []).map((f) => f.url).filter(Boolean) as string[];
        const imageUrls = figUrls.length ? figUrls : ((p.has_table || p.has_graph) && p.page_image_url ? [p.page_image_url] : []);
        for (const url of imageUrls) {
          try {
            const dataUrl = await imgUrlToDataUrl(url);
            const props = doc.getImageProperties(dataUrl);
            const maxW = CW - 8;
            let w = maxW;
            let h = (w * props.height) / props.width;
            const maxH = 130; // mm — 한 페이지 넘지 않게
            if (h > maxH) { h = maxH; w = (h * props.width) / props.height; }
            checkPage(h + 6);
            doc.addImage(dataUrl, 'PNG', ML + 4, y, w, h);
            y += h + 4;
          } catch (e) {
            console.error('제시문 이미지 삽입 실패:', e);
          }
        }

        // 제시문 본문
        renderParagraph(p.text);

        // 출처
        if (p.source) {
          y += 2;
          setN(9);
          doc.setTextColor(100, 100, 100);
          const srcLines = doc.splitTextToSize(`- ${p.source}`, CW - 5);
          for (const sl of srcLines) {
            doc.text(sl, ML + 5, y);
            y += 4.5;
          }
          setN(10.5);
        }

        y += 6;
      }
    }
  }

  // 보충문제가 있으면 새 페이지에서
  if (suppQuestions.length > 0) {
    newPage();
    addLogo();

    for (let si = 0; si < suppQuestions.length; si++) {
      const sq = suppQuestions[si];

      if (si > 0) {
        newPage();
        addLogo();
      }

      // 보충문제 안내
      if (si === 0) {
        setB(11);
        doc.text('[보충문제]: 30분 간 개요만 작성해볼 것.', ML, y);
        y += 10;
      }

      checkPage(20);

      // 문항 헤더
      setB(11);
      let sqHeader = '';
      if (sq.text) sqHeader = sq.text;
      if (sq.wordLimit && sq.points) {
        sqHeader += ` (띄어쓰기 포함 ${sq.wordLimit}자 / ${sq.points}점)`;
      }
      if (sqHeader) {
        const sqLines = doc.splitTextToSize(sqHeader, CW);
        for (const sl of sqLines) {
          checkPage(6);
          doc.text(sl, ML, y);
          y += 6.5;
        }
        y += 6;
      }

      // 보충문제 제시문이 있으면 (passages에 포함되지 않은 별도 텍스트)
      // → 현재 구조에선 passages에 모두 포함되어있으므로 생략
    }
  }

  // ========== 4. 마지막 페이지: 대학 이름 + 브랜드 배너 ==========
  newPage();
  addLogo();

  // 상단 구분선
  doc.setDrawColor(100, 100, 100);
  doc.setLineWidth(0.3);
  doc.line(ML, MT - 5, PW - MR, MT - 5);

  // 상단 좌: 강사/정보
  setN(9);
  doc.setTextColor(100, 100, 100);
  const teacher = data.teacherName || '홍시표T';
  const infoLine = [
    teacher,
    data.year ? `${data.year}학년도 수시대비` : '',
    '프로세스 논술',
    classLine,
  ]
    .filter(Boolean)
    .join(' ');
  doc.text(infoLine, ML, MT);

  // 중앙: 대학 이름 (크게)
  y = PH / 2 - 10;
  setB(30);
  doc.setTextColor(30, 30, 30);
  doc.text(data.university || data.examTitle, PW / 2, y, { align: 'center' });

  // 하단 브랜드 배너 (오렌지 배경 직사각형)
  const bannerH = 32;
  const bannerY = PH - 55;
  const bannerX = ML;
  const bannerW = CW;

  // 오렌지 배경
  doc.setFillColor(ORANGE[0], ORANGE[1], ORANGE[2]);
  // 둥근 모서리 효과: 그냥 사각형
  doc.rect(bannerX, bannerY, bannerW, bannerH, 'F');

  // 배너 좌측: 로고 이미지 (흰 배경 위)
  const bannerLogoW = 28;
  const bannerLogoH = bannerLogoW / 4.6;
  const bannerLogoX = bannerX + 5;
  const bannerLogoY = bannerY + (bannerH - bannerLogoH) / 2;
  // 로고 배경 흰색 영역
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(bannerLogoX - 2, bannerLogoY - 4, bannerLogoW + 4, bannerLogoH + 8, 2, 2, 'F');
  doc.addImage(logoDataUrl, 'PNG', bannerLogoX, bannerLogoY, bannerLogoW, bannerLogoH);

  // 배너 우측 텍스트
  const textX = bannerLogoX + bannerLogoW + 12;
  doc.setFont('Pretendard', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('수시 전략 수립 전문가 집단, 대입 실전 논·구술 최강', textX, bannerY + 10);

  doc.setFont('Pretendard', 'bold');
  doc.setFontSize(14);
  doc.text('프로세스 논·구술 & 수시 컨설팅', textX, bannerY + 19);

  doc.setFont('Pretendard', 'normal');
  doc.setFontSize(8);
  doc.text('www.processnonsul.com 대치/분당/목동/평촌', textX, bannerY + 26);

  // ========== 헤더/푸터 후처리 ==========
  const totalPages = doc.getNumberOfPages();
  const coverPages = 2; // 표지 + 유의사항

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    // 표지/유의사항은 이미 로고 찍음 → 본문/마지막에도 로고 보장
    // (addLogo는 페이지 생성 시 호출했으므로 여기서는 푸터만 처리)

    // 본문 페이지만 하단 처리 (표지, 유의사항, 마지막 페이지 제외)
    if (i > coverPages && i < totalPages) {
      const pageNum = i - coverPages;

      // 하단 오렌지 라인
      doc.setDrawColor(ORANGE[0], ORANGE[1], ORANGE[2]);
      doc.setLineWidth(1.0);
      doc.line(ML, PH - 14, PW - MR, PH - 14);

      // 하단 좌: 브랜드 텍스트
      doc.setFont('Pretendard', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(80, 80, 80);
      doc.text('과정중심 방법중심 과학적 논술교육 프로세스 논술학원', ML, PH - 9);

      // 하단 우: 페이지 번호
      doc.setFont('Pretendard', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`${pageNum}`, PW - MR, PH - 9, { align: 'right' });
    }
  }

  return doc;
}
