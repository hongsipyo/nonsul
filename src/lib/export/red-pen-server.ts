/**
 * 서버용 빨간펜 렌더러 (제미나이식 — 학생 원고지 위 직접 마킹)
 *
 * 브라우저 canvas(`document.createElement`)에 의존하지 않고
 * sharp + SVG 오버레이로 학생 답안 이미지 위에 빨간펜을 직접 합성한다.
 * Node 환경(API Route / MCP / 코워크)에서 동작 → 인쇄용 PNG/PDF 산출.
 *
 * 마킹 스타일(제미나이식):
 *   praise(칭찬)      → underline  : 빨강 밑줄 + 체크
 *   improvement(개선) → wave       : 빨강 물결 밑줄
 *   error(오류)       → circle     : 빨강 동그라미(타원)
 *   삭제              → strike      : 사선
 *   삽입              → insert      : ∨표시 + 위에 교정글씨
 *   체크만            → check       : ✓
 * 교정 글씨(correction)는 마킹 구절 옆·행간에 빨간 손글씨풍 작은 텍스트.
 * 좌표(box)가 없는 코멘트는 우측 여백에 번호 카드로 폴백.
 */

import sharp from 'sharp';
import { readFile } from 'fs/promises';
import { join } from 'path';
import type { MarginComment, RedPenMark } from '@/types/exam';
import { ensureFontconfig } from './font-setup';

const RED = '#d61f1f';
const RED_DARK = '#b01515';
const GREEN = '#0a8a4a';

// 여백(우측 코멘트 카드) 폭은 이미지 폭 대비 비율
const MARGIN_RATIO = 0.42;
const MARGIN_MIN = 360;

// ── 프로세스 원고지 양식2 격자 (배경 PNG 1654×2339 기준, 200dpi에서 실측) ──
// public/forms/wongoji.png = 실양식 원고지(로고·캘리 푸터·글자수 카운터 포함)
// 한 줄 25칸 × 30줄 = 750자. 학생 텍스트 답안을 이 칸에 직접 조판한다.
const WONGOJI_PATH = 'forms/wongoji.png';
const GRID = {
  bgW: 1654,
  bgH: 2339,
  x0: 86,            // 첫 글자칸 왼쪽 세로선 x
  xp: (1268 - 86) / 25, // 칸 가로 pitch ≈ 47.28
  cols: 25,
  y0: 347,           // 첫 줄 윗선 y
  rowp: 60,          // 줄 pitch (칸높이 47 + 줄간격 13)
  cellh: 47,         // 칸 높이
  rows: 30,
} as const;
// 본문 글자 폰트(경기천년바탕, 무료·실양식 폰트). public/fonts에 번들.
const MANUSCRIPT_FONT = "'GyeonggiBatang','경기천년바탕',serif";

interface Placed {
  ch: string;
  page: number; // 1-base
  row: number;  // 0-base
  col: number;  // 0-base
  idx: number;  // answerText 내 문자 인덱스(공백·줄바꿈 포함)
}

/**
 * 학생 텍스트 답안을 원고지 칸 좌표로 배치.
 * 규칙: 문장부호 한 칸, 공백 한 칸, '\n'은 줄바꿈. 빈 줄(연속 \n)은 문단 구분으로
 * 다음 문단 첫 칸을 한 칸 들여쓴다. 25칸 채우면 자동 줄넘김, 30줄 채우면 다음 페이지.
 */
function layoutManuscript(text: string): Placed[] {
  const placed: Placed[] = [];
  let page = 1, row = 0, col = 0;
  const advance = () => {
    col++;
    if (col >= GRID.cols) { col = 0; row++; }
    if (row >= GRID.rows) { row = 0; page++; }
  };
  const newline = () => {
    if (col === 0 && row === 0) return; // 선두 빈줄 무시
    col = 0; row++;
    if (row >= GRID.rows) { row = 0; page++; }
  };
  const norm = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ');
  let i = 0;
  let atParaStart = true; // 문단 시작이면 한 칸 들여쓰기
  while (i < norm.length) {
    const ch = norm[i];
    if (ch === '\n') {
      // 연속 줄바꿈 → 문단 구분
      let nl = 0;
      while (norm[i] === '\n') { nl++; i++; }
      newline();
      if (nl >= 2) atParaStart = true;
      continue;
    }
    if (atParaStart && col === 0) {
      advance(); // 들여쓰기 한 칸
      atParaStart = false;
    }
    placed.push({ ch, page, row, col, idx: i });
    advance();
    i++;
  }
  return placed;
}

