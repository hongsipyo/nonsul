-- ============================================
-- STUDENT MANAGEMENT: Classes, Attendance, Clinic
-- ============================================

-- Classes (반 관리)
CREATE TABLE classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  schedule TEXT, -- "화/목 19:00-21:00" 등
  max_students INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own classes" ON classes FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Attendance (출결)
CREATE TABLE attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'present', -- present, late, absent, excused
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(student_id, date, class_id)
);
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own attendance" ON attendance FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_attendance_date ON attendance(date DESC);
CREATE INDEX idx_attendance_student ON attendance(student_id);

-- Clinic appointments (클리닉 예약)
CREATE TABLE clinic_appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  time_slot TEXT NOT NULL, -- "14:00" 등
  topic TEXT,
  status TEXT DEFAULT 'reserved', -- reserved, completed, cancelled
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE clinic_appointments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users own appointments" ON clinic_appointments FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
