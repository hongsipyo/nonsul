import PptxGenJS from 'pptxgenjs';
import type { Passage, Question } from '@/types/exam';

interface PptxOptions {
  title: string;
  teacher?: string;
  passages: Passage[];
  questions: Question[];
  brand: '프로세스' | '독립';
  pageImageUrls?: Record<number, string>;
}

const BG = '000000';
const TEXT = 'FFFFFF';
const ACCENT = 'FF7700';
const DIM = '999999';

// 한 슬라이드에 들어갈 수 있는 대략적 글자 수 (fontSize 15, 1.5 line spacing)
const MAX_CHARS_PER_SLIDE = 320;

/**
 * 긴 텍스트를 문단 단위로 분할. 한 슬라이드에 넘치지 않게.
 */
function splitIntoParagraphChunks(text: string, maxChars: number): string[] {
  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = '';

  for (const para of paragraphs) {
    // 문단 하나가 이미 maxChars 넘으면 문장 단위로 쪼개기
    if (para.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = '';
      }
      // 문장 단위로 분할
      const sentences = para.match(/[^.!?。]+[.!?。]?\s*/g) || [para];
      let sentChunk = '';
      for (const sent of sentences) {
        if ((sentChunk + sent).length > maxChars && sentChunk) {
          chunks.push(sentChunk.trim());
          sentChunk = sent;
        } else {
          sentChunk += sent;
        }
      }
      if (sentChunk) current = sentChunk;
      continue;
    }

    if ((current + '\n\n' + para).length > maxChars && current) {
      chunks.push(current);
      current = para;
    } else {
      current = current ? current + '\n\n' + para : para;
    }
  }

  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [text];
}

export function generateExamPptx(options: PptxOptions): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  // ============================
  // Slide 1: Title
  // ============================
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: BG };

  titleSlide.addText(options.title, {
    x: 0.8, y: 2.0, w: 8.4, h: 1.5,
    fontSize: 32, fontFace: 'Pretendard', color: TEXT, bold: true,
  });

  const teacher = options.teacher || '홍시표T';
  const passageLabels = options.passages.map((p) => p.label).join(' ');
  const questionLabels = options.questions.map((q) => `문제 ${q.number}`).join(' · ');

  titleSlide.addText(`${teacher}\n인문논술 | 제시문 ${passageLabels} / ${questionLabels}`, {
    x: 0.8, y: 3.5, w: 8.4, h: 1.0,
    fontSize: 16, fontFace: 'Pretendard', color: DIM,
  });

  if (options.brand === '프로세스') {
    titleSlide.addText('프로세스 논술학원', {
      x: 0.8, y: 5.0, w: 4, h: 0.4, fontSize: 12, color: ACCENT,
    });
  }

  // ============================
  // Passage slides: 문단별 분할 + 표/그래프 이미지
  // ============================
  for (const passage of options.passages) {
    // 표/그래프가 있는 제시문: 원본 페이지 이미지 슬라이드 추가
    if ((passage.has_table || passage.has_graph) && passage.page_image_url) {
      const imgSlide = pptx.addSlide();
      imgSlide.background = { color: BG };

      imgSlide.addText(`제시문 ${passage.label} — 원본 (표/그래프 포함)`, {
        x: 0.8, y: 0.3, w: 8.4, h: 0.4,
        fontSize: 13, fontFace: 'Pretendard', color: ACCENT, bold: true,
      });

      // 페이지 이미지를 슬라이드에 삽입
      imgSlide.addImage({
        path: passage.page_image_url,
        x: 0.5, y: 0.9, w: 9.0, h: 4.5,
        sizing: { type: 'contain', w: 9.0, h: 4.5 },
      });
    }

    // 표가 있으면 markdown 표 전용 슬라이드
    if (passage.has_table && passage.table_markdown) {
      const tableSlide = pptx.addSlide();
      tableSlide.background = { color: BG };

      tableSlide.addText(`제시문 ${passage.label} — 표 데이터`, {
        x: 0.8, y: 0.3, w: 8.4, h: 0.4,
        fontSize: 13, fontFace: 'Pretendard', color: ACCENT, bold: true,
      });

      tableSlide.addText(passage.table_markdown, {
        x: 0.5, y: 1.0, w: 9.0, h: 4.3,
        fontSize: 12, fontFace: 'Pretendard', color: TEXT,
        lineSpacingMultiple: 1.4, valign: 'top',
      });
    }

    // 텍스트를 문단 단위로 분할 — 한 슬라이드에 넘치지 않게
    const chunks = splitIntoParagraphChunks(passage.text, MAX_CHARS_PER_SLIDE);

    for (let i = 0; i < chunks.length; i++) {
      const slide = pptx.addSlide();
      slide.background = { color: BG };

      // Label header
      slide.addText(`제시문 ${passage.label}`, {
        x: 0.8, y: 0.3, w: 8.4, h: 0.4,
        fontSize: 13, fontFace: 'Pretendard', color: ACCENT, bold: true,
      });

      // Paragraph text
      slide.addText(chunks[i], {
        x: 0.8, y: 1.0, w: 8.4, h: 4.4,
        fontSize: 15, fontFace: 'Pretendard', color: TEXT,
        lineSpacingMultiple: 1.5, valign: 'top',
      });

      // Page indicator
      if (chunks.length > 1) {
        slide.addText(`${i + 1}/${chunks.length}`, {
          x: 8.5, y: 5.2, w: 1, h: 0.3,
          fontSize: 10, color: '666666', align: 'right',
        });
      }
    }
  }

  // ============================
  // Question slides: 문제도 문단별 분할
  // ============================
  for (const question of options.questions) {
    let questionText = question.text;
    if (question.wordLimit) {
      questionText += `\n\n(${question.wordLimit}자 내외)`;
    }

    const chunks = splitIntoParagraphChunks(questionText, MAX_CHARS_PER_SLIDE);

    for (let i = 0; i < chunks.length; i++) {
      const slide = pptx.addSlide();
      slide.background = { color: BG };

      slide.addText(`문제 ${question.number}`, {
        x: 0.8, y: 0.3, w: 8.4, h: 0.4,
        fontSize: 13, fontFace: 'Pretendard', color: ACCENT, bold: true,
      });

      slide.addText(chunks[i], {
        x: 0.8, y: 1.0, w: 8.4, h: 4.4,
        fontSize: 16, fontFace: 'Pretendard', color: TEXT,
        lineSpacingMultiple: 1.5, valign: 'top',
      });

      if (chunks.length > 1) {
        slide.addText(`${i + 1}/${chunks.length}`, {
          x: 8.5, y: 5.2, w: 1, h: 0.3,
          fontSize: 10, color: '666666', align: 'right',
        });
      }
    }
  }

  return pptx;
}