/** placed 글자들을 (page,row) 단위 연속 칸 구간으로 묶어 마킹 좌표 산출 */
function spansForRange(placed: Placed[], startIdx: number, endIdx: number) {
  const hits = placed.filter((p) => p.idx >= startIdx && p.idx < endIdx);
  const spans: { page: number; row: number; c0: number; c1: number }[] = [];
  for (const p of hits) {
    const last = spans[spans.length - 1];
    if (last && last.page === p.page && last.row === p.row && p.col === last.c1 + 1) {
      last.c1 = p.col;
    } else {
      spans.push({ page: p.page, row: p.row, c0: p.col, c1: p.col });
    }
  }
  return spans;
}

export interface RedPenRenderOptions {
  comments: MarginComment[];
  answerOutline?: string;
  summary?: string;
  strengths?: string;
  improvements?: string;
  brand?: '프로세스' | '독립';
  studentName?: string;
  examTitle?: string;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** type → 기본 mark 매핑 (mark가 비어 있을 때) */
function defaultMark(type: MarginComment['type']): RedPenMark {
  switch (type) {
    case 'praise': return 'underline';
    case 'improvement': return 'wave';
    case 'error': return 'circle';
    case 'suggestion': return 'wave';
    default: return 'underline';
  }
}

/** 한글 폭 추정(문자 수 × 폰트크기) — SVG 줄바꿈용 */
function wrapByWidth(text: string, maxChars: number): string[] {
  const lines: string[] = [];
  for (const raw of text.split('\n')) {
    let line = '';
    for (const ch of raw) {
      if (line.length >= maxChars) {
        lines.push(line);
        line = '';
      }
      line += ch;
    }
    lines.push(line);
  }
  return lines;
}

/** 물결(wave) 밑줄 path 생성 */
function wavePath(x: number, y: number, w: number, amp = 3, step = 7): string {
  let d = `M ${x} ${y}`;
  let cx = x;
  let up = true;
  while (cx < x + w) {
    const nx = Math.min(cx + step, x + w);
    const midY = up ? y - amp : y + amp;
    d += ` Q ${(cx + nx) / 2} ${midY} ${nx} ${y}`;
    cx = nx;
    up = !up;
  }
  return d;
}

/**
 * 학생 답안 이미지(buffer) 위에 빨간펜 오버레이를 합성한 PNG buffer 반환.
 * @param imageBuffer 원본 학생 답안 이미지
 * @param pageComments 이 페이지에 그릴 코멘트
 * @param marginComments 우측 여백 카드용(좌표 없는 것). 비우면 자동 분리.
 */
export async function renderRedPenPage(
  imageBuffer: Buffer,
  pageComments: MarginComment[],
  opts: { brand?: '프로세스' | '독립'; studentName?: string; examTitle?: string } = {},
): Promise<Buffer> {
  const base = sharp(imageBuffer);
  const meta = await base.metadata();
  const imgW = meta.width ?? 1000;
  const imgH = meta.height ?? 1400;

  const marginW = Math.max(MARGIN_MIN, Math.round(imgW * MARGIN_RATIO));
  const headerH = 56;
  const pad = 24;
  const canvasW = imgW + marginW + pad * 2;
  const canvasH = headerH + imgH + pad * 2;

  // 좌표 있는 것 = 직접 마킹 / 없는 것 = 여백 카드
  const onImage = pageComments.filter((c) => c.box);
  const inMargin = pageComments.filter((c) => !c.box);

  const imgX = pad;
  const imgY = headerH + pad;

  // ── SVG 오버레이 구성 ──
  const parts: string[] = [];

  // 헤더
  parts.push(`<rect x="0" y="0" width="${canvasW}" height="${headerH}" fill="#fafafa"/>`);
  parts.push(`<line x1="0" y1="${headerH}" x2="${canvasW}" y2="${headerH}" stroke="#e4e4e7" stroke-width="1"/>`);
  if (opts.brand === '프로세스') {
    parts.push(`<text x="${pad}" y="34" font-family="sans-serif" font-size="18" font-weight="700" fill="#ff7700">프로세스 논술</text>`);
  }
  const titleX = opts.brand === '프로세스' ? 160 : pad;
  parts.push(`<text x="${titleX}" y="34" font-family="sans-serif" font-size="18" font-weight="700" fill="${RED}">첨삭 (빨간펜)</text>`);
  if (opts.studentName) {
    parts.push(`<text x="${canvasW - pad}" y="34" text-anchor="end" font-family="sans-serif" font-size="14" fill="#52525b">${escapeXml(opts.studentName)}${opts.examTitle ? ` · ${escapeXml(opts.examTitle)}` : ''}</text>`);
  }

  // 이미지 테두리
  parts.push(`<rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" fill="none" stroke="#d4d4d8" stroke-width="1"/>`);

  // ── 학생 글자 위 직접 마킹 ──
  for (const c of onImage) {
    const b = c.box!;
    const ax = imgX + b.x * imgW;
    const ay = imgY + b.y * imgH;
    const aw = Math.max(8, b.w * imgW);
    const ah = Math.max(8, b.h * imgH);
    const mark = c.mark || defaultMark(c.type);
    const baseY = ay + ah; // 밑줄 기준선

    switch (mark) {
      case 'underline':
        parts.push(`<line x1="${ax}" y1="${baseY}" x2="${ax + aw}" y2="${baseY}" stroke="${RED}" stroke-width="2.5" stroke-linecap="round"/>`);
        // 칭찬 체크
        parts.push(`<path d="M ${ax + aw + 4} ${baseY - 4} l 4 6 l 8 -12" stroke="${GREEN}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
        break;
      case 'wave':
        parts.push(`<path d="${wavePath(ax, baseY, aw)}" stroke="${RED}" stroke-width="2" fill="none"/>`);
        break;
      case 'circle': {
        const cxp = ax + aw / 2;
        const cyp = ay + ah / 2;
        parts.push(`<ellipse cx="${cxp}" cy="${cyp}" rx="${aw / 2 + 6}" ry="${ah / 2 + 5}" fill="none" stroke="${RED}" stroke-width="2.5"/>`);
        break;
      }
      case 'strike':
        parts.push(`<line x1="${ax}" y1="${ay + ah}" x2="${ax + aw}" y2="${ay}" stroke="${RED}" stroke-width="2.5" stroke-linecap="round"/>`);
        break;
      case 'insert': {
        // ∨ 삽입 표시 (구절 시작 지점 아래)
        const vx = ax;
        parts.push(`<path d="M ${vx - 6} ${baseY} L ${vx} ${baseY + 9} L ${vx + 6} ${baseY}" stroke="${RED}" stroke-width="2.5" fill="none" stroke-linejoin="round"/>`);
        break;
      }
      case 'check':
        parts.push(`<path d="M ${ax} ${ay + ah / 2} l 5 7 l 10 -14" stroke="${GREEN}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
        break;
    }

    // 행간·여백 빨간 손글씨 교정
    if (c.correction) {
      const corrText = escapeXml(c.correction);
      // insert는 위쪽(행간), 그 외는 구절 위쪽 행간에
      const cy = mark === 'insert' ? ay - 4 : ay - 5;
      const cx = mark === 'insert' ? ax + 8 : ax;
      parts.push(
        `<text x="${cx}" y="${cy}" font-family="'KoPubWorld Batang','KoPubBatang',serif" font-size="${Math.max(14, ah * 0.85)}" font-style="italic" fill="${RED}" stroke="#ffffff" stroke-width="0.4" paint-order="stroke">${corrText}</text>`
      );
    }
  }

  // ── 우측 여백 번호 코멘트 카드 (좌표 없는 것) ──
  const sorted = [...inMargin].sort((a, b) => (a.y_position ?? 0) - (b.y_position ?? 0));
  const marginX = imgX + imgW + 20;
  const cardW = marginW - 16;
  const fontSize = 13;
  const lineH = 18;
  const maxChars = Math.floor((cardW - 16) / (fontSize * 0.62));
  let cursorY = imgY + 6;
  const typeLabel: Record<string, string> = { praise: '칭찬', improvement: '개선', error: '오류', suggestion: '제안' };
  const typeColor: Record<string, string> = { praise: GREEN, improvement: RED, error: RED, suggestion: '#c2740a' };

  sorted.forEach((c, i) => {
    const lines = wrapByWidth(c.text, maxChars);
    const boxH = lines.length * lineH + 26;
    if (cursorY + boxH > imgY + imgH) cursorY = imgY + 6; // 넘치면 위로(간단 폴백)
    const col = typeColor[c.type] || RED;

    // 앵커: y_position 위치에 번호 점 + 연결선
    const anchorY = imgY + (c.y_position ?? 0) * imgH;
    parts.push(`<line x1="${imgX + imgW}" y1="${anchorY}" x2="${marginX}" y2="${cursorY + 12}" stroke="${col}" stroke-width="1" stroke-dasharray="3 3"/>`);
    parts.push(`<circle cx="${imgX + imgW}" cy="${anchorY}" r="9" fill="${col}"/>`);
    parts.push(`<text x="${imgX + imgW}" y="${anchorY + 4}" text-anchor="middle" font-family="sans-serif" font-size="11" font-weight="700" fill="#fff">${i + 1}</text>`);

    // 카드
    parts.push(`<rect x="${marginX}" y="${cursorY}" width="${cardW}" height="${boxH}" rx="6" fill="#fff" stroke="${col}" stroke-width="1.5"/>`);
    parts.push(`<text x="${marginX + 8}" y="${cursorY + 16}" font-family="sans-serif" font-size="11" font-weight="700" fill="${col}">${i + 1}. [${typeLabel[c.type] || ''}]</text>`);
    lines.forEach((ln, li) => {
      parts.push(`<text x="${marginX + 8}" y="${cursorY + 32 + li * lineH}" font-family="sans-serif" font-size="${fontSize}" fill="#1f2937">${escapeXml(ln)}</text>`);
    });
    cursorY += boxH + 8;
  });

  // 배경/학생 이미지를 가리지 않도록 SVG는 투명 — 캔버스 자체가 흰색이다.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
    ${parts.join('\n    ')}
  </svg>`;

  // 흰 캔버스 → 학생 이미지 합성 → SVG 오버레이 합성
  const studentPng = await base.png().toBuffer();
  const out = await sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: studentPng, left: imgX, top: imgY },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();

  return out;
}

/** 한 칸 구간(span)에 마킹 SVG 한 조각 그리기 (원고지 칸 좌표 기준) */
function markSpanSvg(
  mark: RedPenMark,
  imgX: number, imgY: number,
  row: number, c0: number, c1: number,
): string {
  const sx = imgX + GRID.x0 + c0 * GRID.xp;
  const ex = imgX + GRID.x0 + (c1 + 1) * GRID.xp;
  const top = imgY + GRID.y0 + row * GRID.rowp;
  const baseY = top + GRID.cellh - 2;
  const midY = top + GRID.cellh / 2;
  switch (mark) {
    case 'underline':
      return `<line x1="${sx.toFixed(1)}" y1="${baseY.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>`;
    case 'wave':
      return `<path d="${wavePath(sx, baseY, ex - sx, 4, 9)}" stroke="${RED}" stroke-width="2.5" fill="none"/>`;
    case 'circle':
      return `<rect x="${(sx - 3).toFixed(1)}" y="${(top - 2).toFixed(1)}" width="${(ex - sx + 6).toFixed(1)}" height="${(GRID.cellh + 4).toFixed(1)}" rx="${(GRID.cellh / 2).toFixed(0)}" fill="none" stroke="${RED}" stroke-width="3"/>`;
    case 'strike':
      return `<line x1="${sx.toFixed(1)}" y1="${midY.toFixed(1)}" x2="${ex.toFixed(1)}" y2="${midY.toFixed(1)}" stroke="${RED}" stroke-width="3" stroke-linecap="round"/>`;
    case 'insert':
      return `<path d="M ${(sx - 7).toFixed(1)} ${baseY.toFixed(1)} L ${sx.toFixed(1)} ${(baseY + 10).toFixed(1)} L ${(sx + 7).toFixed(1)} ${baseY.toFixed(1)}" stroke="${RED}" stroke-width="3" fill="none" stroke-linejoin="round"/>`;
    case 'check':
      return `<path d="M ${sx.toFixed(1)} ${midY.toFixed(1)} l 7 9 l 13 -17" stroke="${GREEN}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
    default:
      return '';
  }
}

/**
 * 학생 텍스트 답안 한 페이지를 실양식 원고지(양식2) 위에 조판 + 빨간펜 마킹.
 * @param bgBuffer 원고지 배경 PNG
 * @param answerText 전체 답안(quote 검색·idx 매핑용)
 * @param placedAll layoutManuscript(answerText) 결과 전체
 * @param pageNum 이 페이지 번호(1-base)
 * @param comments 이 답안의 코멘트 전체(quote로 페이지 매핑)
 */
async function renderManuscriptPage(
  bgBuffer: Buffer,
  answerText: string,
  placedAll: Placed[],
  pageNum: number,
  comments: MarginComment[],
  opts: { studentName?: string; examTitle?: string } = {},
): Promise<Buffer> {
  const imgW = GRID.bgW;
  const imgH = GRID.bgH;
  const marginW = 440;
  const pad = 24;
  const imgX = pad;
  const imgY = pad;
  const canvasW = imgW + marginW + pad * 2;
  const canvasH = imgH + pad * 2;

  const parts: string[] = [];
  parts.push(`<rect x="${imgX}" y="${imgY}" width="${imgW}" height="${imgH}" fill="none" stroke="#d4d4d8" stroke-width="1"/>`);

  // ── 학생 글자 칸 조판 ──
  const fontSize = Math.round(GRID.cellh * 0.74);
  for (const p of placedAll) {
    if (p.page !== pageNum) continue;
    if (p.ch === ' ') continue;
    const cx = imgX + GRID.x0 + (p.col + 0.5) * GRID.xp;
    const baseY = imgY + GRID.y0 + p.row * GRID.rowp + GRID.cellh * 0.72;
    parts.push(`<text x="${cx.toFixed(1)}" y="${baseY.toFixed(1)}" font-family="${MANUSCRIPT_FONT}" font-size="${fontSize}" text-anchor="middle" fill="#1a1a2e">${escapeXml(p.ch)}</text>`);
  }

  // ── quote 기반 칸 마킹 + 행간 교정글씨 ──
  const unmatched: MarginComment[] = [];
  for (const c of comments) {
    const q = c.quote?.trim();
    let spans: { page: number; row: number; c0: number; c1: number }[] = [];
    if (q) {
      const start = answerText.indexOf(q);
      if (start >= 0) spans = spansForRange(placedAll, start, start + q.length);
    }
    spans = spans.filter((s) => s.page === pageNum);
    if (spans.length === 0) {
      if (!c.quote || answerText.indexOf(c.quote ?? '') < 0) {
        // quote 자체가 없거나 못 찾음 → 1페이지 여백 카드로
        if (pageNum === 1) unmatched.push(c);
      }
      continue;
    }
    const mark = c.mark || defaultMark(c.type);
    for (const s of spans) parts.push(markSpanSvg(mark, imgX, imgY, s.row, s.c0, s.c1));
    if (mark === 'underline') {
      const s = spans[spans.length - 1];
      const ex = imgX + GRID.x0 + (s.c1 + 1) * GRID.xp;
      const baseY = imgY + GRID.y0 + s.row * GRID.rowp + GRID.cellh - 2;
      parts.push(`<path d="M ${(ex + 4).toFixed(1)} ${(baseY - 5).toFixed(1)} l 5 7 l 9 -13" stroke="${GREEN}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`);
    }
    if (c.correction) {
      const s = spans[0];
      const cx = imgX + GRID.x0 + s.c0 * GRID.xp;
      const cy = imgY + GRID.y0 + s.row * GRID.rowp - 6;
      parts.push(`<text x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" font-family="${MANUSCRIPT_FONT}" font-size="${Math.round(GRID.cellh * 0.5)}" font-style="italic" fill="${RED}" stroke="#fff" stroke-width="0.5" paint-order="stroke">${escapeXml(c.correction)}</text>`);
    }
  }

