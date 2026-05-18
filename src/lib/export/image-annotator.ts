/**
 * 빨간펜 이미지 오버레이
 * 답안 이미지 위에 프로세스 첨삭 스타일로 마킹 + 여백 코멘트
 *
 * 프로세스 첨삭 스타일:
 * - 빨간색 여백 코멘트 (우측)
 * - 코멘트 연결선 (화살표)
 * - 칭찬 = 체크(√) + 초록계열
 * - 오류 = X 표시 + 빨간
 * - 개선 = 물결 밑줄 + 파란계열
 * - 하단 총평 박스 (빨간 테두리)
 */

export interface AnnotationComment {
  text: string;
  type: 'praise' | 'improvement' | 'error' | 'suggestion';
  y_position: number; // 0~1 normalized
}

export interface AnnotationOptions {
  answerOutline?: string;
  marginComments: AnnotationComment[];
  summary?: string;
  strengths?: string;
  improvements?: string;
  brand?: '프로세스' | '독립';
}

const TYPE_STYLES = {
  praise: { color: '#059669', marker: '√', bg: 'rgba(5, 150, 105, 0.08)' },
  improvement: { color: '#dc2626', marker: '→', bg: 'rgba(220, 38, 38, 0.06)' },
  error: { color: '#dc2626', marker: '✕', bg: 'rgba(220, 38, 38, 0.08)' },
  suggestion: { color: '#d97706', marker: '◆', bg: 'rgba(217, 119, 6, 0.06)' },
};

/**
 * 답안 이미지에 빨간펜 오버레이를 그린 Canvas를 반환
 */
