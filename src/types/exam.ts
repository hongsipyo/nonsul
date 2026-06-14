export type MessageType = '수업안내' | '시험결과' | '상담' | '첨삭완료' | '일반';
export type MessageStatus = 'draft' | 'sent';

export interface Message {
  id: string;
  user_id: string;
  title: string;
  content: string;
  type: MessageType;
  status: MessageStatus;
  recipient_type: 'individual' | 'class' | 'all';
  recipient_student_ids?: string[];
  recipient_class_name?: string;
  recipient_names?: string[];
  exam_id?: string;
  student_id?: string;
  sent_at?: string;
  created_at: string;
  updated_at: string;
}

export type ExamStatus = 'uploaded' | 'parsing' | 'parsed' | 'analyzed' | 'error';
export type CorrectionStatus = 'uploaded' | 'processing' | 'completed' | 'error';
export type MaterialType = '해설지' | '채점기준표' | 'ppt';
export type BrandType = '프로세스' | '독립';
export type ExamType = '비교분석' | '비판평가' | '적용분석' | '종합분석' | '요약';

export interface PassageFigure {
  kind: string;                // 'table' | 'graph'
  caption?: string;
  page_number?: number;
  bbox: { x: number; y: number; w: number; h: number }; // 해당 page 내 정규화 0~1
  url?: string;                // 크롭된 표/그래프 이미지 URL (parse가 채움)
}

export interface Passage {
  label: string;       // (가), (나), (다)...
  text: string;
  source?: string;
  has_table?: boolean;
  has_graph?: boolean;
  table_markdown?: string;     // markdown 표 (폴백)
  page_number?: number;        // PDF 원본 페이지 번호
  page_image_url?: string;     // 해당 페이지 이미지 URL (폴백)
  figures?: PassageFigure[];   // ★표/그래프 원본 크롭 이미지 — 텍스트화 대신 이걸 렌더
}

export interface Question {
  number: number;
  text: string;
  type?: ExamType;
  wordLimit?: number;
  points?: number;
}

export interface Exam {
  id: string;
  user_id: string;
  title: string;
  university?: string;
  exam_year?: number;
  exam_type?: ExamType;
  original_pdf_path?: string;
  original_pdf_url?: string;
  parsed_passages?: Passage[];
  parsed_questions?: Question[];
  parsed_metadata?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  status: ExamStatus;
  created_at: string;
  updated_at: string;
}

export interface RubricScoringPoint {
  category: '보편적' | '기초' | '심화';
  name: string;
  points: number;
  checklist: string[];
}

export interface RubricDeduction {
  name: string;
  condition?: string;
  per_instance?: number;
  max_deduction?: number;
  deduction?: number;
}

export interface RubricItem {
  question_number: number;
  total_points: number;
  scoring_points: RubricScoringPoint[];
  deduction_items: RubricDeduction[];
}

export interface Rubric {
  id: string;
  exam_id: string;
  items: RubricItem[];
  global_deductions?: RubricDeduction[];
  is_ai_generated: boolean;
  is_edited: boolean;
  created_at: string;
  updated_at: string;
}

export interface Student {
  id: string;
  user_id: string;
  name: string;
  school?: string;
  grade?: number;
  target_university?: string;
  class_name?: string;
  phone?: string;
  email?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

/** 빨간펜 표시 종류 — 학생 원고지 위에 긋는 마킹 */
export type RedPenMark =
  | 'underline' // 칭찬: 밑줄 (+체크)
  | 'wave'      // 개선: 물결 밑줄
  | 'circle'    // 오류: 동그라미
  | 'strike'    // 삭제: 사선
  | 'insert'    // 삽입: ∨표시 + 위에 교정글씨
  | 'check';    // 체크 표시만

export interface MarginComment {
  id: string;
  page: number;
  y_position: number;
  text: string;
  type: 'improvement' | 'praise' | 'error' | 'suggestion';
  para?: number;          // 답안 문단 인덱스 (0부터) — 원고지 마킹 위치용
  quote?: string;         // 해당 문단 내 정확한 구절 — 마킹이 그려질 앵커
  // ── 학생 답안 이미지 위 직접 마킹 (제미나이식 빨간펜) ──
  box?: { x: number; y: number; w: number; h: number }; // 정규화 0~1, 이미지 기준 좌상단+크기
  mark?: RedPenMark;       // 빨간펜 표시 종류
  correction?: string;     // 행간·여백에 써줄 짧은 빨간 손글씨 교정
}

export interface Annotation {
  page: number;
  type: 'underline' | 'box' | 'circle' | 'strikethrough' | 'arrow' | 'check';
  coordinates: { x1: number; y1: number; x2: number; y2: number };
  color: string;
  linked_comment_id?: string;
}

export interface ScoreItem {
  name: string;
  earned: number;
  max: number;
  notes?: string;
}

export interface Correction {
  id: string;
  answer_id: string;
  exam_id: string;
  rubric_id?: string;
  annotations?: Annotation[];
  margin_comments?: MarginComment[];
  scores?: {
    question_number: number;
    point_scores: ScoreItem[];
    deductions: { name: string; count: number; deduction: number }[];
    subtotal: number;
  }[];
  total_score?: number;
  grade?: string;
  summary?: string;
  answer_outline?: string;
  strengths?: string;
  improvements?: string;
  corrected_images?: { page: number; storage_path: string; url: string }[];
  corrected_pdf_path?: string;
  brand: BrandType;
  status: CorrectionStatus;
  created_at: string;
  updated_at: string;
}
