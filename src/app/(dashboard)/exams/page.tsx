'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Calendar, Loader2 } from 'lucide-react';
import Link from 'next/link';
import type { Exam } from '@/types/exam';

const statusLabel: Record<string, { text: string; variant: 'default' | 'outline' | 'destructive' }> = {
  uploaded: { text: '업로드됨', variant: 'outline' },
  parsing: { text: '파싱 중', variant: 'outline' },
  parsed: { text: '파싱 완료', variant: 'default' },
  analyzed: { text: '분석 완료', variant: 'default' },
  error: { text: '오류', variant: 'destructive' },
};

export default function ExamsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/exams')
      .then((r) => r.json())
      .then((data) => setExams(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">시험 관리</h1>
        <Link href="/exams/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            시험 업로드
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-400" />
        </div>
      ) : exams.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 mx-auto text-zinc-300 mb-3" />
            <p className="text-zinc-500">
              아직 업로드된 시험이 없습니다.
            </p>
            <p className="text-sm text-zinc-400 mt-1">
              PDF를 업로드하면 AI가 자동으로 제시문과 문제를 파싱합니다.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {exams.map((exam) => {
            const s = statusLabel[exam.status] || statusLabel.uploaded;
            const passageCount = exam.parsed_passages?.length || 0;
            const questionCount = exam.parsed_questions?.length || 0;

            return (
              <Link key={exam.id} href={`/exams/${exam.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                        <FileText className="h-5 w-5 text-zinc-500" />
                      </div>
                      <div>
                        <p className="font-medium">{exam.title}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-sm text-zinc-400">
                          {exam.university && <span>{exam.university}</span>}
                          {passageCount > 0 && (
                            <span>제시문 {passageCount}개 · 문제 {questionCount}개</span>
                          )}
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(exam.created_at).toLocaleDateString('ko-KR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant={s.variant}>{s.text}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