export async function annotateImage(
  imageSrc: string,
  options: AnnotationOptions,
): Promise<HTMLCanvasElement> {
  const img = await loadImage(imageSrc);

  // 원본 이미지 + 우측 여백 (코멘트용) + 하단 여백 (총평용)
  const marginWidth = Math.max(380, img.width * 0.4);
  const summaryHeight = options.summary ? 280 : 0;
  const outlineHeight = options.answerOutline ? 80 : 0;
  const headerHeight = 50;

  const canvasWidth = img.width + marginWidth + 40; // 40 = padding
  const canvasHeight = headerHeight + img.height + summaryHeight + outlineHeight + 60;

  const canvas = document.createElement('canvas');
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Header bar
  ctx.fillStyle = '#fafafa';
  ctx.fillRect(0, 0, canvasWidth, headerHeight);
  ctx.strokeStyle = '#e4e4e7';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, headerHeight);
  ctx.lineTo(canvasWidth, headerHeight);
  ctx.stroke();

  if (options.brand === '프로세스') {
    ctx.fillStyle = '#ff7700';
    ctx.font = 'bold 14px Pretendard, sans-serif';
    ctx.fillText('프로세스 논술학원', 20, 30);
  }
  ctx.fillStyle = '#dc2626';
  ctx.font = 'bold 18px Pretendard, sans-serif';
  ctx.fillText('첨삭 결과', options.brand === '프로세스' ? 200 : 20, 32);

  const imgY = headerHeight + 10;

  // Draw answer image
  ctx.drawImage(img, 20, imgY);

  // Image border
  ctx.strokeStyle = '#d4d4d8';
  ctx.lineWidth = 1;
  ctx.strokeRect(20, imgY, img.width, img.height);

  // ===== ANSWER OUTLINE (이미지 위에 반투명 배너) =====
  if (options.answerOutline) {
    ctx.fillStyle = 'rgba(79, 70, 229, 0.9)';
    const bannerHeight = 60;
    ctx.fillRect(20, imgY, img.width, bannerHeight);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 13px Pretendard, sans-serif';
    ctx.fillText('학생 답안 전개 요약', 35, imgY + 20);
    ctx.font = '12px Pretendard, sans-serif';
    wrapText(ctx, options.answerOutline, 35, imgY + 38, img.width - 30, 16);
  }

  // ===== MARGIN COMMENTS =====
  const marginX = img.width + 50;
  const commentAreaTop = imgY + 10;
  const commentAreaHeight = img.height - 20;

  // Sort comments by y_position
  const sortedComments = [...options.marginComments].sort((a, b) => a.y_position - b.y_position);

  // Calculate comment positions (avoid overlap)
  const commentHeight = 60;
  const minGap = 8;
  const positions: number[] = [];

  for (let i = 0; i < sortedComments.length; i++) {
    const idealY = commentAreaTop + sortedComments[i].y_position * commentAreaHeight;
    let y = idealY;

    // Push down if overlapping previous
    if (i > 0 && positions[i - 1] + commentHeight + minGap > y) {
      y = positions[i - 1] + commentHeight + minGap;
    }

    // Don't overflow canvas
    y = Math.min(y, imgY + img.height - commentHeight);

    positions.push(y);
  }

  // Draw each comment
  sortedComments.forEach((comment, i) => {
    const y = positions[i];
    const style = TYPE_STYLES[comment.type] || TYPE_STYLES.improvement;
    const anchorY = commentAreaTop + comment.y_position * commentAreaHeight;

    // Connector line from image area to comment
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(img.width + 20, anchorY);
    ctx.lineTo(marginX - 5, y + 10);
    ctx.stroke();
    ctx.setLineDash([]);

    // Small marker on the image edge
    ctx.fillStyle = style.color;
    ctx.font = 'bold 16px Pretendard, sans-serif';
    ctx.fillText(style.marker, img.width + 5, anchorY + 5);

    // Comment background
    const textLines = wrapTextMeasure(ctx, comment.text, marginWidth - 40, '12px Pretendard, sans-serif');
    const boxHeight = Math.max(textLines.length * 17 + 20, 40);

    ctx.fillStyle = style.bg;
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 1.5;
    roundRect(ctx, marginX, y, marginWidth - 20, boxHeight, 6);
    ctx.fill();
    ctx.stroke();

    // Type label
    ctx.fillStyle = style.color;
    ctx.font = 'bold 10px Pretendard, sans-serif';
    const typeLabel = { praise: '칭찬', improvement: '개선', error: '오류', suggestion: '제안' }[comment.type];
    ctx.fillText(`[${typeLabel}]`, marginX + 8, y + 14);

    // Comment text
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px Pretendard, sans-serif';
    textLines.forEach((line, li) => {
      ctx.fillText(line, marginX + 8, y + 28 + li * 17);
    });
  });

  // ===== BOTTOM SUMMARY BOX (빨간 박스 — 프로세스 첨삭 하단 총평 스타일) =====
  if (options.summary) {
    const summaryY = imgY + img.height + 20;
    const summaryW = canvasWidth - 40;

    // Red border box
    ctx.strokeStyle = '#dc2626';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#fef2f2';
    roundRect(ctx, 20, summaryY, summaryW, summaryHeight - 20, 8);
    ctx.fill();
    ctx.stroke();

    // Title
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 15px Pretendard, sans-serif';
    ctx.fillText('★ 종합 총평', 35, summaryY + 25);

    // Strengths
    let textY = summaryY + 48;
    if (options.strengths) {
      ctx.fillStyle = '#059669';
      ctx.font = 'bold 12px Pretendard, sans-serif';
      ctx.fillText('잘한 부분:', 35, textY);
      ctx.fillStyle = '#374151';
      ctx.font = '12px Pretendard, sans-serif';
      const sLines = wrapTextMeasure(ctx, options.strengths, summaryW - 50, '12px Pretendard, sans-serif');
      sLines.forEach((line, i) => {
        ctx.fillText(line, 35, textY + 16 + i * 16);
      });
      textY += 16 + sLines.length * 16 + 10;
    }

    // Improvements
    if (options.improvements) {
      ctx.fillStyle = '#2563eb';
      ctx.font = 'bold 12px Pretendard, sans-serif';
      ctx.fillText('개선 포인트:', 35, textY);
      ctx.fillStyle = '#374151';
      ctx.font = '12px Pretendard, sans-serif';
      const iLines = wrapTextMeasure(ctx, options.improvements, summaryW - 50, '12px Pretendard, sans-serif');
      iLines.forEach((line, i) => {
        ctx.fillText(line, 35, textY + 16 + i * 16);
      });
      textY += 16 + iLines.length * 16 + 10;
    }

    // Summary text
    ctx.fillStyle = '#1f2937';
    ctx.font = '12px Pretendard, sans-serif';
    const sumLines = wrapTextMeasure(ctx, options.summary, summaryW - 50, '12px Pretendard, sans-serif');
    sumLines.forEach((line, i) => {
      ctx.fillText(line, 35, textY + i * 16);
    });
  }

  return canvas;
}

/**
 * Canvas → blob URL for download
 */
export async function annotateAndDownload(
  imageSrc: string,
  options: AnnotationOptions,
  filename: string,
): Promise<void> {
  const canvas = await annotateImage(imageSrc, options);

  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

// ===== Helpers =====

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string, x: number, y: number, maxWidth: number, lineHeight: number,
) {
  const words = text.split('');
  let line = '';
  let currentY = y;

  for (const char of words) {
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = char;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}

function wrapTextMeasure(
  ctx: CanvasRenderingContext2D,
  text: string, maxWidth: number, font: string,
): string[] {
  ctx.font = font;
  const lines: string[] = [];
  let line = '';

  for (const char of text) {
    if (char === '\n') {
      lines.push(line);
      line = '';
      continue;
    }
    const testLine = line + char;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = char;
    } else {
      line = testLine;
    }
  }
  if (line) lines.push(line);
  return lines;
}
