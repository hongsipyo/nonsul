-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE exam_status AS ENUM ('uploaded', 'parsing', 'parsed', 'analyzed', 'error');
CREATE TYPE correction_status AS ENUM ('uploaded', 'processing', 'completed', 'error');
CREATE TYPE material_type AS ENUM ('해설지', '채점기준표', 'ppt');
CREATE TYPE brand_type AS ENUM ('프로세스', '독립');

-- ============================================
-- 1. EXAMS (시험지)
-- ============================================
CREATE TABLE exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  university TEXT,
  exam_year INTEGER,
  original_pdf_path TEXT,
  original_pdf_url TEXT,
  parsed_passages JSONB,
  parsed_questions JSONB,
  parsed_metadata JSONB,
  analysis JSONB,
  status exam_status DEFAULT 'uploaded',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 2. RUBRICS (채점기준표)
-- ============================================
CREATE TABLE rubrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  items JSONB NOT NULL DEFAULT '[]',
  global_deductions JSONB,
  is_ai_generated BOOLEAN DEFAULT true,
  is_edited BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 3. STUDENTS (학생)
-- ============================================
CREATE TABLE students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  school TEXT,
  grade INTEGER,
  target_university TEXT,
  class_name TEXT,
  phone TEXT,
  email TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 4. STUDENT_ANSWERS (학생답안)
-- ============================================
CREATE TABLE student_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  student_name TEXT,
  student_school TEXT,
  answer_images JSONB,
  answer_text TEXT,
  question_number INTEGER,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 5. CORRECTIONS (첨삭결과)
-- ============================================
CREATE TABLE corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  answer_id UUID REFERENCES student_answers(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  rubric_id UUID REFERENCES rubrics(id) ON DELETE SET NULL,
  annotations JSONB,
  margin_comments JSONB,
  scores JSONB,
  total_score NUMERIC,
  grade TEXT,
  summary TEXT,
  answer_outline TEXT,
  strengths TEXT,
  improvements TEXT,
  corrected_images JSONB,
  corrected_pdf_path TEXT,
  brand brand_type DEFAULT '프로세스',
  status correction_status DEFAULT 'uploaded',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- 6. GENERATED_MATERIALS (수업자료)
-- ============================================
CREATE TABLE generated_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  type material_type NOT NULL,
  brand brand_type DEFAULT '프로세스',
  content JSONB,
  file_path TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_exams_user ON exams(user_id);
CREATE INDEX idx_exams_status ON exams(status);
CREATE INDEX idx_student_answers_exam ON student_answers(exam_id);
CREATE INDEX idx_student_answers_student ON student_answers(student_id);
CREATE INDEX idx_corrections_answer ON corrections(answer_id);
CREATE INDEX idx_corrections_exam ON corrections(exam_id);
CREATE INDEX idx_corrections_status ON corrections(status);
CREATE INDEX idx_generated_materials_exam ON generated_materials(exam_id);
CREATE INDEX idx_students_user ON students(user_id);

-- ============================================
-- RLS (일단 비활성 — 단일 사용자)
-- ============================================
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE rubrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE corrections ENABLE ROW LEVEL SECURITY;
ALTER TABLE generated_materials ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 접근 (단일 사용자용 간단 정책)
CREATE POLICY "Authenticated users full access" ON exams FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON rubrics FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON students FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON student_answers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON corrections FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Authenticated users full access" ON generated_materials FOR ALL USING (auth.role() = 'authenticated');
