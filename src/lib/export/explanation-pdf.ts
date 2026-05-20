/**
 * 해설지 PDF 내보내기
 * 프로세스 논술학원 실물 교재 형식
 *
 * 레이아웃:
 * - 표지: 학년도/반/강 + "해 설" + 대학 + 브랜드
 * - 유의사항 페이지
 * - 본문: 논제분석 개요표 → 제시문분석 → (문제별: 문제해결 → 채점기준표 → 예시답안)
 * - 매 페이지: 우상단 헤더, 좌측 세로 워터마크, 하단 페이지번호+브랜드
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

// ─── 타입 ───

interface OverviewQuestion {
  number: number;
  type: string;
  passages_used: string;
  key_concepts: string;
  word_limit?: number;
  analysis: string;
}

interface PassageAnalysis {
  label: string;
  core_argument: string;
  key_concepts: string[];
  relationship: string;
  thinking_type: string;
}

interface Solution {
  question_number: number;
  answer_structure: string;
  approach: string;
  criticism_tools?: string | null;
}

interface ScoringCriterion {
  question_number: number;
  total_points: number;
  items: { name: string; points: number; checklist: string[] }[];
  deductions?: { name: string; points: number }[];
}

interface ModelAnswer {
  question_number: number;
  content: string;
  word_count: number;
}

interface ExplanationData {
  overview: { questions: OverviewQuestion[] };
  passage_analyses: PassageAnalysis[];
  solutions: Solution[];
  scoring_criteria: ScoringCriterion[];
  model_answers: ModelAnswer[];
}

// 기존 sections 형식 호환 (fallback)
interface LegacySection {
  type: string;
  question_number?: number;
  passage_label?: string;
  content: string;
  word_count?: number;
}

export interface ExplanationPDFData {
  examTitle: string;
  university?: string;
  year?: string;
  className?: string;
  lessonNumber?: string;
  brand?: '프로세스' | '독립';
  // 새 형식
  overview?: ExplanationData['overview'];
  passage_analyses?: PassageAnalysis[];
  solutions?: Solution[];
  scoring_criteria?: ScoringCriterion[];
  model_answers?: ModelAnswer[];
  // 기존 형식 (호환)
  sections?: LegacySection[];
}

// ─── PDF 생성 ───

export async function generateExplanationPDF(data: ExplanationPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  await loadPretendardFont(doc);

  const PW = 210; // page width
  const PH = 297; // page height
  const ML = 20;  // margin left
  const MR = 18;  // margin right
  const MT = 24;  // margin top (본문 시작)
  const CW = PW - ML - MR; // content width
  let y = MT;

  const brandShort = '프로세스 논술';
  const brandFull = '프로세스 논술구술 전문학원';
  const headerRight = `${brandFull} | ${data.examTitle} 해설`;

  // ─── 유틸리티 ───

  function newPage() { doc.addPage(); y = MT; }

  function checkPage(needed: number) {
    if (y + needed > PH - 22) { newPage(); }
  }

  function setN(size = 10) {
    doc.setFont('Pretendard', 'normal'); doc.setFontSize(size); doc.setTextColor(30, 30, 30);
  }
  function setB(size = 10) {
    doc.setFont('Pretendard', 'bold'); doc.setFontSize(size); doc.setTextColor(30, 30, 30);
  }
  function setGray(size = 10) {
    doc.setFont('Pretendard', 'normal'); doc.setFontSize(size); doc.setTextColor(120, 120, 120);
  }

  function hline(x1: number, x2: number, atY: number, w = 0.3) {
    doc.setDrawColor(100, 100, 100); doc.setLineWidth(w); doc.line(x1, atY, x2, atY);
  }
  function hlineLight(x1: number, x2: number, atY: number) {
    doc.setDrawColor(200, 200, 200); doc.setLineWidth(0.2); doc.line(x1, atY, x2, atY);
  }

  /** 텍스트 줄바꿈 렌더링 (줄 단위), y 반환 */
  function renderText(text: string, x: number, startY: number, maxW: number, fontSize = 10, lineH = 4.8): number {
    setN(fontSize);
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      checkPage(lineH + 2);
      doc.text(line, x, y);
      y += lineH;
    }
    return y;
  }

  /** 섹션 제목 (실물 교재 스타일: 상단 굵은선 + 제목 + 하단 얇은선) */
  function sectionHeader(title: string) {
    checkPage(18);
    hline(ML, PW - MR, y, 0.6);
    y += 6;
    setB(13);
    doc.text(title, ML + 1, y);
    y += 3;
    hlineLight(ML, PW - MR, y);
    y += 6;
  }

  // ========== 1. 표지 ==========
  y = 50;

  if (data.year) {
    setB(16);
    doc.text(`${data.year}학년도 수시`, PW / 2, y, { align: 'center' });
    y += 22;
  }

  // 반/강 정보
  const classLine = [data.className, data.lessonNumber].filter(Boolean).join(' ');
  if (classLine) {
    setB(22);
    doc.text(classLine, PW / 2, y, { align: 'center' });
    y += 18;
  } else {
    setB(22);
    const tl = doc.splitTextToSize(data.examTitle, CW);
    doc.text(tl, PW / 2, y, { align: 'center' });
    y += tl.length * 10 + 18;
  }

  // "해 설"
  setB(20);
  doc.text('해  설', PW / 2, y, { align: 'center' });
  y += 20;

  hline(75, 135, y, 0.4);
  y += 12;

  if (data.university) {
    setGray(13);
    doc.text(data.university, PW / 2, y, { align: 'center' });
  }

  // 하단 브랜드
  setGray(10);
  doc.text(`ⓟ ${brandFull}`, PW / 2, 255, { align: 'center' });

  // ========== 2. 유의사항 ==========
  newPage();
  y = MT + 25;
  doc.setDrawColor(180, 180, 180); doc.setLineWidth(0.3);
  doc.rect(ML + 5, y - 7, CW - 10, 30);

  setB(10);
  doc.text('* 유의사항', ML + 10, y); y += 7;
  setN(10);
  doc.text('1. 정답의 확인보다 \'문제 해결 과정\'에 주목해야 합니다.', ML + 10, y); y += 5.5;
  doc.text('2. 복습 과정에서 해체를 세밀하게 하고, 예시답안의 서술 구조를 이해합시다.', ML + 10, y);

  // ========== 3. 본문 ==========
  // 새 형식인지 기존 형식인지 판별
  const isNewFormat = !!data.overview;

  if (isNewFormat) {
    // ─── 새 형식: 구조화된 데이터 ───
    const { overview, passage_analyses, solutions, scoring_criteria, model_answers } = data;

    // 3-1. 논제분석 개요표
    newPage();
    sectionHeader('논제분석');

    if (overview?.questions) {
      for (const q of overview.questions) {
        checkPage(40);
        setB(10.5);
        doc.text(`문제 ${q.number}`, ML + 1, y); y += 6;

        // 표 형태로 렌더링
        const rows: [string, string][] = [
          ['출제유형', q.type],
          ['제시문 배치', q.passages_used],
          ['핵심 키워드', q.key_concepts],
          ['분량 조건', q.word_limit ? `${q.word_limit}자` : '-'],
        ];

        const labelW = 30;
        const valueW = CW - labelW - 2;

        for (const [label, value] of rows) {
          checkPage(8);
          hlineLight(ML, PW - MR, y - 3);
          setB(9);
          doc.text(label, ML + 2, y);
          setN(9);
          const vLines = doc.splitTextToSize(value, valueW);
          doc.text(vLines, ML + labelW + 2, y);
          y += Math.max(vLines.length * 4.5, 5);
        }
        hlineLight(ML, PW - MR, y - 2);
        y += 4;

        // 분석
        setN(10);
        renderText(q.analysis, ML + 1, y, CW - 2);
        y += 6;
      }
    }

    // 3-2. 제시문분석
    if (passage_analyses?.length) {
      sectionHeader('제시문분석');

      for (const pa of passage_analyses) {
        checkPage(30);
        setB(11);
        doc.text(`제시문 ${pa.label}`, ML + 1, y); y += 6;

        setN(10);
        renderText(pa.core_argument, ML + 1, y, CW - 2);
        y += 2;

        setGray(9);
        doc.text(`핵심개념: ${pa.key_concepts.join(', ')}`, ML + 1, y); y += 5;
        doc.text(`관계: ${pa.relationship}`, ML + 1, y); y += 5;
        doc.text(`사고방식: ${pa.thinking_type}`, ML + 1, y); y += 8;
      }
    }

    // 3-3 ~ 3-5: 문제별 (문제해결 → 채점기준표 → 예시답안)
    const questionNumbers = [...new Set([
      ...(solutions || []).map((s) => s.question_number),
      ...(model_answers || []).map((a) => a.question_number),
    ])].sort();

    for (const qNum of questionNumbers) {
      const sol = solutions?.find((s) => s.question_number === qNum);
      const sc = scoring_criteria?.find((s) => s.question_number === qNum);
      const ans = model_answers?.find((a) => a.question_number === qNum);

      // 문제해결
      if (sol) {
        sectionHeader(`문제해결 — 문제 ${qNum}`);

        setB(10);
        doc.text('답안 구조', ML + 1, y); y += 5;
        setN(10);
        renderText(sol.answer_structure, ML + 1, y, CW - 2);
        y += 4;

        setB(10);
        doc.text('접근법', ML + 1, y); y += 5;
        setN(10);
        renderText(sol.approach, ML + 1, y, CW - 2);
        y += 2;

        if (sol.criticism_tools) {
          setB(10);
          doc.text('비판 도구', ML + 1, y); y += 5;
          setN(10);
          renderText(sol.criticism_tools, ML + 1, y, CW - 2);
        }
        y += 6;
      }

      // 채점기준표
      if (sc) {
        sectionHeader(`채점기준표 — 문제 ${qNum}`);

        setGray(9);
        doc.text(`총점: ${sc.total_points}점`, PW - MR, y - 9, { align: 'right' });

        // 표 헤더
        const colName = 70;
        const colPts = 15;
        const colCheck = CW - colName - colPts;

        hline(ML, PW - MR, y - 2, 0.4);
        setB(9);
        doc.text('항목', ML + 2, y);
        doc.text('배점', ML + colName + 2, y);
        doc.text('체크리스트', ML + colName + colPts + 2, y);
        y += 2;
        hline(ML, PW - MR, y, 0.4);
        y += 4;

        for (const item of sc.items) {
          checkPage(15);
          setN(9);
          const nameLines = doc.splitTextToSize(item.name, colName - 4);
          doc.text(nameLines, ML + 2, y);

          doc.text(`${item.points}`, ML + colName + 2, y);

          const checkText = item.checklist.join(' / ');
          const checkLines = doc.splitTextToSize(checkText, colCheck - 4);
          doc.text(checkLines, ML + colName + colPts + 2, y);

          const rowH = Math.max(nameLines.length, checkLines.length) * 4.2 + 2;
          y += rowH;
          hlineLight(ML, PW - MR, y - 1);
          y += 2;
        }

        // 감점 항목
        if (sc.deductions?.length) {
          y += 2;
          setB(9);
          doc.text('감점 항목', ML + 2, y); y += 5;
          setN(9);
          for (const d of sc.deductions) {
            checkPage(6);
            doc.text(`- ${d.name}: ${d.points}점`, ML + 4, y);
            y += 4.5;
          }
        }
        y += 6;
      }

      // 예시답안
      if (ans) {
        sectionHeader(`예시답안 — 문제 ${qNum}`);

        // 글자수 우측 표시
        setGray(9);
        doc.text(`${ans.word_count}자`, PW - MR, y - 9, { align: 'right' });

        setN(10);
        renderText(ans.content, ML + 1, y, CW - 2, 10, 5);
        y += 8;
      }
    }

  } else if (data.sections?.length) {
    // ─── 기존 형식 (sections 배열) fallback ───
    newPage();
    for (const section of data.sections) {
      let title = section.type;
      if (section.question_number) title += ` — 문제 ${section.question_number}`;
      if (section.passage_label) title += ` — ${section.passage_label}`;

      sectionHeader(title);

      if (section.word_count) {
        setGray(9);
        doc.text(`${section.word_count}자`, PW - MR, y - 9, { align: 'right' });
      }

      setN(10);
      const lines = section.content.split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) { y += 2.5; continue; }
        const clean = trimmed.replace(/^#{1,4}\s+/, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1');
        renderText(clean, ML + 1, y, CW - 2);
      }
      y += 8;
    }
  }

  // ========== 헤더/푸터/워터마크 ==========
  const totalPages = doc.getNumberOfPages();
  const coverPages = 2; // 표지 + 유의사항

  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);

    if (i <= coverPages) {
      // 표지/유의사항: 브랜드만
      setGray(8);
      doc.text(`ⓟ ${brandShort}`, PW - MR, PH - 10, { align: 'right' });
      continue;
    }

    // 우상단 헤더
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(160, 160, 160);
    doc.text(headerRight, PW - MR, 13, { align: 'right' });

    // 좌측 세로 워터마크
    doc.setFontSize(8);
    doc.setTextColor(210, 210, 210);
    doc.text(`ⓟ ${brandShort}`, 8, PH / 2, { angle: 90 });

    // 하단 좌: 페이지 번호
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(`${i - coverPages}`, ML, PH - 10);

    // 하단 우: 브랜드
    doc.text(`ⓟ ${brandShort}`, PW - MR, PH - 10, { align: 'right' });
  }

  return doc;
}
