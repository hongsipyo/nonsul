import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Send, MessageSquare, Users, Clock } from 'lucide-react';

const sampleMessages = [
  {
    id: 1,
    title: '5월 셋째주 수업 안내',
    content: '이번 주 화/목 수업은 연세대 기출 분석을 진행합니다.',
    recipients: '고3 인문논술 A반',
    sentAt: '2026-05-16 09:00',
    type: '수업 안내',
  },
  {
    id: 2,
    title: '출석 알림',
    content: '김민수 학생이 5/15 수업에 결석하였습니다.',
    recipients: '김민수 학부모',
    sentAt: '2026-05-15 20:30',
    type: '출석',
  },
  {
    id: 3,
    title: '시험 결과 안내',
    content: '성균관대 인문논술 모의시험 채점이 완료되었습니다.',
    recipients: '전체 학생',
    sentAt: '2026-05-12 14:00',
    type: '시험',
  },
  {
    id: 4,
    title: '클리닉 예약 확인',
    content: '5/17(토) 14:00 클리닉이 예약되었습니다.',
    recipients: '김민수',
    sentAt: '2026-05-11 10:00',
    type: '클리닉',
  },
];

const typeColor: Record<string, string> = {
  '수업 안내': 'bg-blue-100 text-blue-700',
  출석: 'bg-orange-100 text-orange-700',
  시험: 'bg-purple-100 text-purple-700',
  클리닉: 'bg-green-100 text-green-700',
};

export default function MessagesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">알림 / 메시지</h1>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
          <Send className="h-4 w-4 mr-1" />
          알림 발송
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">오늘 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">1건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">이번 주 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">3건</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-zinc-500">전체 발송</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">4건</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-orange-500" />
            발송 내역
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {sampleMessages.map((msg) => (
              <div key={msg.id} className="px-6 py-4 hover:bg-zinc-50 cursor-pointer">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium">{msg.title}</p>
                      <Badge className={typeColor[msg.type]}>{msg.type}</Badge>
                    </div>
                    <p className="text-xs text-zinc-500 line-clamp-1">{msg.content}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3" />
                        {msg.recipients}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {msg.sentAt}
                      </span>
                    </div>
                  </div>
                  <Bell className="h-4 w-4 text-zinc-300 mt-1 shrink-0" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
