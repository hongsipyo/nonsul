import {
  UNIVERSAL_POINTS,
  BASIC_POINTS,
  ADVANCED_POINTS,
  CRITICISM_TOOLS,
} from '@/lib/constants/scoring-points';

export function buildRubricGenerationPrompt(examText: string): string {
  return `당신은 대학 인문논술 채점기준표를 작성하는 전문가입니다.

## 득점포인트 체계 (이 체계에 맞춰 채점기준을 만들어야 합니다)

### 보편적 득점포인트 (모든 문제에 적용)
${UNIVERSAL_POINTS.map((p) => `- ${p.name}: ${p.description}\n  체크리스트: ${p.checklist.join(' / ')}`).join('\n')}

### 기초 득점포인트
${BASIC_POINTS.map((p) => `- ${p.name}: ${p.description}\n  체크리스트: ${p.checklist.join(' / ')}`).join('\n')}

### 심화 득점포인트
${ADVANCED_POINTS.map((p) => `- ${p.name}: ${p.description}`).join('\n')}

### 4대 비판 도구 (비판 문제에 적용)
${CRITICISM_TOOLS.map((t) => `- ${t.name}: ${t.description}`).join('\n')}

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
