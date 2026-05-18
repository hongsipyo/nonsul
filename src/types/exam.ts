export type ExamStatus = 'uploaded' | 'parsing' | 'parsed' | 'analyzed' | 'error';
export type CorrectionStatus = 'uploaded' | 'processing' | 'completed' | 'error';
export type MaterialType = '해설지' | '채점기준표' | 'ppt';
export type BrandType = '프로세스' | '독립';
export type ExamType = '비교분석' | '비판평가' | '적용분석' | '종합분석' | '요약';

export interface Passage {
  label: string;       // (가), (나), (다)...
  text: string;
  source?: string;
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

export interface MarginComment {
  id: string;
  page: number;
  y_position: number;
  text: string;
  type: 'improvement' | 'praise' | 'error' | 'suggestion';
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
