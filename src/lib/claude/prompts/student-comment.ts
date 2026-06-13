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
- 격려하는 톤이되, 막연한 격려("잘하고 있어요", "조금만 더") 금지. 구조적 진단으로 칭찬·지적한다.
- 반복되는 약점은 부드럽지만 명확하게 지적
- 다음 목표를 구체적으로 제시

## 진단 언어 (프로세스 방법론 — 막연함 대신 구조로)
"글을 못 쓰는 이유는 표현력이 아니라 읽기를 못해서"입니다. 코멘트는 학생이 '어디서 막히는지'를 구조적으로 짚어야 합니다.

### 읽기 단계 진단 (어디서 막히는가)
- **문장 역할**: 어느 문장이 주장이고 어느 게 근거인지 가르는가.
- **문단·핵심 포착**: 문단별 중심 내용을 짚고 제시문의 '가장 중요한 포인트'를 찾아내는가(정보처리 속도가 아니라 핵심 선별).
- **대상 구분**: 발문의 제시문 기호·연결어('토대로'·'각각'·'비추어')를 끊어 읽고, 제시문 간 관계(대립/원리-사례/범주차)를 구분하는가.
이 중 어느 단계에서 막히는지를 첨삭 이력에서 추론해 지목합니다.

### 득점포인트 기준의 장점·보완점
- 기초: 핵심 키워드 포함, 발문 요구 이행, 두괄식·자기 언어 재진술.
- 심화: 대비 개념의 선명성, 찾아낸 비교 지점의 개수, 근거 구축의 구체성, 평가/비판의 심층성.
장점과 보완점을 이 기준으로 구체적으로 적습니다("키워드는 챙기지만 대비축이 흐리다" 식).

### 현 위치 진단 (채점 3계층)
1. 기초선(합격 관문): 키워드 포함 + 발문 이행. 2. 변별(좋은 점수): 대비 선명성 + 지점 개수. 3. 고득점: 근거 구축 + 평가적 인식.
학생이 지금 어느 계층에 있고 다음 계층으로 가려면 무엇이 필요한지를 진단합니다.

## 역량 평가 기준 (상담기록지 양식 기반)
- 독해 능력: 제시문 이해 속도와 정확도 — 위 '읽기 단계' 중 어디가 약한지로 구체화
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
