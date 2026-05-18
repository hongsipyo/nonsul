import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, BookOpen, Users, Clock } from 'lucide-react';

const sampleClasses = [
  { id: 1, name: '고3 인문논술 A반', schedule: '화/목 18:00~20:00', studentCount: 8, status: '진행중' },
  { id: 2, name: '고2 인문논술 B반', schedule: '월/수 16:00~18:00', studentCount: 6, status: '진행중' },
  { id: 3, name: '고1 기초논술반', schedule: '토 10:00~12:00', studentCount: 10, status: '모집중' },
  { id: 4, name: '고3 파이널반', schedule: '일 14:00~17:00', studentCount: 5, status: '준비중' },
];

const statusColor: Record<string, string> = {
  진행중: 'bg-green-100 text-green-700',
  모집중: 'bg-orange-100 text-orange-700',
  준비중: 'bg-zinc-100 text-zinc-500',
};

export default function ClassesPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">반 관리</h1>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="h-4 w-4 mr-1" />
          반 추가
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {sampleClasses.map((cls) => (
          <Card key={cls.id} className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-start justify-between pb-2">
              <div className="flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-orange-500" />
                <CardTitle className="text-base">{cls.name}</CardTitle>
              </div>
              <Badge className={statusColor[cls.status]}>{cls.status}</Badge>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Clock className="h-3.5 w-3.5" />
                {cls.schedule}
              </div>
              <div className="flex items-center gap-2 text-sm text-zinc-500">
                <Users className="h-3.5 w-3.5" />
                {cls.studentCount}명
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
