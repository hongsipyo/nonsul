'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  CalendarDays,
  Check,
  X,
  Clock,
  AlertCircle,
  Loader2,
  Users,
} from 'lucide-react';
import type { Student } from '@/types/exam';

type AttendanceStatus = 'present' | 'late' | 'absent' | 'excused';

interface ClassItem {
  id: string;
  name: string;
}

interface AttendanceRecord {
  id: string;
  student_id: string;
  class_id: string | null;
  date: string;
  status: string;
  note: string | null;
}

const statusLabel: Record<string, string> = {
  present: '출석',
  late: '지각',
  absent: '결석',
  excused: '사유',
};

const statusStyle: Record<string, string> = {
  present: 'bg-green-500 text-white hover:bg-green-600',
  late: 'bg-yellow-500 text-white hover:bg-yellow-600',
  absent: 'bg-red-500 text-white hover:bg-red-600',
  excused: 'bg-blue-500 text-white hover:bg-blue-600',
};

const statusIcon: Record<string, React.ReactNode> = {
  present: <Check className="h-3.5 w-3.5 mr-0.5" />,
  late: <Clock className="h-3.5 w-3.5 mr-0.5" />,
  absent: <X className="h-3.5 w-3.5 mr-0.5" />,
  excused: <AlertCircle className="h-3.5 w-3.5 mr-0.5" />,
};

function toKSTDateString(d: Date): string {
  const offset = 9 * 60;
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const kst = new Date(utc + offset * 60000);
  return kst.toISOString().split('T')[0];
}

export default function AttendancePage() {
  const [date, setDate] = useState(toKSTDateString(new Date()));
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [attendance, setAttendance] = useState<Record<string, AttendanceRecord>>({});
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingFor, setSavingFor] = useState<string | null>(null);

  const fetchBase = useCallback(async () => {
    setLoading(true);
    const [classRes, studentRes] = await Promise.all([
      fetch('/api/classes').then((r) => r.json()),
      fetch('/api/students').then((r) => r.json()),
    ]);
    const cls = Array.isArray(classRes) ? classRes : [];
    setClasses(cls);
    setStudents(Array.isArray(studentRes) ? studentRes : []);
    if (cls.length > 0 && !selectedClassId) {
      setSelectedClassId(cls[0].id);
    }
    setLoading(false);
  }, [selectedClassId]);

  useEffect(() => {
    fetchBase();
  }, [fetchBase]);

  // Fetch attendance for selected date + class
  useEffect(() => {
    if (!selectedClassId || !date) return;
    fetch(`/api/attendance?date=${date}&class_id=${selectedClassId}`)
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, AttendanceRecord> = {};
        if (Array.isArray(data)) {
          data.forEach((a: AttendanceRecord) => {
            map[a.student_id] = a;
          });
        }
        setAttendance(map);
      });
  }, [date, selectedClassId]);

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const filteredStudents = selectedClass
    ? students.filter((s) => s.class_name === selectedClass.name)
    : [];

  const handleMark = async (studentId: string, status: AttendanceStatus) => {
    // If already same status, toggle off (delete)
    const existing = attendance[studentId];
    if (existing && existing.status === status) {
      setSavingFor(studentId);
      await fetch(`/api/attendance?id=${existing.id}`, { method: 'DELETE' });
      setAttendance((prev) => {
        const next = { ...prev };
        delete next[studentId];
        return next;
      });
      setSavingFor(null);
      return;
    }

    setSavingFor(studentId);
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: studentId,
        class_id: selectedClassId,
        date,
        status,
      }),
    });
    if (res.ok) {
      const record = await res.json();
      setAttendance((prev) => ({ ...prev, [studentId]: record }));
    }
    setSavingFor(null);
  };

  // Summary stats
  const presentCount = Object.values(attendance).filter((a) => a.status === 'present').length;
  const lateCount = Object.values(attendance).filter((a) => a.status === 'late').length;
  const absentCount = Object.values(attendance).filter((a) => a.status === 'absent').length;
  const excusedCount = Object.values(attendance).filter((a) => a.status === 'excused').length;

  const dateObj = new Date(date + 'T00:00:00+09:00');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dateDisplay = `${dateObj.getFullYear()}년 ${dateObj.getMonth() + 1}월 ${dateObj.getDate()}일 (${dayNames[dateObj.getDay()]})`;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">출결 관리</h1>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">날짜</label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-44"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">반 선택</label>
          {classes.length > 0 ? (
            <Select value={selectedClassId} onValueChange={(v) => v && setSelectedClassId(v)}>
              <SelectTrigger className="w-52">
                <SelectValue placeholder="반 선택" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="text-sm text-zinc-400 py-2">등록된 반이 없습니다</p>
          )}
        </div>
      </div>

      {/* Summary */}
      {filteredStudents.length > 0 && (
        <div className="grid grid-cols-4 gap-3">
          <Card className="border-green-200 bg-green-50/50">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-green-600">{presentCount}</p>
              <p className="text-xs text-green-600">출석</p>
            </CardContent>
          </Card>
          <Card className="border-yellow-200 bg-yellow-50/50">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-yellow-600">{lateCount}</p>
              <p className="text-xs text-yellow-600">지각</p>
            </CardContent>
          </Card>
          <Card className="border-red-200 bg-red-50/50">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-red-600">{absentCount}</p>
              <p className="text-xs text-red-600">결석</p>
            </CardContent>
          </Card>
          <Card className="border-blue-200 bg-blue-50/50">
            <CardContent className="py-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{excusedCount}</p>
              <p className="text-xs text-blue-600">사유</p>
            </CardContent>
          </Card>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : !selectedClassId ? (
        <Card>
          <CardContent className="py-12 text-center">
            <img
              src="/stickers/chunsik-school.png"
              alt="출결"
              className="h-28 w-28 mx-auto mb-3 opacity-80"
            />
            <p className="text-zinc-500">반을 먼저 등록해주세요.</p>
          </CardContent>
        </Card>
      ) : filteredStudents.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <img
              src="/stickers/chunsik-school.png"
              alt="출결"
              className="h-28 w-28 mx-auto mb-3 opacity-80"
            />
            <p className="text-zinc-500">이 반에 등록된 학생이 없습니다.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-3">
            <CalendarDays className="h-5 w-5 text-orange-500" />
            <CardTitle className="text-base">{dateDisplay}</CardTitle>
            <Badge variant="secondary">{selectedClass?.name}</Badge>
            <Badge variant="outline" className="ml-auto">
              <Users className="h-3 w-3 mr-1" />
              {filteredStudents.length}명
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {filteredStudents.map((student) => {
                const record = attendance[student.id];
                const isSaving = savingFor === student.id;
                return (
                  <div
                    key={student.id}
                    className="flex items-center justify-between px-6 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-semibold">
                        {student.name.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-medium">{student.name}</span>
                        {student.school && (
                          <span className="text-xs text-zinc-400 ml-2">{student.school}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-400" />}
                      {(['present', 'late', 'absent', 'excused'] as AttendanceStatus[]).map(
                        (status) => (
                          <Button
                            key={status}
                            size="sm"
                            className={
                              record?.status === status
                                ? statusStyle[status]
                                : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                            }
                            onClick={() => handleMark(student.id, status)}
                            disabled={isSaving}
                          >
                            {statusIcon[status]}
                            {statusLabel[status]}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
