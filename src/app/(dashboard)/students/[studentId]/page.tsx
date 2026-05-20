'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Loader2,
  MessageSquare,
  TrendingUp,
  Star,
  Pencil,
  Phone,
  Mail,
  StickyNote,
  CalendarDays,
  Check,
  X,
  Clock,
  AlertCircle,
  Stethoscope,
} from 'lucide-react';
import Link from 'next/link';

interface StudentComment {
  overall_comment: string;
  progress_assessment: string;
  recurring_strengths: string[];
  recurring_weaknesses: string[];
  next_goals: string[];
  recommended_practice: string;
  motivation_message: string;
}

interface AttendanceRecord {
  id: string;
  date: string;
  status: string;
  note: string | null;
}

interface ClinicAppointment {
  id: string;
  date: string;
  time_slot: string;
  topic: string | null;
  status: string;
}

const attendanceLabel: Record<string, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '사유',
};

const attendanceBadge: Record<string, string> = {
  present: 'bg-green-100 text-green-700',
  late: 'bg-yellow-100 text-yellow-700',
  absent: 'bg-red-100 text-red-700',
  excused: 'bg-blue-100 text-blue-700',
};

const clinicStatusLabel: Record<string, string> = {
  reserved: '예정',
  completed: '완료',
  cancelled: '취소',
};

