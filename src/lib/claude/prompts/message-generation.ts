import type { MessageType } from '@/types/exam';

interface MessageGenParams {
  type: MessageType;
  studentName?: string;
  className?: string;
  // 시험결과용
  examTitle?: string;
  score?: number;
  grade?: string;
  strengths?: string;
  improvements?: string;
  // 상담용
  corrections?: {
    examTitle: string;
    score: number;
    grade: string;
  }[];
  // 수업안내용
  customNote?: string;
}

export function buildMessagePrompt(params: MessageGenParams): string {
  const recipientDesc = params.studentName
    ? `학생: ${params.studentName}`
    : params.className
      ? `반: ${params.className}`
      : '전체 학생';

  let context = '';

  if (params.type === '시험결과' && params.examTitle) {
    context = `
## 시험 결과 정보
- 시험: ${params.examTitle}
- 점수: ${params.score ?? '미정'}점
- 등급: ${params.grade ?? '미정'}
- 잘한 점: ${params.strengths ?? '없음'}
- 개선 필요: ${params.improvements ?? '없음'}`;
  }

  if (params.type === '상담' && params.corrections?.length) {
    context = `
## 최근 첨삭 이력
${params.corrections.map((c, i) => `${i + 1}. ${c.examTitle} — ${c.score}점 (${c.grade})`).join('\n')}`;
  }

  if (params.type === '첨삭완료' && params.examTitle) {
    context = `
## 첨삭 완료 정보
- 시험: ${params.examTitle}
- 점수: ${params.score ?? ''}점
- 등급: ${params.grade ?? ''}`;
  }

  if (params.customNote) {
    context += `\n## 추가 메모\n${params.customNote}`;
  }

  return `당신은 논술학원 강사입니다. 학부모 또는 학생에게 보낼 문자 메시지를 작성해주세요.

## 메시지 유형: ${params.type}
## 수신 대상: ${recipientDesc}
${context}

## 작성 규칙
- 학원 문자답게 정중하고 간결하게 (3~5문장)
- 존댓말 필수
- 학생 이름이 있으면 반드시 포함
- "프로세스 논술학원"으로 서명
- 이모지 쓰지 말 것
- 수업안내: 날짜/시간/내용 안내
- 시험결과: 점수/등급 + 잘한점 한줄 + 개선점 한줄 + 격려
- 상담: 최근 성적 추이 요약 + 상담 필요 여부 + 내원 안내
- 첨삭완료: 첨삭 완료 알림 + 확인 안내
- 일반: 자유 형식

## 출력 형식 (JSON)
{
  "title": "문자 제목 (10자 이내)",
  "content": "문자 본문 전체",
  "preview": "문자 미리보기 한줄 (20자 이내)"
}

JSON만 반환하세요.`;
}
