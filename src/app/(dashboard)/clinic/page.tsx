import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Stethoscope, Clock, User } from 'lucide-react';

const todayReservations = [
  { id: 1, studentName: '김민수', time: '14:00', topic: '연세대 기출 3번 첨삭', status: '예정' },
  { id: 2, studentName: '이서연', time: '15:00', topic: '고려대 기출 논제 분석', status: '진행중' },
  { id: 3, studentName: '정예린', time: '16:30', topic: '성대 모의 답안 피드백', status: '완료' },
];

const statusColor: Record<string, string> = {
  예정: 'bg-blue-100 text-blue-700',
  진행중: 'bg-orange-100 text-orange-700',
  완료: 'bg-green-100 text-green-700',
};

export default function ClinicPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">클리닉 예약</h1>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-1" />
          예약 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-5 w-5 text-orange-500" />
            캘린더 뷰
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-zinc-400 mb-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
              <div key={day} className="py-1 font-medium">{day}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-sm">
            {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
              <div
                key={day}
                className={`py-2 rounded-md cursor-pointer transition-colors ${
                  day === 17
                    ? 'bg-orange-500 text-white font-bold'
                    : [15, 20, 22, 27].includes(day)
                      ? 'bg-orange-50 text-orange-600 font-medium'
                      : 'hover:bg-zinc-100'
                }`}
              >
                {day}
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-xs text-zinc-400">
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-500" /> 오늘
            </span>
            <span className="flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-orange-200" /> 예약 있음
            </span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">오늘의 예약 ({todayReservations.length}건)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {todayReservations.map((res) => (
              <div key={res.id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center text-sm">
                    <Clock className="h-4 w-4 text-zinc-400 mb-0.5" />
                    <span className="text-xs font-medium text-zinc-600">{res.time}</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium flex items-center gap-2">
                      <User className="h-3.5 w-3.5 text-zinc-400" />
                      {res.studentName}
                    </p>
                    <p className="text-xs text-zinc-400 mt-0.5">{res.topic}</p>
                  </div>
                </div>
                <Badge className={statusColor[res.status]}>{res.status}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