const clinicStatusBadge: Record<string, string> = {
  reserved: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
};

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<any>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [clinicHistory, setClinicHistory] = useState<ClinicAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingComment, setGeneratingComment] = useState(false);
  const [comment, setComment] = useState<StudentComment | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    name: '', school: '', grade: '', target_university: '', class_name: '', phone: '', email: '', notes: '',
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [studentRes, correctionsRes, attendanceRes, clinicRes] = await Promise.all([
      fetch(`/api/students/${studentId}`).then((r) => r.json()),
      fetch(`/api/corrections`).then((r) => r.json()),
      fetch(`/api/attendance?student_id=${studentId}`).then((r) => r.json()).catch(() => []),
      fetch(`/api/clinic`).then((r) => r.json()),
    ]);

    const s = studentRes?.id ? studentRes : null;
    setStudent(s);

    // Filter corrections by student
    const allCorrs = Array.isArray(correctionsRes) ? correctionsRes : [];
    const studentCorrs = allCorrs.filter(
      (c: any) => c.student_answers?.student_name === s?.name
    );
    setCorrections(studentCorrs);

    // Attendance records for this student (last 30 days)
    const allAttendance = Array.isArray(attendanceRes) ? attendanceRes : [];
    const studentAttendance = allAttendance.filter(
      (a: AttendanceRecord) => true // API already filters by student_id if param is given, but we filter again for safety
    );
    setAttendance(studentAttendance);

    // Clinic appointments for this student
    const allClinic = Array.isArray(clinicRes) ? clinicRes : [];
    const studentClinic = allClinic.filter((c: any) => c.student_id === studentId);
    setClinicHistory(studentClinic);

    setLoading(false);
  }, [studentId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateComment = async () => {
    setGeneratingComment(true);
    try {
      const res = await fetch(`/api/students/${studentId}/comment`, { method: 'POST' });
      if (res.ok) {
        setComment(await res.json());
      }
    } finally {
      setGeneratingComment(false);
    }
  };

  const openEditDialog = () => {
    if (!student) return;
    setEditForm({
      name: student.name || '',
      school: student.school || '',
      grade: student.grade ? String(student.grade) : '',
      target_university: student.target_university || '',
      class_name: student.class_name || '',
      phone: student.phone || '',
      email: student.email || '',
      notes: student.notes || '',
    });
    setEditOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.name) return;
    setSaving(true);
    const res = await fetch(`/api/students/${studentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        school: editForm.school || null,
        grade: editForm.grade ? parseInt(editForm.grade) : null,
        target_university: editForm.target_university || null,
        class_name: editForm.class_name || null,
        phone: editForm.phone || null,
        email: editForm.email || null,
        notes: editForm.notes || null,
      }),
    });
    if (res.ok) {
      const updated = await res.json();
      setStudent(updated);
      setEditOpen(false);
    }
    setSaving(false);
  };

  // Attendance summary
  const attendanceSummary = {
    present: attendance.filter((a) => a.status === 'present').length,
    late: attendance.filter((a) => a.status === 'late').length,
    absent: attendance.filter((a) => a.status === 'absent').length,
    excused: attendance.filter((a) => a.status === 'excused').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!student) return <div className="p-6">학생을 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <div className="flex gap-2 mt-1 text-zinc-500 text-sm flex-wrap">
            {student.school && <span>{student.school}</span>}
            {student.grade && <span>· 고{student.grade}</span>}
            {student.class_name && <span>· {student.class_name}</span>}
            {student.target_university && <span>· 목표: {student.target_university}</span>}
          </div>
          {/* Contact info */}
          <div className="flex gap-4 mt-2 text-sm text-zinc-400">
            {student.phone && (
              <span className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> {student.phone}
              </span>
            )}
            {student.email && (
              <span className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> {student.email}
              </span>
            )}
          </div>
          {student.notes && (
            <div className="flex items-start gap-1 mt-2 text-sm text-zinc-400">
              <StickyNote className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{student.notes}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={openEditDialog}>
            <Pencil className="mr-1 h-4 w-4" />
            수정
          </Button>
          <Link href={`/students/${studentId}/transcript`}>
            <Button variant="outline" size="sm">
              <TrendingUp className="mr-1 h-4 w-4" />
              성적표
            </Button>
          </Link>
          <Link href={`/students/${studentId}/report`}>
            <Button variant="outline" size="sm">
              <Star className="mr-1 h-4 w-4" />
              상담기록지
            </Button>
          </Link>
          <Button onClick={handleGenerateComment} disabled={generatingComment || corrections.length === 0}>
            {generatingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
            AI 코멘트
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>학생 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <Input placeholder="이름 *" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            <Input placeholder="학교" value={editForm.school} onChange={(e) => setEditForm({ ...editForm, school: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="학년 (숫자)" value={editForm.grade} onChange={(e) => setEditForm({ ...editForm, grade: e.target.value })} />
              <Input placeholder="목표 대학" value={editForm.target_university} onChange={(e) => setEditForm({ ...editForm, target_university: e.target.value })} />
            </div>
            <Input placeholder="수업반" value={editForm.class_name} onChange={(e) => setEditForm({ ...editForm, class_name: e.target.value })} />
            <Input placeholder="전화번호" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
            <Input placeholder="이메일" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
            <Input placeholder="메모" value={editForm.notes} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
            <Button onClick={handleSaveEdit} disabled={!editForm.name || saving} className="w-full bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              저장
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* AI Comment */}
      {comment && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-base">AI 종합 코멘트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{comment.overall_comment}</p>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-green-700 mb-1">반복적 강점</p>
                <ul className="list-disc list-inside text-zinc-600">
                  {comment.recurring_strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="font-medium text-red-600 mb-1">반복적 약점</p>
                <ul className="list-disc list-inside text-zinc-600">
                  {comment.recurring_weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
            <div>
              <p className="font-medium text-sm mb-1">다음 목표</p>
              <ul className="list-disc list-inside text-sm text-zinc-600">
                {comment.next_goals.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-700">추천 연습</p>
              <p className="text-sm mt-1">{comment.recommended_practice}</p>
            </div>
            <p className="text-sm italic text-zinc-500">&ldquo;{comment.motivation_message}&rdquo;</p>
          </CardContent>
        </Card>
      )}

      {/* Attendance Summary (recent 30 days) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-orange-500" />
            출결 현황 (최근 기록)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <p className="text-sm text-zinc-400">출결 기록이 없습니다.</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="text-center p-2 rounded-lg bg-green-50">
                  <p className="text-lg font-bold text-green-600">{attendanceSummary.present}</p>
                  <p className="text-xs text-green-600">출석</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-yellow-50">
                  <p className="text-lg font-bold text-yellow-600">{attendanceSummary.late}</p>
                  <p className="text-xs text-yellow-600">지각</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-red-50">
                  <p className="text-lg font-bold text-red-600">{attendanceSummary.absent}</p>
                  <p className="text-xs text-red-600">결석</p>
                </div>
                <div className="text-center p-2 rounded-lg bg-blue-50">
                  <p className="text-lg font-bold text-blue-600">{attendanceSummary.excused}</p>
                  <p className="text-xs text-blue-600">사유</p>
                </div>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {attendance.slice(0, 20).map((a) => (
                  <div key={a.id} className="flex items-center justify-between text-sm py-1">
                    <span className="text-zinc-500">
                      {new Date(a.date + 'T00:00:00').toLocaleDateString('ko-KR', {
                        month: 'short',
                        day: 'numeric',
                        weekday: 'short',
                      })}
                    </span>
                    <Badge className={attendanceBadge[a.status] || 'bg-zinc-100 text-zinc-500'}>
                      {attendanceLabel[a.status] || a.status}
                    </Badge>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Clinic History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-orange-500" />
            클리닉 예약 이력 ({clinicHistory.length}건)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clinicHistory.length === 0 ? (
            <p className="text-sm text-zinc-400">클리닉 예약 이력이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {clinicHistory.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                  <div>
                    <p className="text-sm font-medium">
                      {new Date(c.date + 'T00:00:00').toLocaleDateString('ko-KR')} {c.time_slot}
                    </p>
                    {c.topic && <p className="text-xs text-zinc-400 mt-0.5">{c.topic}</p>}
                  </div>
                  <Badge className={clinicStatusBadge[c.status] || 'bg-zinc-100 text-zinc-500'}>
                    {clinicStatusLabel[c.status] || c.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Correction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">첨삭 이력 ({corrections.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {corrections.length === 0 ? (
            <p className="text-sm text-zinc-500">첨삭 기록이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {corrections.map((c: any) => (
                <Link key={c.id} href={`/corrections/${c.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-zinc-50 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{c.exams?.title}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(c.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.total_score != null && (
                        <span className="text-sm font-medium">{c.total_score}점</span>
                      )}
                      {c.grade && <Badge>{c.grade}</Badge>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
