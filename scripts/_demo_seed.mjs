// 중앙대 2023 인문 기출 풀세트 → nonsul Supabase 등록
// 시험지 + 해설지(프로세스 5단계) + 채점기준표 + 데모반 학생/답안/첨삭
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// .env.local 로드
const env = {};
for (const line of readFileSync('/Users/hongsipyo/nonsul/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const examData = JSON.parse(readFileSync('/tmp/nonsul_demo/exam_data.json', 'utf8'));
const expl = JSON.parse(readFileSync('/tmp/nonsul_demo/explanation.json', 'utf8'));

// ── user_id 확보 (기존 데이터에서, 없으면 auth 유저 목록에서)
async function getUserId() {
  for (const t of ['exams', 'students']) {
    const { data } = await sb.from(t).select('user_id').not('user_id', 'is', null).limit(1);
    if (data?.[0]?.user_id) return data[0].user_id;
  }
  const { data: users } = await sb.auth.admin.listUsers();
  if (users?.users?.[0]) return users.users[0].id;
  throw new Error('user_id를 찾을 수 없음');
}

const userId = await getUserId();
console.log('user_id:', userId);

// ── 1. 시험지 (중복 방지: 같은 제목 있으면 갱신)
const { data: existing } = await sb.from('exams').select('id').eq('title', examData.title).limit(1);
let examId;
const examRow = {
  user_id: userId,
  title: examData.title,
  university: examData.university,
  exam_year: examData.exam_year,
  parsed_passages: examData.parsed_passages,
  parsed_questions: examData.parsed_questions,
  parsed_metadata: examData.parsed_metadata,
  status: 'parsed',
};
if (existing?.[0]) {
  examId = existing[0].id;
  await sb.from('exams').update(examRow).eq('id', examId);
  console.log('시험지 갱신:', examId);
} else {
  const { data, error } = await sb.from('exams').insert(examRow).select('id').single();
  if (error) throw error;
  examId = data.id;
  console.log('시험지 등록:', examId);
}

// ── 2. 채점기준표 (rubrics) — 프로세스 득점포인트 × 대학 공식 기준 융합
const rubricItems = [
  {
    question_number: 1, total_points: 40,
    items: [
      { name: '[기초] 질문 호응 — 고민 내용과 새로운 인식 두 가지 모두 답하기', points: 4, checklist: ['고민 기술과 인식 제시가 모두 있는가', '동문서답 없이 발문에 직접 답하는가'] },
      { name: '[기초] 하나의 완성된 글 — 서론·본론·결론 구성', points: 4, checklist: ['공통주제를 여는 도입부가 있는가', '본론 내용을 종합하는 결론이 있는가(공식 기준 8점 항목 대응)'] },
      { name: '[내용] (가) 고민+인식 정확 기술', points: 8, checklist: ['실패가 두려워 꿈을 포기해 온 삶에 대한 고민', '포기하는 버릇의 내면화·미래 비관의 자각'] },
      { name: '[내용] (나) 고민+인식 정확 기술', points: 8, checklist: ['잃어버린 라면 맛을 되찾지 못하는 고민', '되찾으려는 것이 지난 시절에 대한 향수라는 인식'] },
      { name: '[내용] (다) 고민+인식 정확 기술', points: 8, checklist: ['완벽해진 뒤 교감을 잃은 데 대한 고민', '결핍(불완전성)이 행복의 조건이라는 인식'] },
      { name: '[내용] (라) 고민+인식 정확 기술', points: 8, checklist: ['학교를 그만둔 선택이 옳았는지에 대한 고민', '어른놀이 반성과 제 나이에 어울리는 삶의 인식, 학교 복귀'] }
    ],
    deductions: [
      { name: '글자 수 위반 (550~570자)', points: -2, note: '±1~25자 -1점, ±26자 이상 -2점 (공식 기준)' },
      { name: '맞춤법·원고지 사용법 중대 오류', points: -3 },
      { name: '제시문 문장 그대로 옮겨 쓰기 (한 문장 이상)', points: -5 },
      { name: '주술호응 오류', points: -3, note: '건당 -1, 최대 -3' }
    ],
    star_points: '☆ 8칸(제시문 4 × 고민/인식 2)을 빠짐없이 채우는 것만으로 내용 점수의 대부분이 확보된다. ☆ 서론의 공통주제 문장과 결론의 종합 문장이 구성점 8점을 가른다.'
  },
  {
    question_number: 2, total_points: 40,
    items: [
      { name: '[기초] 두 요구 모두 이행 — 비판 + 문제 서술', points: 4, checklist: ['(마) 비판이 있는가', '초래될 문제 서술이 있는가'] },
      { name: '[기초] (라)(마)(바)(사) 네 제시문 모두 활용', points: 4, checklist: ['누락 제시문이 없는가'] },
      { name: '[내용] (라) 아버지 태도의 개념화', points: 8, checklist: ['경청·대화·설득의 태도 포착', '믿음에 기반한 자발적 동의 유도로 개념화'] },
      { name: '[내용] 아버지 태도를 기준으로 한 (마) 비판의 타당성', points: 10, checklist: ['(마)의 불신·두려움 통치와의 대비', '강압은 자발적 동의를 얻지 못한다는 비판(목적배반 구조)', '단순 나열이 아닌 기준 적용 비판인가 (공식: 기술만 5~10점, 비판 도달 11~20점)'] },
      { name: '[내용] (바)+(사) 통합적 고려', points: 10, checklist: ['(바) 미물의 고통과 저항(풀독) 독해', '(사) 진심 없는 복종·역성혁명 독해', '두 논지를 고통→저항→전복의 연쇄로 통합했는가'] },
      { name: '[심화] 초래될 문제의 단계적 구체화', points: 4, checklist: ['피통치자의 고통과 저항, 체제 전복을 구분해 정확히 서술 (공식 15~20점 구간 요건)'] }
    ],
    deductions: [
      { name: '글자 수 위반 (550~570자)', points: -2 },
      { name: '맞춤법·원고지 사용법 중대 오류', points: -3 },
      { name: '제시문 그대로 옮겨 쓰기', points: -5 },
      { name: '(바) 또는 (사) 누락 시 통합 점수 상한 7점 (공식 기준)', points: 0, note: '감점이 아니라 해당 항목 상한 제한' }
    ],
    star_points: '☆ 비판은 아버지 태도를 먼저 개념화해야 기준이 선다. ☆ (바)(사)를 따로 요약하면 8~14점, 연쇄로 통합하면 15~20점 구간 — 이 문제의 당락 지점이다.'
  },
  {
    question_number: 3, total_points: 20,
    items: [
      { name: '[기초] 두 요구 모두 이행 — 원인 설명 + 자세 서술', points: 2, checklist: ['원인과 자세가 모두 있는가'] },
      { name: '[내용] (아)를 토대로 한 원인 설명', points: 10, checklist: ['경제적 효용 추구·합리적 존재 개념의 인용', '경쟁적 사육 증대 → 초원 황폐화 → 생활 기반 상실의 인과', '(자) 줄거리 요약에 그치지 않고 (아)의 개념이 원인의 언어가 되었는가'] },
      { name: '[내용] (차)에서 찾은 자세의 구체화', points: 8, checklist: ['권리-의무 상보성 인용', '사익 추구와 공익 고려의 조화를 마을 상황에 연결', '무근거 도덕론(서로 배려하자)에 그치지 않았는가'] }
    ],
    deductions: [
      { name: '글자 수 위반 (330~350자)', points: -2 },
      { name: '맞춤법·원고지 사용법 중대 오류', points: -3 },
      { name: '제시문 그대로 옮겨 쓰기', points: -5 }
    ],
    star_points: '☆ (아)의 개념(효용 추구→공공성 결핍)이 원인 문장의 주어가 되면 만점 구간. ☆ 자세는 반드시 (차)의 개념어로 — 도덕적 당위 호소는 3~6점에 머문다.'
  }
];

const { data: exRub } = await sb.from('rubrics').select('id').eq('exam_id', examId).limit(1);
let rubricId;
if (exRub?.[0]) {
  rubricId = exRub[0].id;
  await sb.from('rubrics').update({ items: rubricItems, is_ai_generated: true }).eq('id', rubricId);
  console.log('채점기준 갱신:', rubricId);
} else {
  const { data, error } = await sb.from('rubrics').insert({ exam_id: examId, items: rubricItems, is_ai_generated: true }).select('id').single();
  if (error) throw error;
  rubricId = data.id;
  console.log('채점기준 등록:', rubricId);
}

// ── 3. 해설지 (generated_materials)
const { data: exMat } = await sb.from('generated_materials').select('id').eq('exam_id', examId).eq('type', '해설지').limit(1);
if (exMat?.[0]) {
  await sb.from('generated_materials').update({ content: expl, brand: '프로세스' }).eq('id', exMat[0].id);
  console.log('해설지 갱신:', exMat[0].id);
} else {
  const { data, error } = await sb.from('generated_materials').insert({ exam_id: examId, type: '해설지', brand: '프로세스', content: expl }).select('id').single();
  if (error) throw error;
  console.log('해설지 등록:', data.id);
}

console.log('\n=== 1단계 완료: 시험지+채점기준+해설지 ===');
console.log(JSON.stringify({ examId, rubricId }, null, 2));
