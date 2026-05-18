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

## 지시사항
1. 가장 우수한 답안 1개를 선정하세요
2. 선정 근거를 구체적으로 작성하세요 (어떤 점이 다른 답안보다 뛰어난지)
3. 우수답안이지만 아쉬운 점도 짚어주세요
4. 다른 학생들이 참고할 포인트를 정리하세요

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
