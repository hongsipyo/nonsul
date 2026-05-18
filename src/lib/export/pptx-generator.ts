import PptxGenJS from 'pptxgenjs';
import type { Passage, Question } from '@/types/exam';

interface PptxOptions {
  title: string;
  teacher?: string;
  passages: Passage[];
  questions: Question[];
  brand: '프로세스' | '독립';
}

export function generateExamPptx(options: PptxOptions): PptxGenJS {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_16x9';

  const bgColor = '000000';
  const textColor = 'FFFFFF';
  const accentColor = 'FF7700';

  // ============================
  // Slide 1: Title
  // ============================
  const titleSlide = pptx.addSlide();
  titleSlide.background = { color: bgColor };

  titleSlide.addText(options.title, {
    x: 0.8,
    y: 2.0,
    w: 8.4,
    h: 1.5,
    fontSize: 32,
    fontFace: 'Pretendard',
    color: textColor,
    bold: true,
  });

  const teacher = options.teacher || '홍시표T';
  const passageLabels = options.passages.map((p) => p.label).join(' ');
  const questionLabels = options.questions.map((q) => `문제 ${q.number}`).join(' · ');

  titleSlide.addText(`${teacher}\n인문논술 | 제시문 ${passageLabels} / ${questionLabels}`, {
    x: 0.8,
    y: 3.5,
    w: 8.4,
    h: 1.0,
    fontSize: 16,
    fontFace: 'Pretendard',
    color: '999999',
  });

  if (options.brand === '프로세스') {
    titleSlide.addText('프로세스 논술학원', {
      x: 0.8,
      y: 5.0,
      w: 4,
      h: 0.4,
      fontSize: 12,
      color: accentColor,
    });
  }

  // ============================
  // Passage slides: 한 문단씩
  // ============================
  for (const passage of options.passages) {
    // Split passage into paragraphs
    const paragraphs = passage.text
      .split(/\n\n+/)
      .map((p) => p.trim())
      .filter(Boolean);

    for (let i = 0; i < paragraphs.length; i++) {
      const slide = pptx.addSlide();
      slide.background = { color: bgColor };

      // Label header
      slide.addText(`제시문 ${passage.label}`, {
        x: 0.8,
        y: 0.4,
        w: 8.4,
        h: 0.5,
        fontSize: 14,
        fontFace: 'Pretendard',
        color: accentColor,
        bold: true,
      });

      // Paragraph text
      slide.addText(paragraphs[i], {
        x: 0.8,
        y: 1.2,
        w: 8.4,
        h: 4.2,
        fontSize: 15,
        fontFace: 'Pretendard',
        color: textColor,
        lineSpacingMultiple: 1.5,
        valign: 'top',
      });

      // Page indicator
      if (paragraphs.length > 1) {
        slide.addText(`${i + 1}/${paragraphs.length}`, {
          x: 8.5,
          y: 5.2,
          w: 1,
          h: 0.3,
          fontSize: 10,
          color: '666666',
          align: 'right',
        });
      }
    }
  }

  // ============================
  // Question slides
  // ============================
  for (const question of options.questions) {
    const slide = pptx.addSlide();
    slide.background = { color: bgColor };

    slide.addText(`문제 ${question.number}`, {
      x: 0.8,
      y: 0.4,
      w: 8.4,
      h: 0.5,
      fontSize: 14,
      fontFace: 'Pretendard',
      color: accentColor,
      bold: true,
    });

    let questionText = question.text;
    if (question.wordLimit) {
      questionText += `\n\n(${question.wordLimit}자 내외)`;
    }

    slide.addText(questionText, {
      x: 0.8,
      y: 1.2,
      w: 8.4,
      h: 4.2,
      fontSize: 16,
      fontFace: 'Pretendard',
      color: textColor,
      lineSpacingMultiple: 1.5,
      valign: 'top',
    });
  }

  return pptx;
}
