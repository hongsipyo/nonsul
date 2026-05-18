'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, CalendarDays, Check, X, Clock } from 'lucide-react';
import { useState } from 'react';

type AttendanceStatus = '출석' | '결석' | '지각' | null;

const sampleStudents = [
  { id: 1, name: '김민수', className: '고3 인문논술 A반' },
  { id: 2, name: '이서연', className: '고3 인문논술 A반' },
  { id: 3, name: '박지훈', className: '고3 인문논술 A반' },
  { id: 4, name: '정예린', className: '고3 인문논술 A반' },
  { id: 5, name: '최도윤', className: '고3 인문논술 A반' },
  { id: 6, name: '한소희', className: '고3 인문논술 A반' },
];

const statusStyle: Record<string, string> = {
  출석: 'bg-green-500 text-white hover:bg-green-600',
  결석: 'bg-red-500 text-white hover:bg-red-600',
  지각: 'bg-yellow-500 text-white hover:bg-yellow-600',
};

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<Record<number, AttendanceStatus>>({});

  const handleMark = (studentId: number, status: AttendanceStatus) => {
    setAttendance((prev) => ({
      ...prev,
      [studentId]: prev[studentId] === status ? null : status,
    }));
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">출석 관리</h1>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
          <Bell className="h-4 w-4 mr-1" />
          출석 알림 발송
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center gap-3 pb-3">
          <CalendarDays className="h-5 w-5 text-orange-500" />
          <CardTitle className="text-base">2026년 5월 17일 (토)</CardTitle>
          <Badge variant="secondary">고3 인문논술 A반</Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {sampleStudents.map((student) => (
              <div
                key={student.id}
                className="flex items-center justify-between px-6 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-sm font-semibold">
                    {student.name.charAt(0)}
                  </div>
                  <span className="text-sm font-medium">{student.name}</span>
                </div>
                <div className="flex gap-2">
                  {(['출석', '결석', '지각'] as AttendanceStatus[]).map((status) => (
                    <Button
                      key={status}
                      size="sm"
                      className={
                        attendance[student.id] === status
                          ? statusStyle[status!]
                          : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                      }
                      onClick={() => handleMark(student.id, status)}
                    >
                      {status === '출석' && <Check className="h-3.5 w-3.5 mr-0.5" />}
                      {status === '결석' && <X className="h-3.5 w-3.5 mr-0.5" />}
                      {status === '지각' && <Clock className="h-3.5 w-3.5 mr-0.5" />}
                      {status}
                    </Button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="text-sm text-zinc-400 text-center">
        출석 처리 후 &ldquo;출석 알림 발송&rdquo; 버튼으로 학부모에게 알림을 보낼 수 있습니다.
      </div>
    </div>
  );
}
