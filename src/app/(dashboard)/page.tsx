'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, PenTool, Users, TrendingUp, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface StatItem {
  label: string;
  value: string;
  icon: typeof FileText;
  href: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatItem[]>([
    { label: '시험지', value: '-', icon: FileText, href: '/exams' },
    { label: '첨삭 완료', value: '-', icon: PenTool, href: '/corrections' },
    { label: '학생', value: '-', icon: Users, href: '/students' },
    { label: '이번 주', value: '-', icon: TrendingUp, href: '/corrections' },
  ]);
  const [loading, setLoading] = useState(true);
  const [recentCorrections, setRecentCorrections] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      fetch('/api/exams').then((r) => r.json()).catch(() => []),
      fetch('/api/corrections').then((r) => r.json()).catch(() => []),
      fetch('/api/students').then((r) => r.json()).catch(() => []),
    ]).then(([exams, corrections, students]) => {
      const examsArr = Array.isArray(exams) ? exams : [];
      const correctionsArr = Array.isArray(corrections) ? corrections : [];
      const studentsArr = Array.isArray(students) ? students : [];

      // Count corrections from this week
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisWeek = correctionsArr.filter(
        (c: any) => new Date(c.created_at) >= weekAgo
      );

      setStats([
        { label: '시험지', value: String(examsArr.length), icon: FileText, href: '/exams' },
        { label: '첨삭 완료', value: String(correctionsArr.length), icon: PenTool, href: '/corrections' },
        { label: '학생', value: String(studentsArr.length), icon: Users, href: '/students' },
        { label: '이번 주', value: `${thisWeek.length}건`, icon: TrendingUp, href: '/corrections' },
      ]);

      // Keep latest 5 corrections for recent list
      setRecentCorrections(
        correctionsArr
          .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
      setLoading(false);
    });
  }, []);

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
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                ) : (
                  <div className="text-2xl font-bold">{value}</div>
                )}
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
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
            </div>
          ) : recentCorrections.length === 0 ? (
            <p className="text-sm text-zinc-500">
              아직 첨삭 기록이 없습니다. 시험을 업로드하고 첨삭을 시작하세요.
            </p>
          ) : (
            <div className="space-y-2">
              {recentCorrections.map((c: any) => (
                <Link key={c.id} href={`/corrections/${c.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-zinc-50 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{c.exams?.title || '첨삭'}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(c.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      {c.total_score != null && (
                        <span className="font-medium">{c.total_score}점</span>
                      )}
                      {c.status === 'completed' && (
                        <span className="text-green-600 text-xs">완료</span>
                      )}
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
