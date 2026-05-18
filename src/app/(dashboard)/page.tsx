import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, PenTool, Users, TrendingUp } from 'lucide-react';
import Link from 'next/link';

const stats = [
  { label: '시험지', value: '0', icon: FileText, href: '/exams' },
  { label: '첨삭 완료', value: '0', icon: PenTool, href: '/corrections' },
  { label: '학생', value: '0', icon: Users, href: '/students' },
  { label: '이번 주', value: '0건', icon: TrendingUp, href: '/corrections' },
];

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">대시보드</h1>
        <div className="flex gap-2">
          <Link href="/exams/new">
            <Button>시험 업로드</Button>
          </Link>
          <Link href="/corrections">
            <Button variant="outline">첨삭 시작</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href }) => (
          <Link key={label} href={href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-500">
                  {label}
                </CardTitle>
                <Icon className="h-4 w-4 text-zinc-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>최근 첨삭</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            아직 첨삭 기록이 없습니다. 시험을 업로드하고 첨삭을 시작하세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
