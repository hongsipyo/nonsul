// 2단계: 데모반 학생 3명 + 답안 + 첨삭(풀퀄 1건 + 약식 3건) + 우수답안
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = {};
for (const line of readFileSync('/Users/hongsipyo/nonsul/.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const EXAM_ID = 'ea9ef484-7b3d-4701-9454-8477ad661774';
const RUBRIC_ID = '39361eb5-7987-484c-a6d5-45cdc4502685';
const { data: u } = await sb.from('exams').select('user_id').eq('id', EXAM_ID).single();
const userId = u.user_id;

// ── 데모반 학생 3명
const studentsDef = [
  { name: '김서연(데모)', school: '대치고', grade: 3, target_university: '중앙대', class_name: '데모반' },
  { name: '이준호(데모)', school: '단대부고', grade: 3, target_university: '중앙대', class_name: '데모반' },
  { name: '박지우(데모)', school: '숙명여고', grade: 3, target_university: '중앙대', class_name: '데모반' },
];
const students = {};
for (const s of studentsDef) {
  const { data: ex } = await sb.from('students').select('id').eq('name', s.name).limit(1);
  if (ex?.[0]) { students[s.name] = ex[0].id; continue; }
  const { data, error } = await sb.from('students').insert({ ...s, user_id: userId }).select('id').single();
  if (error) throw error;
  students[s.name] = data.id;
}
console.log('학생 3명:', Object.keys(students).join(', '));

// ── 이준호 답안 (전형적 결함: 서론 부재 / (다) 인식 얕음 / 문제2 (바) 누락 / 비판 막연 / 분량 미달)
const junhoAnswer = `〈문제1〉
(가)의 나는 어렸을 때부터 꿈을 계속 포기하면서 살아왔다. 이모의 말을 듣고 피아노 연습을 게을리하게 되었고 그 이후로도 수도 없이 꿈을 포기했다. 그래서 포기하는 버릇이 생겼다는 것을 알게 되었다. (나)의 나는 어릴 때 먹었던 라면의 맛을 잃어버려서 찌그러진 냄비와 분유 깡통까지 구해서 라면을 끓여보았지만 그 맛이 나지 않았다. 결국 그 맛은 라면이 아니라 그 시절을 먹고 싶은 것이라고 결론을 내렸다. (다)의 동그라미는 조각을 찾아서 완벽해졌지만 노래를 부를 수 없게 되었다. 그래서 조각을 내려놓았는데 완벽한 것이 좋은 것만은 아니라는 것이다. (라)의 정수는 학교를 그만두고 대관령에서 배추 농사를 지어 큰돈을 벌었다. 하지만 자신이 한 것이 어른 노릇이 아니라 어른놀이였다는 생각이 들어서 학교로 돌아가기로 했다. 이처럼 네 제시문의 나는 모두 고민을 하고 있다.

〈문제2〉
(라)의 아버지는 아들이 학교를 안 다니겠다고 했을 때 화를 참고 아들의 말을 들어주었다. 그리고 책만 제대로 읽는다면 무식하다는 소리는 듣지 않을 것이라고 하면서 아들을 믿고 보내주었다. 하지만 (마)의 군주는 인간을 변덕스럽고 위선적인 존재로 보고 사랑보다 두려움으로 다스려야 한다고 주장한다. 아버지의 태도와 비교해보면 마키아벨리의 주장은 너무 비관적이고 나쁘다. 사람을 믿어주면 더 잘할 수 있는데 두려움으로 다스리면 사람들이 무서워하기만 하기 때문이다. (사)에서 맹자는 무력으로 사람을 복종시키면 진심으로 복종하지 않는다고 했다. 또한 통치자가 백성의 삶을 안정시키지 못하면 역성혁명으로 통치자를 바꿀 수 있다고 했다. 그러므로 (마)의 군주처럼 두려움으로 통치하면 백성들이 진심으로 따르지 않고 결국 군주가 쫓겨날 수도 있는 문제가 생긴다.

〈문제3〉
(아)에 따르면 자유주의는 개인이 자유롭게 이익을 추구하면 사회 전체의 부가 증가한다고 본다. (자)의 마을 주민들도 자신의 이익을 위해 양의 수를 계속 늘렸다. 하지만 초원의 풀은 한정되어 있었기 때문에 결국 초원이 황무지가 되었고 마을은 생활 기반을 상실하였다. 개인의 합리적인 이익 추구가 모두에게 나쁜 결과를 가져온 것이다. 이런 일이 일어나지 않으려면 (차)에서 말한 것처럼 권리와 의무가 상호 보완적이라는 것을 알아야 한다. 마을 주민들은 자신의 권리만 내세우지 말고 의무도 생각하면서 공동체를 위해 노력해야 한다.`;

// ── 이준호 첨삭 (프로세스 풀퀄: 거의 모든 문장 코멘트 + 누락적발 + 대안 2~3개 + 재설계골격)
const junhoCorrection = {
  answer_outline: '문제1은 네 제시문을 (가)→(라) 순서로 요약하며 각 인물의 고민을 정리했고, 문제2는 아버지의 태도와 마키아벨리를 대비시킨 뒤 맹자를 근거로 문제를 서술했습니다. 문제3은 공유지의 비극의 인과를 정리하고 권리-의무 상보성으로 마무리했습니다. 전체적으로 제시문 줄거리 파악은 정확하지만, 발문이 요구한 개념의 층위로 올라가지 못하고 줄거리 층위에 머문 답안입니다.',
  margin_comments: [
    { id: 'c01', page: 1, y_position: 0.03, para: 0, quote: '(가)의 나는 어렸을 때부터 꿈을 계속 포기하면서 살아왔다', text: '첫 문장부터 (가)로 바로 들어갔습니다. 이 문제는 "하나의 완성된 글"을 요구하므로 네 제시문의 공통 구조를 여는 서론 한 문장이 반드시 필요합니다. 예: "(가)~(라)의 나는 모두 고민을 거쳐 새로운 인식에 도달한다." 이 한 문장이 구성 점수 8점 중 3점을 가릅니다.', type: 'error' },
    { id: 'c02', page: 1, y_position: 0.07, para: 0, quote: '그래서 포기하는 버릇이 생겼다는 것을 알게 되었다', text: '고민의 결과로 도달한 인식을 쓰긴 했는데 절반만 왔습니다. (가)의 인식의 핵심은 버릇이 "생겼다"가 아니라 그 버릇이 내면화되어 "현실을 실제보다 나쁘게 보고 미래를 비관하게 되었다"는 자기 진단까지입니다. 1) 포기하는 버릇이 내면화되었음을 자각한다 2) 현실을 실제보다 나쁘게 인식해 왔음을 깨닫는다 — 이 중 하나로 한 걸음 더 들어가세요.', type: 'improvement' },
    { id: 'c03', page: 1, y_position: 0.12, para: 0, quote: '결국 그 맛은 라면이 아니라 그 시절을 먹고 싶은 것이라고 결론을 내렸다', text: '(나)의 인식을 정확히 포착했습니다. 맛→시절의 전환을 짚은 것, 매우 좋습니다. 다만 "그 맛은 ~ 먹고 싶은 것이라고"는 주술호응이 어긋납니다. 1) 자신이 원한 것은 라면이 아니라 그 시절임을 깨달았다 2) 되찾으려 한 것은 맛이 아니라 지난 시절에 대한 향수였다', type: 'praise' },
    { id: 'c04', page: 1, y_position: 0.17, para: 0, quote: '완벽한 것이 좋은 것만은 아니라는 것이다', text: '(다)의 인식이 가장 얕게 처리된 지점입니다. "좋은 것만은 아니다"는 누구나 쓸 수 있는 문장이라 득점하지 못합니다. 동그라미가 조각을 "내려놓는" 행위의 의미, 곧 결핍이 있어야 벌레와 대화하고 꽃 냄새를 맡는 교감이 가능하다 — 불완전함이 오히려 행복의 조건이라는 역설까지 가야 8점 만점 구간입니다.', type: 'error' },
    { id: 'c05', page: 1, y_position: 0.21, para: 0, quote: '어른 노릇이 아니라 어른놀이였다는 생각이 들어서 학교로 돌아가기로 했다', text: '(라)의 핵심 대립쌍(어른 노릇/어른놀이)을 정확히 가져왔습니다. good. 여기에 "제 나이에 어울리는 삶이 의미 있다"는 인식을 한 구 추가하면 인식 칸이 완성됩니다.', type: 'praise' },
    { id: 'c06', page: 1, y_position: 0.25, para: 0, quote: '이처럼 네 제시문의 나는 모두 고민을 하고 있다', text: '결론이 발문을 배반했습니다. 발문은 "고민 내용 + 새로운 인식"을 물었는데 마지막 문장이 "고민을 하고 있다"로 끝나면 인식 절반을 결론에서 놓친 셈입니다. 본론에서 정리한 네 인식을 "스스로를 성찰하며 자기 삶의 본모습을 발견하는 인식에 도달한다"로 묶어주세요. 이 문장이 공식 채점기준의 결론 5점입니다.', type: 'error' },
    { id: 'c07', page: 1, y_position: 0.28, para: 0, quote: '〈문제1〉', text: '분량이 약 450자로 조건(550~570자) 대비 100자 이상 미달입니다(-2점). 빠진 100자가 정확히 서론(공통주제)과 각 제시문의 "인식" 심화에 해당합니다. 분량 미달은 대부분 내용 누락의 신호입니다.', type: 'error' },
    { id: 'c08', page: 1, y_position: 0.33, para: 1, quote: '화를 참고 아들의 말을 들어주었다', text: '아버지 태도의 첫 번째 요소(경청)를 잡았습니다. 다만 줄거리 서술에 머물렀습니다. 채점자는 "개념화"를 봅니다. 1) 반항을 억압하지 않고 경청하는 태도 2) 대화와 설득으로 자발적 동의를 이끌어내는 태도 3) 신뢰에 기반해 스스로 깨닫기를 기다리는 태도 — 이런 개념어로 올려야 비판의 "기준"이 됩니다.', type: 'improvement' },
    { id: 'c09', page: 1, y_position: 0.38, para: 1, quote: '마키아벨리의 주장은 너무 비관적이고 나쁘다', text: '이 문장이 문제2의 최대 감점 지점입니다. "나쁘다"는 평가어일 뿐 비판이 아닙니다. 비판은 기준 적용 + 근거 제시입니다. 아버지의 태도를 기준으로 하면: "공포는 외면적 복종만 낳을 뿐 마음에서 우러난 동의를 얻지 못하므로, 안정된 통치라는 본래 목적마저 배반한다." 이렇게 목적배반 구조로 쓰면 공식 기준의 11~20점 구간에 진입합니다.', type: 'error' },
    { id: 'c10', page: 1, y_position: 0.42, para: 1, quote: '사람을 믿어주면 더 잘할 수 있는데', text: '의도는 정확합니다 — 신뢰가 자발성을 끌어낸다는 (라)의 논리를 쓰려 한 것이지요. 다만 "더 잘할 수 있는데"는 일상어입니다. 1) 신뢰는 자발적 동의와 성장을 이끌어낸다 2) 믿음은 마음에서 우러난 복종을 가능하게 한다', type: 'improvement' },
    { id: 'c11', page: 1, y_position: 0.47, para: 1, quote: '(사)에서 맹자는', text: '여기서 (사)로 바로 건너뛰면서 (바)가 완전히 누락되었습니다. 발문은 "(바)와 (사)를 통합적으로 고려"하라고 명시했습니다. (바)의 풀독 — 한갓 잡풀도 뽑히고 베일 때 고통을 느끼고 저항한다 — 이 빠지면 공식 채점기준상 이 항목 점수가 최대 7점으로 제한됩니다. 가장 뼈아픈 누락입니다.', type: 'error' },
    { id: 'c12', page: 1, y_position: 0.52, para: 1, quote: '역성혁명으로 통치자를 바꿀 수 있다고 했다', text: '(사)의 두 논점(진심 없는 복종, 역성혁명)은 정확히 독해했습니다. good. 이제 (바)와 묶어 "고통(풀독) → 진심 없는 복종의 균열 → 저항과 전복(역성혁명)"의 연쇄로 한 문장 안에서 이어주면 통합 고려 요구가 충족됩니다.', type: 'praise' },
    { id: 'c13', page: 1, y_position: 0.56, para: 1, quote: '군주가 쫓겨날 수도 있는 문제가 생긴다', text: '"쫓겨날 수도 있는 문제가 생긴다"는 표현이 헐겁습니다. 1) 군주 지위의 박탈과 체제 전복을 초래한다 2) 통치 기반 자체가 무너지는 결과에 이른다 — 결과의 무게에 맞는 서술어를 쓰세요.', type: 'improvement' },
    { id: 'c14', page: 1, y_position: 0.62, para: 2, quote: '(아)에 따르면 자유주의는 개인이 자유롭게 이익을 추구하면 사회 전체의 부가 증가한다고 본다', text: '(아)의 절반만 인용했습니다. 원인 설명에 정작 필요한 것은 뒷부분 — "개인을 경제적 효용을 추구하는 합리적 존재로 보는 경향이 공공성 결핍을 낳는다"입니다. 이 개념이 원인 문장의 주어가 되어야 "(아)를 토대로"라는 요구가 충족됩니다.', type: 'improvement' },
    { id: 'c15', page: 1, y_position: 0.66, para: 2, quote: '초원의 풀은 한정되어 있었기 때문에 결국 초원이 황무지가 되었고', text: '경쟁적 사육 증대 → 한정된 초원 → 황폐화 → 기반 상실의 인과 사슬을 빠짐없이 정리했습니다. 매우 훌륭합니다. 사례 독해력은 충분합니다.', type: 'praise' },
    { id: 'c16', page: 1, y_position: 0.71, para: 2, quote: '공동체를 위해 노력해야 한다', text: '마지막이 "노력해야 한다"는 도덕 표어로 끝났습니다. (차)의 개념을 마을 상황에 구체화해야 합니다. 1) 초원을 이용할 권리에는 보존할 의무가 따른다 2) 초원이 훼손되지 않는 범위에서 사익을 추구한다 3) 사익과 공익을 함께 고려하는 자세 — 이 셋 중 둘만 들어가도 자세 항목이 만점 구간으로 올라갑니다.', type: 'improvement' },
    { id: 'c17', page: 1, y_position: 0.74, para: 2, quote: '권리와 의무가 상호 보완적이라는 것을 알아야 한다', text: '(차)의 핵심 개념(권리-의무 상보성)을 정확히 찾아 인용했습니다. good. 개념 선택은 맞았으니 이제 구체화만 남았습니다.', type: 'praise' }
  ],
  scores: [
    { question_number: 1, point_scores: [
      { name: '[기초] 질문 호응(고민+인식)', earned: 3, max: 4, notes: '고민은 충실, 인식이 (가)(다)에서 절반' },
      { name: '[기초] 완성된 글 구성', earned: 1, max: 4, notes: '서론 부재, 결론이 발문 배반' },
      { name: '(가) 고민+인식', earned: 6, max: 8, notes: '버릇 자각까지만, 비관 인식 누락' },
      { name: '(나) 고민+인식', earned: 7, max: 8, notes: '맛→시절 전환 정확' },
      { name: '(다) 고민+인식', earned: 5, max: 8, notes: '인식이 일반론 수준' },
      { name: '(라) 고민+인식', earned: 7, max: 8, notes: '대립쌍 정확, 인식 한 구 부족' }
    ], deductions: [ { name: '분량 미달(약 450자)', points: -2 } ], subtotal: 27 },
    { question_number: 2, point_scores: [
      { name: '[기초] 두 요구 이행', earned: 3, max: 4, notes: '비판·문제 서술 모두 시도' },
      { name: '[기초] 네 제시문 활용', earned: 2, max: 4, notes: '(바) 누락' },
      { name: '(라) 아버지 태도 개념화', earned: 5, max: 8, notes: '줄거리 층위에 머묾' },
      { name: '(마) 비판의 타당성', earned: 5, max: 10, notes: '평가어(나쁘다)에 그침, 근거 구조 미약' },
      { name: '(바)+(사) 통합', earned: 4, max: 10, notes: '(바) 누락으로 상한 7점, (사) 독해는 정확' },
      { name: '[심화] 문제의 단계적 구체화', earned: 1, max: 4, notes: '고통·저항 단계 없이 결과만' }
    ], deductions: [ { name: '분량 미달(약 430자)', points: -2 } ], subtotal: 18 },
    { question_number: 3, point_scores: [
      { name: '[기초] 두 요구 이행', earned: 2, max: 2, notes: '' },
      { name: '(아) 토대 원인 설명', earned: 7, max: 10, notes: '(아) 전반부만 인용, 효용추구→공공성결핍 연결 누락' },
      { name: '(차) 자세 구체화', earned: 5, max: 8, notes: '개념 인용은 정확, 구체화가 도덕 표어로 끝남' }
    ], deductions: [], subtotal: 14 }
  ],
  total_score: 59,
  grade: 'C+',
  summary: '제시문 줄거리 독해는 세 문제 모두 정확합니다. 특히 (나)의 맛→시절 전환, (라)의 어른놀이 대립쌍, 문제3의 인과 사슬 정리는 칭찬할 만합니다. 그러나 답안 전체가 "줄거리 층위"에 머물러 "개념 층위"로 올라가지 못했습니다. 문제1은 서론·결론 부재로 완성된 글 요구를 놓쳤고, 문제2는 (바) 누락이라는 구조적 공백에 비판이 평가어로 끝나는 약점이 겹쳤으며, 문제3은 개념 선택까지 정확했으나 구체화 직전에 멈췄습니다. 이번 답안에서 반드시 새길 교훈 한 가지: 발문에 등장한 제시문 기호를 답안에서 체크하며 쓰는 습관 — (바) 누락 하나가 10점 항목의 상한을 7점으로 깎았습니다. 다음 답안 재설계 골격: ① 답안 첫 문장은 반드시 공통주제(두괄식)로 열고, 마지막 문장은 발문의 핵심어(새로운 인식)로 닫을 것 ② 비판 문제는 기준 개념화(경청·신뢰·자발적 동의) → 대상과의 대비 → 목적배반 구조의 근거 제시 3단으로 쓸 것 ③ 발문이 "통합"을 요구하면 두 제시문을 인과 연쇄(고통→저항→전복)로 한 문장에 묶을 것. 이 세 가지만 교정되면 다음 회차에 70점대 중반이 바로 보입니다.',
  strengths: '제시문 사실 독해의 정확성(세 문제 공통), (나)·(라)의 핵심 전환 포착, 문제3의 인과 사슬 정리, (차) 개념 선택의 정확성',
  improvements: '서론·결론을 갖춘 완성된 글 구성, 줄거리 서술의 개념화, 발문 제시문 전수 활용((바) 누락 방지), 비판의 근거 구조(목적배반), 분량 조건 준수(두 문제 연속 미달)'
};

// ── 김서연 1·2차, 박지우 답안(요지) — 엑셀 추이·우수답안 데모용 약식
const seoyeon1 = `〈문제1〉 (가)~(라)에는 고민하는 나가 나타난다. (가)의 나는 꿈을 포기해온 삶을 고민하고 포기하는 버릇이 내면화되었음을 깨닫는다. (나)의 나는 잃어버린 라면 맛을 고민하다 그것이 지난 시절에 대한 향수임을 인식한다. (다)의 나는 완벽해진 뒤 교감을 잃은 것을 고민하고 결핍이 행복의 조건임을 깨닫는다. (라)의 나는 학교를 그만둔 선택을 고민하다 제 나이에 맞는 삶이 의미 있다는 인식에 도달한다. (1차 제출 답안 — 데모)`;
const seoyeon2 = `〈문제1〉 (가)~(라)의 나는 모두 고민을 거쳐 새로운 인식에 도달한다. (가)의 나는 실패가 두려워 꿈을 포기해 온 삶을 고민한 끝에 포기하는 버릇이 내면화되어 미래를 비관해 왔음을 자각한다. (나)의 나는 잃어버린 라면의 맛을 재현하지 못해 고민하다 자신이 원한 것은 돌아갈 수 없는 시절에 대한 향수임을 인식한다. (다)의 나는 완벽해진 뒤 교감을 잃은 처지를 고민하고 결핍이 오히려 행복의 조건임을 깨닫는다. (라)의 나는 이른 어른되기가 옳았는지 고민한 끝에 어른놀이였다는 반성에 이르러 학교로 돌아간다. 네 명의 나는 고민을 통해 자기 삶의 본모습을 발견한다. (2차 제출 답안 — 데모)`;
const jiwooAns = `〈문제1〉 (가)~(라)의 나는 모두 고민을 거쳐 삶에 대한 새로운 인식에 도달한다. (가)의 나는 실패가 두려워 핑계를 대며 꿈을 포기해 온 삶을 고민하고, 포기하는 버릇이 내면화되어 현실을 실제보다 나쁘게 보고 미래를 비관해 왔음을 자각한다. (나)의 나는 어린 시절 라면의 맛을 온갖 방법으로 재현하려다 실패하는 고민 끝에, 되찾고자 한 것이 라면이 아니라 돌아갈 수 없는 시절에 대한 향수임을 인식한다. (다)의 나는 조각을 채워 완벽해졌으나 벌레, 꽃, 나비와 교감하지 못하게 된 처지를 고민하고, 찾은 조각을 내려놓으며 존재의 불완전함이 행복의 조건임을 깨닫는다. (라)의 나는 학교를 그만두고 서둘러 어른이 되려 한 선택을 고민하다, 지난 삶이 어른놀이였다는 반성과 함께 제 나이에 어울리는 삶이 의미 있다는 인식에 이르러 학교로 돌아간다. 요컨대 네 명의 나는 고민을 통해 스스로를 성찰하고 자기 삶의 본모습을 발견하는 인식에 도달한다. (데모 — 우수답안 예시)`;

async function upsertAnswer(studentName, text, label) {
  const { data: ex } = await sb.from('student_answers').select('id').eq('exam_id', EXAM_ID).eq('student_name', label).limit(1);
  if (ex?.[0]) return ex[0].id;
  const { data, error } = await sb.from('student_answers').insert({
    exam_id: EXAM_ID, student_id: students[studentName], student_name: label,
    answer_text: text
  }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function upsertCorrection(answerId, payload) {
  const { data: ex } = await sb.from('corrections').select('id').eq('answer_id', answerId).limit(1);
  if (ex?.[0]) {
    await sb.from('corrections').update(payload).eq('id', ex[0].id);
    return ex[0].id;
  }
  const { data, error } = await sb.from('corrections').insert({ answer_id: answerId, exam_id: EXAM_ID, rubric_id: RUBRIC_ID, brand: '프로세스', status: 'completed', ...payload }).select('id').single();
  if (error) throw error;
  return data.id;
}

// 이준호 — 풀퀄 첨삭
const ansJunho = await upsertAnswer('이준호(데모)', junhoAnswer, '이준호(데모)');
const corrJunho = await upsertCorrection(ansJunho, junhoCorrection);
console.log('이준호 첨삭(풀퀄):', corrJunho);

// 김서연 1차 (72) → 2차 (81): 추이 데모
const ansSeo1 = await upsertAnswer('김서연(데모)', seoyeon1, '김서연(데모)·1차');
await upsertCorrection(ansSeo1, {
  answer_outline: '네 제시문의 고민과 인식을 빠짐없이 정리했으나 서론 없이 나열형으로 전개한 1차 답안입니다.',
  margin_comments: [],
  scores: [
    { question_number: 1, point_scores: [{ name: '내용 종합', earned: 27, max: 40, notes: '8칸 충실, 구성 약함' }], deductions: [], subtotal: 27 },
    { question_number: 2, point_scores: [{ name: '내용 종합', earned: 30, max: 40, notes: '통합 시도 있음' }], deductions: [], subtotal: 30 },
    { question_number: 3, point_scores: [{ name: '내용 종합', earned: 15, max: 20, notes: '' }], deductions: [], subtotal: 15 }
  ],
  total_score: 72, grade: 'B0',
  summary: '여덟 칸을 빠짐없이 채운 점이 강점입니다. 서론의 공통주제 문장과 결론 종합만 보강하면 점수가 바로 오릅니다. 다음 답안 재설계 골격: ① 공통주제로 열기 ② 칸별 균등 분량 ③ 결론에서 인식 종합. (데모 약식 첨삭)',
  strengths: '8칸 전수 충족', improvements: '구성(서론·결론), 분량 배분'
});
const ansSeo2 = await upsertAnswer('김서연(데모)', seoyeon2, '김서연(데모)·2차');
await upsertCorrection(ansSeo2, {
  answer_outline: '1차 피드백을 반영해 공통주제 서론과 종합 결론을 갖춘 2차 답안입니다.',
  margin_comments: [],
  scores: [
    { question_number: 1, point_scores: [{ name: '내용 종합', earned: 33, max: 40, notes: '구성 보강 완료' }], deductions: [], subtotal: 33 },
    { question_number: 2, point_scores: [{ name: '내용 종합', earned: 32, max: 40, notes: '' }], deductions: [], subtotal: 32 },
    { question_number: 3, point_scores: [{ name: '내용 종합', earned: 16, max: 20, notes: '' }], deductions: [], subtotal: 16 }
  ],
  total_score: 81, grade: 'B+',
  summary: '1차에서 지적한 서론·결론이 정확히 들어왔습니다. 재설계 골격을 그대로 실행한 모범적 향상입니다(72→81). 다음 과제: (다)의 역설을 자기 언어로 더 압축하기. (데모 약식 첨삭)',
  strengths: '피드백 반영력, 구성 완성', improvements: '(다) 인식의 압축적 표현'
});
console.log('김서연 1·2차 등록 (72→81 추이)');

// 박지우 — 우수답안 (88, is_best_answer)
const ansJiwoo = await upsertAnswer('박지우(데모)', jiwooAns, '박지우(데모)');
const corrJiwoo = await upsertCorrection(ansJiwoo, {
  answer_outline: '공통주제 서론, 제시문별 고민-인식 쌍, 종합 결론까지 갖춘 답안입니다.',
  margin_comments: [],
  scores: [
    { question_number: 1, point_scores: [{ name: '내용 종합', earned: 36, max: 40, notes: '8칸+구성 완비' }], deductions: [], subtotal: 36 },
    { question_number: 2, point_scores: [{ name: '내용 종합', earned: 35, max: 40, notes: '연쇄 통합 우수' }], deductions: [], subtotal: 35 },
    { question_number: 3, point_scores: [{ name: '내용 종합', earned: 17, max: 20, notes: '' }], deductions: [], subtotal: 17 }
  ],
  total_score: 88, grade: 'A0',
  summary: '두괄식, 칸 채우기, 종합 결론, 재진술까지 프로세스 기본기가 모두 구현된 답안입니다. 반 우수답안으로 게시합니다. (데모 약식 첨삭)',
  strengths: '구성·재진술·인식의 깊이', improvements: '(라) 인식 서술의 간결화',
  is_best_answer: true, best_answer_text: jiwooAns
});
console.log('박지우 우수답안(★):', corrJiwoo);
console.log('\n=== 2단계 완료: 학생3 + 답안4 + 첨삭4 + 우수답안1 ===');
