# 프로세스학원 출근 시 업무 자동화 체크리스트

## 수업 준비 (수업 전)

| 업무 | 자동화 상태 | API/기능 |
|------|-----------|----------|
| 기출문제 PDF 업로드 | ✅ 완료 | POST /api/exams |
| PDF → 제시문/문제 텍스트 파싱 | ✅ 완료 | POST /api/exams/[id]/parse (Claude Vision) |
| 채점기준표 자동 생성 | ✅ 완료 | POST /api/exams/[id]/rubric |
| 채점기준표 수동 편집 | ✅ UI 뼈대, 편집 API 있음 | PATCH /api/exams/[id]/rubric |
| 수업 PPT 생성 (검은배경) | ✅ 완료 | POST /api/exams/[id]/materials {type:'ppt'} |
| 해설지 생성 (논제분석+예시답안) | ✅ 완료 | POST /api/exams/[id]/materials {type:'해설지'} |
| 프로세스/독립 브랜딩 토글 | ✅ brand 파라미터로 구현 | body.brand = '프로세스' or '독립' |

## 수업 중/후 (첨삭)

| 업무 | 자동화 상태 | API/기능 |
|------|-----------|----------|
| 학생 답안 이미지 업로드 | ✅ 완료 | POST /api/corrections (multipart) |
| AI 첨삭 (홍시표T 스타일) | ✅ 완료 | POST /api/corrections/[id]/generate |
| 코멘트: 칭찬/개선/오류/제안 | ✅ AI가 자동 분류 | margin_comments[].type |
| 학생 답안 전개 요약 | ✅ AI가 자동 생성 | correction.answer_outline |
| 종합 총평 | ✅ AI가 자동 생성 | correction.summary |
| 등급/점수 | ✅ AI가 채점기준 기반 산출 | correction.grade, total_score |
| 잘한부분/개선포인트 분리 | ✅ AI가 자동 분리 | correction.strengths, improvements |
| 첨삭 결과 PDF 내보내기 | ⚠️ 미완성 | 빨간펜 이미지 렌더링 필요 |
| 우수답안 선정 + 근거 | ✅ 완료 | POST /api/exams/[id]/best-answer |

## 학생 관리

| 업무 | 자동화 상태 | API/기능 |
|------|-----------|----------|
| 학생 등록/수정 | ✅ 완료 | POST/GET /api/students |
| 학생별 첨삭 이력 | ✅ DB 구조 완료, UI 미연결 | corrections → student_answers → students |
| 학생별 종합 코멘트 (AI) | ✅ 완료 | POST /api/students/[id]/comment |
| 점수 추이 그래프 | ⚠️ 미완성 | recharts 설치 필요 |
| OCR → 학생답안 텍스트화 | ✅ Claude Vision이 처리 | correction generate 과정에서 자동 |

## 미완성 항목 (추가 구현 필요)

1. **첨삭 결과 PDF 내보내기** — 빨간펜 오버레이 이미지 렌더링 (sharp/canvas)
2. **학생 상세 페이지 UI** — 첨삭 이력 + 점수 추이 차트
3. **일괄 첨삭** — 여러 학생 답안 한번에 업로드 → 순차 처리
4. **첨삭 수정 UI** — AI 결과를 교사가 수정 가능하게
5. **해설지 PDF 내보내기** — 현재 JSON으로만 생성, PDF 변환 필요
