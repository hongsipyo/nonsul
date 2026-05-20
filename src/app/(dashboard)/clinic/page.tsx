'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  Stethoscope,
  Clock,
  User,
  Trash2,
  Loader2,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { Student } from '@/types/exam';

interface Appointment {
  id: string;
  student_id: string;
  date: string;
  time_slot: string;
  topic: string | null;
  status: string;
  note: string | null;
  students: { name: string; school: string | null; grade: number | null } | null;
}

const statusColor: Record<string, string> = {
  reserved: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-zinc-100 text-zinc-500',
};

const statusLabel: Record<string, string> = {
  reserved: '예정',
  completed: '완료',
  cancelled: '취소',
};

function toKSTDateString(d: Date): string {
  const offset = 9 * 60;
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const kst = new Date(utc + offset * 60000);
  return kst.toISOString().split('T')[0];
}

function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay();
  const start = new Date(baseDate);
  start.setDate(start.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    return d;
  });
}

const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

const TIME_SLOTS = [
  '10:00', '10:30', '11:00', '11:30',
  '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30',
  '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00',
];

export default function ClinicPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weekBase, setWeekBase] = useState(new Date());
  const [form, setForm] = useState({ student_id: '', date: toKSTDateString(new Date()), time_slot: '', topic: '' });

  const todayStr = toKSTDateString(new Date());

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [apptRes, studentRes] = await Promise.all([
      fetch('/api/clinic').then((r) => r.json()),
      fetch('/api/students').then((r) => r.json()),
    ]);
    setAppointments(Array.isArray(apptRes) ? apptRes : []);
    setStudents(Array.isArray(studentRes) ? studentRes : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const weekDates = useMemo(() => getWeekDates(weekBase), [weekBase]);

  const handleAdd = async () => {
    if (!form.student_id || !form.date || !form.time_slot) return;
    setSaving(true);
    const res = await fetch('/api/clinic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        student_id: form.student_id,
        date: form.date,
        time_slot: form.time_slot,
        topic: form.topic || null,
      }),
    });
    if (res.ok) {
      const appt = await res.json();
      setAppointments([...appointments, appt]);
      setForm({ student_id: '', date: todayStr, time_slot: '', topic: '' });
      setDialogOpen(false);
    }
    setSaving(false);
  };

  const handleStatusChange = async (id: string, status: string) => {
    const res = await fetch('/api/clinic', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAppointments(appointments.map((a) => (a.id === id ? updated : a)));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 예약을 삭제하시겠습니까?')) return;
    const res = await fetch(`/api/clinic?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      setAppointments(appointments.filter((a) => a.id !== id));
    }
  };

  // Group appointments by date for the week view
  const apptByDate = useMemo(() => {
    const map: Record<string, Appointment[]> = {};
    appointments.forEach((a) => {
      if (!map[a.date]) map[a.date] = [];
      map[a.date].push(a);
    });
    return map;
  }, [appointments]);

  const todayAppointments = appointments
    .filter((a) => a.date === todayStr)
    .sort((a, b) => a.time_slot.localeCompare(b.time_slot));

  const prevWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() - 7);
    setWeekBase(d);
  };
  const nextWeek = () => {
    const d = new Date(weekBase);
    d.setDate(d.getDate() + 7);
    setWeekBase(d);
  };
  const goToday = () => setWeekBase(new Date());

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">클리닉 예약</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger>
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">
              <Plus className="h-4 w-4 mr-1" />
              예약 추가
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>예약 추가</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <label className="text-xs text-zinc-500 mb-1 block">학생 *</label>
                <Select value={form.student_id} onValueChange={(v) => v && setForm({ ...form, student_id: v })}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="학생 선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.school ? `(${s.school})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">날짜 *</label>
                  <Input
                    type="date"
                    value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 mb-1 block">시간 *</label>
                  <Select value={form.time_slot} onValueChange={(v) => v && setForm({ ...form, time_slot: v })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="시간" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Input
                placeholder="주제 (예: 연세대 기출 3번 첨삭)"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
              <Button
                onClick={handleAdd}
                disabled={!form.student_id || !form.date || !form.time_slot || saving}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white"
              >
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                추가
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : appointments.length === 0 && students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <img
              src="/stickers/chunsik-coffee.png"
              alt="빈 예약"
              className="h-28 w-28 mx-auto mb-3 opacity-80"
            />
            <p className="text-zinc-500">예약이 없습니다.</p>
            <p className="text-sm text-zinc-400 mt-1">학생을 먼저 등록한 후 예약을 추가하세요.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Week Calendar View */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <Stethoscope className="h-5 w-5 text-orange-500" />
                  주간 일정
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={prevWeek}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={goToday}>
                    오늘
                  </Button>
                  <Button variant="ghost" size="sm" onClick={nextWeek}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-1">
                {weekDates.map((d, i) => {
                  const ds = toKSTDateString(d);
                  const isToday = ds === todayStr;
                  const dayAppts = apptByDate[ds] || [];
                  return (
                    <div
                      key={ds}
                      className={`rounded-lg p-2 min-h-[80px] text-center ${
                        isToday
                          ? 'bg-orange-50 ring-2 ring-orange-300'
                          : 'bg-zinc-50'
                      }`}
                    >
                      <p className="text-xs text-zinc-400">{dayNames[i]}</p>
                      <p
                        className={`text-sm font-medium ${
                          isToday ? 'text-orange-600' : ''
                        }`}
                      >
                        {d.getDate()}
                      </p>
                      {dayAppts.length > 0 && (
                        <div className="mt-1 space-y-0.5">
                          {dayAppts.slice(0, 3).map((a) => (
                            <div
                              key={a.id}
                              className="text-[10px] rounded bg-orange-100 text-orange-700 px-1 py-0.5 truncate"
                            >
                              {a.time_slot} {a.students?.name}
                            </div>
                          ))}
                          {dayAppts.length > 3 && (
                            <p className="text-[10px] text-zinc-400">+{dayAppts.length - 3}건</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Today's Appointments */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                오늘의 예약 ({todayAppointments.length}건)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {todayAppointments.length === 0 ? (
                <div className="py-8 text-center">
                  <img
                    src="/stickers/chunsik-coffee.png"
                    alt="빈 예약"
                    className="h-20 w-20 mx-auto mb-2 opacity-70"
                  />
                  <p className="text-sm text-zinc-400">오늘 예약이 없습니다.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {todayAppointments.map((appt) => (
                    <div
                      key={appt.id}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex flex-col items-center text-sm">
                          <Clock className="h-4 w-4 text-zinc-400 mb-0.5" />
                          <span className="text-xs font-medium text-zinc-600">
                            {appt.time_slot}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium flex items-center gap-2">
                            <User className="h-3.5 w-3.5 text-zinc-400" />
                            {appt.students?.name || '(삭제된 학생)'}
                          </p>
                          {appt.topic && (
                            <p className="text-xs text-zinc-400 mt-0.5">{appt.topic}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={statusColor[appt.status] || statusColor.reserved}>
                          {statusLabel[appt.status] || appt.status}
                        </Badge>
                        {appt.status === 'reserved' && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-green-600 hover:text-green-700 hover:bg-green-50"
                              onClick={() => handleStatusChange(appt.id, 'completed')}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-zinc-400 hover:text-red-500 hover:bg-red-50"
                              onClick={() => handleStatusChange(appt.id, 'cancelled')}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-zinc-400 hover:text-red-500"
                          onClick={() => handleDelete(appt.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