  // ── 우측 여백 카드 (quote 없는 코멘트) ──
  const marginX = imgX + imgW + 18;
  const cardW = marginW - 12;
  const cFont = 14, lineH = 20;
  const maxChars = Math.floor((cardW - 18) / (cFont * 0.62));
  let cursorY = imgY + 8;
  const typeLabel: Record<string, string> = { praise: '칭찬', improvement: '개선', error: '오류', suggestion: '제안' };
  const typeColor: Record<string, string> = { praise: GREEN, improvement: RED, error: RED, suggestion: '#c2740a' };
  unmatched.forEach((c, i) => {
    const lines = wrapByWidth(c.text, maxChars);
    const boxH = lines.length * lineH + 28;
    if (cursorY + boxH > imgY + imgH) cursorY = imgY + 8;
    const col = typeColor[c.type] || RED;
    parts.push(`<rect x="${marginX}" y="${cursorY}" width="${cardW}" height="${boxH}" rx="7" fill="#fff" stroke="${col}" stroke-width="1.5"/>`);
    parts.push(`<text x="${marginX + 10}" y="${cursorY + 18}" font-family="sans-serif" font-size="12" font-weight="700" fill="${col}">${i + 1}. [${typeLabel[c.type] || ''}]</text>`);
    lines.forEach((ln, li) => {
      parts.push(`<text x="${marginX + 10}" y="${cursorY + 36 + li * lineH}" font-family="sans-serif" font-size="${cFont}" fill="#1f2937">${escapeXml(ln)}</text>`);
    });
    cursorY += boxH + 10;
  });

