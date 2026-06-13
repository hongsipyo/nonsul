// PRISM 35종 표지 일괄 생성 — SVG → sharp → WebP (1200×1600, 3:4)
// 시리즈 시스템: 네이비 바탕 통일 + 카테고리 강조색 + 대학명 타이포 주인공 + 해시 기반 프리즘 광선
import sharp from 'sharp';
import { readFileSync, mkdirSync } from 'fs';

const products = JSON.parse(readFileSync('/tmp/prism_products.json', 'utf8'));
const OUT = '/Users/hongsipyo/prism/public/covers';
mkdirSync(OUT, { recursive: true });

const ACCENT = { 약술: '#2e6be6', 인문: '#c9a24b', 구술: '#a9b4d4' };
const ACCENT2 = { 약술: '#4d86f5', 인문: '#e3c478', 구술: '#cdd6ea' };
const SERIES = { 약술: '약술논술 동형 시리즈', 인문: '인문논술 동형 시리즈', 구술: '구술 완전정복 시리즈' };

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

function beams(seed, accent) {
  // 고정 시드 프리즘 광선 2~3개 — 우상단 기점, 대학마다 각도 변주
  const h = hash(seed);
  const n = 2 + (h % 2);
  let out = '';
  for (let i = 0; i < n; i++) {
    const a = ((h >> (i * 5)) % 28) - 14;             // 기울기 변주
    const w = 90 + ((h >> (i * 3)) % 130);             // 폭
    const x = 700 + ((h >> (i * 7)) % 420);            // 시작 x
    const op = 0.05 + ((h >> (i * 2)) % 4) * 0.018;
    out += `<polygon points="${x},-50 ${x + w},-50 ${x + w + a * 14},1700 ${x + a * 14},1700" fill="url(#beam)" opacity="${op.toFixed(3)}"/>`;
  }
  return out;
}

function wrapTitle(title, univ, track) {
  // 대학명 제거, 계열 중복 제거, 말미 회차(하단 띠와 중복) 제거 후 1~2줄
  let rest = title.replace(univ, '').trim();
  if (track && rest.startsWith(track)) rest = rest.slice(track.length).trim();
  rest = rest.replace(/\s*\d+(세트|회분?|권)$/, '').trim();
  if (!rest) return [];
  if (rest.length <= 13) return [rest];
  const mid = Math.floor(rest.length / 2);
  let cut = rest.lastIndexOf(' ', mid + 3);
  if (cut < 4) cut = mid;
  return [rest.slice(0, cut).trim(), rest.slice(cut).trim()];
}

function coverSvg(p) {
  const ac = ACCENT[p.category], ac2 = ACCENT2[p.category];
  const lines = p.category === '구술' ? [] : wrapTitle(p.title, p.university, p.track);
  const univSize = p.university.length <= 4 ? 240 : p.university.length <= 5 ? 200 : 168;
  const roundsLabel = p.category === '구술' ? '기출 완전분석 1권' : `동형 모의고사 ${p.rounds}회분`;
  const track = p.track ? `${p.track} 계열` : (p.category === '약술' ? '인문계' : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1600">
<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0a1326"/><stop offset="0.6" stop-color="#0e1a33"/><stop offset="1" stop-color="#15233f"/>
  </linearGradient>
  <linearGradient id="beam" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="${ac2}"/><stop offset="1" stop-color="${ac}" stop-opacity="0"/>
  </linearGradient>
  <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#2e6be6"/><stop offset="0.5" stop-color="${ac2}"/><stop offset="1" stop-color="#c9a24b"/>
  </linearGradient>
</defs>
<rect width="1200" height="1600" fill="url(#bg)"/>
${beams(p.university + p.id, ac)}
<rect x="0" y="0" width="1200" height="10" fill="url(#rule)"/>

<text x="92" y="150" font-family="Pretendard" font-weight="800" font-size="44" letter-spacing="14" fill="#ffffff">PRISM</text>
<text x="92" y="208" font-family="Pretendard" font-weight="600" font-size="30" fill="${ac2}">${esc(SERIES[p.category])}</text>
<rect x="92" y="246" width="120" height="4" fill="${ac}"/>

<text x="88" y="${560 + univSize * 0.8}" font-family="Pretendard" font-weight="900" font-size="${univSize}" letter-spacing="-4" fill="#ffffff">${esc(p.university)}</text>
${track ? `<text x="92" y="${640 + univSize}" font-family="Pretendard" font-weight="700" font-size="54" fill="${ac2}">${esc(track)}</text>` : ''}
${lines.map((l, i) => `<text x="92" y="${(track ? 730 : 660) + univSize + i * 62}" font-family="Pretendard" font-weight="500" font-size="44" fill="#aab6cf">${esc(l)}</text>`).join('')}

<rect x="92" y="1380" width="1016" height="2" fill="#26354f"/>
<text x="92" y="1448" font-family="Pretendard" font-weight="700" font-size="40" fill="${ac2}">${esc(roundsLabel)}</text>
<text x="92" y="1502" font-family="Pretendard" font-weight="500" font-size="28" fill="#7d8aa5">${p.category === '구술' ? '기출 제시문 + 모범답안·최소답안 + 사고축 해설' : '문제지 + 5단계 역설계 해설 + 채점기준표'}</text>
<text x="1108" y="1502" text-anchor="end" font-family="Pretendard" font-weight="700" font-size="28" fill="#56657f">프리즘논술</text>
</svg>`;
}

let done = 0;
for (const p of products) {
  const svg = coverSvg(p);
  await sharp(Buffer.from(svg)).webp({ quality: 88 }).toFile(`${OUT}/${p.id}.webp`);
  done++;
}
console.log(`표지 ${done}개 생성 → ${OUT}`);
// 검수용 샘플 PNG 3장
for (const id of ['yak-kookmin', 'inmun-yonsei-inmun', 'gusul-snu']) {
  const p = products.find(x => x.id === id);
  if (p) await sharp(Buffer.from(coverSvg(p))).resize(450).png().toFile(`/tmp/cover_${id}.png`);
}
console.log('검수 샘플: /tmp/cover_*.png');
