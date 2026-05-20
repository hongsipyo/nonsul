'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileText, PenTool, Users, TrendingUp, Loader2 } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

interface StatItem {
  label: string;
  value: string;
  emoji: string;
  href: string;
  color: string;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<StatItem[]>([
    { label: '시험지', value: '-', emoji: '📝', href: '/exams', color: 'from-blue-50 to-blue-100 border-blue-200' },
    { label: '첨삭 완료', value: '-', emoji: '✅', href: '/corrections', color: 'from-green-50 to-green-100 border-green-200' },
    { label: '학생', value: '-', emoji: '👨‍🎓', href: '/students', color: 'from-purple-50 to-purple-100 border-purple-200' },
    { label: '이번 주', value: '-', emoji: '🔥', href: '/corrections', color: 'from-orange-50 to-orange-100 border-orange-200' },
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

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const thisWeek = correctionsArr.filter(
        (c: any) => new Date(c.created_at) >= weekAgo
      );

      setStats([
        { label: '시험지', value: String(examsArr.length), emoji: '📝', href: '/exams', color: 'from-blue-50 to-blue-100 border-blue-200' },
        { label: '첨삭 완료', value: String(correctionsArr.length), emoji: '✅', href: '/corrections', color: 'from-green-50 to-green-100 border-green-200' },
        { label: '학생', value: String(studentsArr.length), emoji: '👨‍🎓', href: '/students', color: 'from-purple-50 to-purple-100 border-purple-200' },
        { label: '이번 주', value: `${thisWeek.length}건`, emoji: '🔥', href: '/corrections', color: 'from-orange-50 to-orange-100 border-orange-200' },
      ]);

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
      {/* 인사 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image src="/stickers/chunsik-love.png" alt="춘식이" width={56} height={56} />
          <div>
            <h1 className="text-2xl font-bold text-zinc-800">대치동 논술1타 홍시표</h1>
            <p className="text-sm text-zinc-400">멋진논술연구소</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/exams/new">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white">📝 시험 업로드</Button>
          </Link>
          <Link href="/corrections">
            <Button variant="outline" className="border-orange-200 text-orange-600 hover:bg-orange-50">✏️ 첨삭 시작</Button>
          </Link>
        </div>
      </div>

      {/* 통계 카드 */}
      <div className="grid gap-4 md:grid-cols-4">
        {stats.map(({ label, value, emoji, href, color }) => (
          <Link key={label} href={href}>
            <Card className={`hover:shadow-md transition-all cursor-pointer bg-gradient-to-br ${color} hover:scale-[1.02]`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-zinc-600">
                  {label}
                </CardTitle>
                <span className="text-xl">{emoji}</span>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
                ) : (
                  <div className="text-2xl font-bold text-zinc-800">{value}</div>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* 최근 첨삭 */}
      <Card className="border-orange-100">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span>📋</span> 최근 첨삭
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-zinc-300" />
            </div>
          ) : recentCorrections.length === 0 ? (
            <div className="text-center py-6">
              <Image src="/stickers/chunsik-zzz.png" alt="춘식이 자는 중" width={64} height={64} className="mx-auto mb-3" />
              <p className="text-sm text-zinc-500">
                아직 첨삭 기록이 없어요!
              </p>
              <p className="text-xs text-zinc-400 mt-1">
                시험을 업로드하고 첨삭을 시작해보세요
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCorrections.map((c: any) => (
                <Link key={c.id} href={`/corrections/${c.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-xl border border-orange-100 hover:bg-orange-50/50 cursor-pointer transition-colors">
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
                        <span className="text-green-600 text-xs">✅ 완료</span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 춘식이 */}
      <Card className="border-orange-100 bg-gradient-to-r from-orange-50/50 to-yellow-50/50">
        <CardContent className="py-4">
          <p className="text-xs text-orange-400 text-center mb-3">대치동 논술1타 홍시표</p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Image src="/stickers/chunsik-fighting.png" alt="화이팅" width={52} height={52} className="hover:scale-110 transition-transform" title="화이팅!" />
            <Image src="/stickers/chunsik-coffee.png" alt="카페?" width={52} height={52} className="hover:scale-110 transition-transform" title="카페?" />
            <Image src="/stickers/chunsik-excited.png" alt="흥분" width={52} height={52} className="hover:scale-110 transition-transform" title="흥분!" />
            <Image src="/stickers/chunsik-music.png" alt="음악" width={52} height={52} className="hover:scale-110 transition-transform" title="신나~" />
            <Image src="/stickers/chunsik-sleep.png" alt="잠" width={52} height={52} className="hover:scale-110 transition-transform" title="아 지각" />
            <Image src="/stickers/chunsik-school.png" alt="등교" width={52} height={52} className="hover:scale-110 transition-transform" title="등교등교" />
            <Image src="/stickers/chunsik-off.jpg" alt="OFF" width={52} height={52} className="hover:scale-110 transition-transform rounded-lg" title="OFF" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
