import {
  UNIVERSAL_POINTS,
  BASIC_POINTS,
  ADVANCED_POINTS,
  CRITICISM_TOOLS,
} from '@/lib/constants/scoring-points';
import { getTeachingMethodologyContext } from '@/lib/constants/teaching-methodology';
import { getProcessMethodologyContext } from '@/lib/constants/process-methodology';

export function buildRubricGenerationPrompt(examText: string, universityNote?: string): string {
  return `당신은 대학 인문논술 채점기준표를 작성하는 전문가입니다.

## 득점포인트 체계 (이 체계에 맞춰 채점기준을 만들어야 합니다 — 이것이 메인 틀)

### 보편적 득점포인트 (모든 문제에 적용)
${UNIVERSAL_POINTS.map((p) => `- ${p.name}: ${p.description}\n  체크리스트: ${p.checklist.join(' / ')}`).join('\n')}

### 기초 득점포인트
${BASIC_POINTS.map((p) => `- ${p.name}: ${p.description}\n  체크리스트: ${p.checklist.join(' / ')}`).join('\n')}

### 심화 득점포인트
${ADVANCED_POINTS.map((p) => `- ${p.name}: ${p.description}`).join('\n')}

### 4대 비판 도구 (비판 문제에 적용)
${CRITICISM_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

${getProcessMethodologyContext()}

## 배점 설계 원칙 — 채점 3계층 (반드시 이대로 배점을 쌓는다)
각 문제의 total_points를 세 계층으로 분배한다. 위 '채점 3계층'을 배점 설계의 뼈대로 삼는다.
- 기초선(합격 관문): 핵심 키워드 포함 + 발문 요구 이행. 보편적·기초 득점포인트가 여기에 들어간다. 가장 먼저 확보해야 할 배점. 이 관문이 무너지면 학생은 아래 계층 점수를 못 받는다("키워드 없으면 버려진다").
- 변별(좋은 점수): 대비 개념의 선명성 + 찾아낸 지점의 개수. 핵심비교·추론적비교·다각화가 여기.
- 고득점: 근거 구축의 구체성 + 평가적 설명·심층 인식(목적배반까지). 적용기준 세분화·연결대상 구체화·평가 양면성·비판 구체성이 여기("승부처는 근거 구축").
scoring_points의 각 항목이 셋 중 어느 계층인지 드러나게 name을 짓고, 계층 순서대로 배점한다. 함정 실점(동어반복·줄거리요약·분류실패·키워드누락)은 deduction_items 또는 global_deductions에 회복 불가 손실로 반영한다.

${getTeachingMethodologyContext()}

${universityNote ? `## 대학별 채점 참고사항\n${universityNote}\n` : ''}
## 시험 원문
${examText}

## 지시사항
각 문제에 대해 채점기준표를 작성하세요:
1. 문제의 유형을 파악하고 (비교/비판/적용/종합/요약)
2. 적용 가능한 득점포인트를 선택하여 배점
3. 문제 특성에 맞는 구체적 체크리스트 작성
4. 감점 요소 정의 (맞춤법, 분량, 논리 비약 등)
5. 핵심 포인트(☆) 표시 — 이것만 하면 기본 점수 확보

## 출력 형식 (JSON)
{
  "items": [
    {
      "question_number": 1,
      "total_points": 40,
      "scoring_points": [
        {
          "category": "보편적|기초|심화",
          "name": "포인트명",
          "points": 10,
          "checklist": ["구체적 체크 항목1", "항목2"]
        }
      ],
      "deduction_items": [
        {"name": "감점명", "condition": "조건", "deduction": -5}
      ]
    }
  ],
  "global_deductions": [
    {"name": "맞춤법 오류", "per_instance": -1, "max_deduction": -5}
  ]
}

JSON만 반환하세요.`;
}
