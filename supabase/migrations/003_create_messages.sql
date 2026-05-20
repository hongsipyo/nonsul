-- ============================================
-- MESSAGES (문자/알림 발송 내역)
-- ============================================
CREATE TYPE message_type AS ENUM ('수업안내', '시험결과', '상담', '첨삭완료', '일반');
CREATE TYPE message_status AS ENUM ('draft', 'sent');

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type message_type DEFAULT '일반',
  status message_status DEFAULT 'draft',
  -- 수신자 정보: 개별 학생 or 반 단위
  recipient_type TEXT NOT NULL DEFAULT 'individual', -- 'individual' | 'class' | 'all'
  recipient_student_ids UUID[] DEFAULT '{}',
  recipient_class_name TEXT,
  recipient_names TEXT[] DEFAULT '{}', -- 표시용 이름 목록
  -- 연관 데이터 (시험결과/첨삭완료 등에서 참조)
  exam_id UUID REFERENCES exams(id) ON DELETE SET NULL,
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  -- 메타
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_messages_user ON messages(user_id);
CREATE INDEX idx_messages_type ON messages(type);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own messages" ON messages
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
