import { getTeachingMethodologyContext } from '@/lib/constants/teaching-methodology';

export function buildBestAnswerSelectionPrompt(params: {
  examText: string;
  rubricJson: string;
  answersWithScores: { studentName: string; answerText: string; totalScore: number; correctionId: string }[];
}): string {
  return `당신은 대학 인문논술 강사입니다. 아래 학생 답안들 중에서 우수답안을 선정하고 근거를 작성해주세요.

## 시험 원문
${params.examText}

## 채점기준
${params.rubricJson}

## 학생 답안 목록 (${params.answersWithScores.length}명)
${params.answersWithScores.map((a, i) => `
### ${i + 1}. ${a.studentName} (총점: ${a.totalScore}점)
${a.answerText}
`).join('\n---\n')}

${getTeachingMethodologyContext()}

## 만점 답안의 조건 (프로세스 답안작성 로직)
우수답안을 가르는 기준은 '잘 썼다'는 인상이 아니라, 아래 작성 로직을 실제로 수행했는지입니다. 채점 3계층으로 판별하세요.

### 답안작성 로직
- **두괄식**: 결론부터 때려놓고 이유는 그 다음. ('인체실험은 문제없다' → 왜 없는지는 뒤에.) 단락은 논점이 바뀔 때마다 나눈다.
- **핵심 키워드 포함**: 채점은 키워드 누락부터 본다. 발문이 요구하는 핵심어가 답안에 없으면 그 답안은 채점에서 버려진다(즉실점). 우수답안은 키워드를 반드시 자기 언어로 끌어안는다.
- **비교**: 비교 기준(핵심 논점)을 먼저 규명한 뒤 관계를 분석한다. 단순 나열이 아니라 이항대립 개념(객관성↔주관성 등)으로 차이를 선명하게 박았는지, 관계를 1:1:1 / 1:2 / '양극+중간' 중 무엇으로 정확히 잡았는지를 본다. 찾아낸 비교 지점의 '개수'가 변별을 만든다(남들 하나 볼 때 2~3개).
- **적용**: 기준 제시문을 그대로 복붙하면 동어반복 = 손실. 살을 붙이는 근거로 연결을 구체화했는지를 본다.
- **비판**: 현상을 '문제 상황'으로 정리하고, 개성적 논지로 비판하되, '강조한 걸 빼먹었다 → 그래서 목적마저 배반한다'까지 끌어올렸는지가 고득점 가름선. ('도움이 안 된다, 손실을 발생시킨다' 류 막연한 문장은 안 쓰니만 못함.)

### 채점 3계층 (이 순서로 우열을 가린다)
1. 기초선: 핵심 키워드 포함 + 발문 요구 이행(누락 시 회복 불가).
2. 변별: 대비 개념의 선명성 + 찾아낸 지점의 개수.
3. 고득점: 근거 구축의 구체성 + 평가적·심층적 인식.
선정된 우수답안은 이 3계층을 모두 충족하는 답안이어야 합니다.

## 지시사항
1. 가장 우수한 답안 1개를 선정하세요 (채점 3계층을 모두 충족하는 답안 우선)
2. 선정 근거를 구체적으로 작성하세요 (위 작성 로직 중 무엇을 어떻게 충족했는지)
3. 우수답안이지만 아쉬운 점도 짚어주세요
4. 다른 학생들이 참고할 포인트를 정리하세요
5. 4단계 사고흐름(요약→공통점→차이점→관점) 수행 여부도 평가에 반영하세요

## 출력 형식 (JSON)
{
  "selected_student": "학생이름",
  "selected_correction_id": "correctionId",
  "selection_reason": "선정 근거 (3~5문장)",
  "strengths": ["강점1", "강점2", "강점3"],
  "areas_for_improvement": ["아쉬운점1"],
  "learning_points": ["다른 학생 참고 포인트1", "포인트2", "포인트3"],
  "comparison_notes": "다른 답안들과의 비교 요약"
}

JSON만 반환하세요.`;
}
