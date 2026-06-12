-- 우수답안: 반당/회차(시험)당 1개. 선정된 첨삭에 플래그 + OCR 전문 저장.
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS is_best_answer boolean DEFAULT false;
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS best_answer_text text;       -- 우수답안 OCR 전문
ALTER TABLE corrections ADD COLUMN IF NOT EXISTS best_answer_at timestamptz;  -- 선정 시각

CREATE INDEX IF NOT EXISTS idx_corrections_best_answer ON corrections (exam_id) WHERE is_best_answer = true;