  // 배경(원고지)을 가리지 않도록 SVG는 투명 — 캔버스 자체가 흰색이다.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${canvasW}" height="${canvasH}">
    ${parts.join('\n    ')}
  </svg>`;

  return sharp({
    create: { width: canvasW, height: canvasH, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } },
  })
    .composite([
      { input: bgBuffer, left: imgX, top: imgY },
      { input: Buffer.from(svg), left: 0, top: 0 },
    ])
    .png()
    .toBuffer();
}

/**
 * 학생 텍스트 답안 → 실양식 원고지 위 조판+빨간펜 마킹 PNG 배열.
 * 답안 이미지가 없을 때(텍스트 답안)의 빨간펜 경로.
 */
export async function renderManuscriptImages(
  answerText: string,
  opts: RedPenRenderOptions,
): Promise<{ page: number; buffer: Buffer }[]> {
  ensureFontconfig();
  const bgBuffer = await readFile(join(process.cwd(), 'public', WONGOJI_PATH));
  const placed = layoutManuscript(answerText);
  const maxPage = placed.length ? Math.max(...placed.map((p) => p.page)) : 1;
  const results: { page: number; buffer: Buffer }[] = [];
  for (let pageNum = 1; pageNum <= maxPage; pageNum++) {
    const buffer = await renderManuscriptPage(bgBuffer, answerText, placed, pageNum, opts.comments, {
      studentName: opts.studentName,
      examTitle: opts.examTitle,
    });
    results.push({ page: pageNum, buffer });
  }
  return results;
}

/**
 * 여러 페이지 답안을 빨간펜 마킹 → PNG buffer 배열로.
 * @param pages [{buffer, page}] 학생 답안 이미지들
 */
export async function renderRedPenImages(
  pages: { buffer: Buffer; page: number }[],
  opts: RedPenRenderOptions,
): Promise<{ page: number; buffer: Buffer }[]> {
  ensureFontconfig();
  const results: { page: number; buffer: Buffer }[] = [];
  for (const p of pages) {
    const pageComments = opts.comments.filter((c) => (c.page ?? 1) === p.page);
    const buffer = await renderRedPenPage(p.buffer, pageComments, {
      brand: opts.brand,
      studentName: opts.studentName,
      examTitle: opts.examTitle,
    });
    results.push({ page: p.page, buffer });
  }
  return results;
}

/**
 * 마킹된 PNG 페이지 배열 + 총평을 하나의 인쇄용 A4 PDF로 합성.
 * jspdf는 node에서도 동작(canvas 불필요).
 */
async function composeAnnotatedPDF(
  annotated: { page: number; buffer: Buffer }[],
  opts: RedPenRenderOptions,
): Promise<Buffer> {
  const { jsPDF } = await import('jspdf');

  const doc = new jsPDF({ unit: 'pt', format: 'a4' });

  // KoPubBatang 폰트 임베드(총평 페이지 한글)
  let fontName = 'helvetica';
  try {
    const fontPath = join(process.cwd(), 'public', 'fonts', 'KoPubBatang-Medium.ttf');
    const fontData = await readFile(fontPath);
    const b64 = fontData.toString('base64');
    doc.addFileToVFS('KoPubBatang-Medium.ttf', b64);
    doc.addFont('KoPubBatang-Medium.ttf', 'KoPub', 'normal');
    fontName = 'KoPub';
  } catch {
    // 폰트 없으면 기본 폰트 폴백
  }

  const pw = doc.internal.pageSize.getWidth();
  const ph = doc.internal.pageSize.getHeight();
  const margin = 28;

  annotated.forEach((a, idx) => {
    if (idx > 0) doc.addPage();
    // PNG → dataURL
    const dataUrl = `data:image/png;base64,${a.buffer.toString('base64')}`;
    const imgProps = doc.getImageProperties(dataUrl);
    const maxW = pw - margin * 2;
    const maxH = ph - margin * 2;
    const ratio = Math.min(maxW / imgProps.width, maxH / imgProps.height);
    const w = imgProps.width * ratio;
    const h = imgProps.height * ratio;
    doc.addImage(dataUrl, 'PNG', (pw - w) / 2, margin, w, h);
  });

  // 총평 페이지
  if (opts.summary || opts.strengths || opts.improvements || opts.answerOutline) {
    doc.addPage();
    doc.setFont(fontName, 'normal');
    let y = margin + 10;
    const writeBlock = (title: string, body?: string, color: [number, number, number] = [60, 60, 60]) => {
      if (!body) return;
      doc.setFontSize(13);
      doc.setTextColor(color[0], color[1], color[2]);
      doc.text(title, margin, y);
      y += 18;
      doc.setFontSize(11);
      doc.setTextColor(40, 40, 40);
      const lines = doc.splitTextToSize(body, pw - margin * 2);
      doc.text(lines, margin, y);
      y += lines.length * 15 + 12;
    };
    doc.setFontSize(16);
    doc.setTextColor(214, 31, 31);
    doc.text('종합 총평', margin, y);
    y += 26;
    writeBlock('학생 답안 전개 요약', opts.answerOutline, [79, 70, 229]);
    writeBlock('잘한 부분', opts.strengths, [10, 138, 74]);
    writeBlock('개선 포인트', opts.improvements, [37, 99, 235]);
    writeBlock('총평', opts.summary, [40, 40, 40]);
  }

  const ab = doc.output('arraybuffer');
  return Buffer.from(ab);
}

/**
 * 학생 답안 이미지 위 빨간펜 마킹 → 인쇄용 PDF (이미지 답안 경로).
 */
export async function renderRedPenPDF(
  pages: { buffer: Buffer; page: number }[],
  opts: RedPenRenderOptions,
): Promise<Buffer> {
  const annotated = await renderRedPenImages(pages, opts);
  return composeAnnotatedPDF(annotated, opts);
}

/**
 * 학생 텍스트 답안 → 실양식 원고지 위 조판+빨간펜 마킹 인쇄용 PDF (텍스트 답안 경로).
 */
export async function renderManuscriptPDF(
  answerText: string,
  opts: RedPenRenderOptions,
): Promise<Buffer> {
  const annotated = await renderManuscriptImages(answerText, opts);
  return composeAnnotatedPDF(annotated, opts);
}
