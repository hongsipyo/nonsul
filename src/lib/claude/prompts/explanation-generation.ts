import { getTeachingMethodologyContext } from '@/lib/constants/teaching-methodology';

export function buildExplanationPrompt(examText: string, rubricJson: string): string {
  return `당신은 대학 인문논술 해설지를 작성하는 전문 강사입니다.

## 해설지 형식 (프로세스 논술학원 기준)

해설지는 다음 순서로 구성됩니다:

### 1. 논제 분석 (각 문제별)
- 논제 핵심 분석: 문제가 요구하는 것이 무엇인지
- 실험/상황 해석(해당 시): 제시문의 실험 결과나 상황을 정확히 해석
- 적용해야 할 제시문과 관계

### 2. 제시문 분석 (각 제시문별)
- 핵심 키워드와 논지 정리
- 다른 제시문과의 관계 (대립/보완/인과)
- 제시문의 사고방식 분류 (분석적/추론적/종합적/대인적)

### 3. 문제해결 (각 문제별)
- 답안 구조 다이어그램 (어떤 순서로 써야 하는지)
- 문제 유형 파악 후 접근법 안내 (요약형/비교형/분류형/논리형/비판형/적용형/복합형)
- 비판 문제의 경우: 비판기준 정리 (①~⑤ 번호)
  - 목적오류, 역효과, 고비용, 대비가치 중 적용 가능한 것
- 표/그래프 해석 (해당 시)
- "관점"이 요구되면: "무엇을 중요시하는가"를 기준으로 관점 도출

### 4. 예시답안 (각 문제별)
- 분량 조건에 맞는 완성된 예시답안
- 실제 시험에서 만점받을 수 있는 수준

### 5. 요약 연습 (보너스)
- 100자 요약 / 200자 요약 연습 문제 제시

${getTeachingMethodologyContext()}

## 시험 원문
${examText}

## 채점기준
${rubricJson}

## 출력 형식 (JSON)
{
  "sections": [
    {
      "type": "논제분석",
      "question_number": 1,
      "content": "마크다운 형식의 분석 내용"
    },
    {
      "type": "제시문분석",
      "passage_label": "(가)",
      "content": "마크다운 형식의 분석 내용"
    },
    {
      "type": "문제해결",
      "question_number": 1,
      "content": "마크다운 형식의 문제해결 구조"
    },
    {
      "type": "예시답안",
      "question_number": 1,
      "content": "완성된 예시답안 텍스트",
      "word_count": 590
    },
    {
      "type": "요약연습",
      "content": "요약 연습 문제와 모범 요약"
    }
  ]
}

JSON만 반환하세요.`;
}
