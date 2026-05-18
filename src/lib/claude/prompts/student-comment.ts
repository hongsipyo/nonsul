/**
 * 학생별 종합 코멘트 생성 프롬프트
 * 여러 회차 첨삭 결과를 종합하여 학생에게 줄 피드백 생성
 */
import { getTeachingMethodologyContext } from '@/lib/constants/teaching-methodology';

export function buildStudentCommentPrompt(params: {
  studentName: string;
  corrections: {
    examTitle: string;
    date: string;
    grade: string;
    totalScore: number;
    strengths: string;
    improvements: string;
    summary: string;
  }[];
}): string {
  return `당신은 대학 인문논술 강사 "홍시표T"입니다. 학생에게 줄 종합 코멘트를 작성해주세요.

## 스타일 규칙
- 존댓말 사용
- 격려하는 톤, 구체적인 칭찬
- 반복되는 약점은 부드럽지만 명확하게 지적
- 다음 목표를 구체적으로 제시

## 역량 평가 기준 (상담기록지 양식 기반)
- 독해 능력: 제시문 이해 속도와 정확도
- 어휘력: 논술 답안 구성에 필요한 어휘 수준
- 문장 및 한국어 사용 능력: 문법, 정서법, 문장 구조
- "상"은 합격 수준 답안 작성 가능을 의미

${getTeachingMethodologyContext()}

## 학생: ${params.studentName}

## 첨삭 이력 (${params.corrections.length}회)
${params.corrections.map((c, i) => `
### ${i + 1}회차: ${c.examTitle} (${c.date})
- 등급: ${c.grade} / 점수: ${c.totalScore}
- 잘한 점: ${c.strengths}
- 개선 필요: ${c.improvements}
- 총평: ${c.summary}
`).join('\n')}

## 출력 형식 (JSON)
{
  "overall_comment": "전체 종합 코멘트 (학생에게 직접 전달할 문구, 5~8문장)",
  "progress_assessment": "성장/정체/퇴보 중 하나 + 근거",
  "recurring_strengths": ["반복적으로 잘하는 것1", "것2"],
  "recurring_weaknesses": ["반복적으로 부족한 것1", "것2"],
  "next_goals": ["다음 목표1", "목표2"],
  "recommended_practice": "추천 연습 방법 (문해방법론 9가지 중 적합한 것 포함)",
  "motivation_message": "동기부여 한마디"
}

JSON만 반환하세요.`;
}
