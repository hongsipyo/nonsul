'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, FileText, Calendar, Loader2, Trash2 } from 'lucide-react';
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
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/exams')
      .then((r) => r.json())
      .then((data) => setExams(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (e: React.MouseEvent, examId: string, title: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${title}" 시험을 삭제하시겠습니까?`)) return;

    setDeleting(examId);
    try {
      const res = await fetch(`/api/exams/${examId}`, { method: 'DELETE' });
      if (res.ok) {
        setExams((prev) => prev.filter((ex) => ex.id !== examId));
      }
    } finally {
      setDeleting(null);
    }
  };

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
            <img src="/stickers/chunsik-coffee.png" alt="춘식이" className="h-16 w-16 mx-auto mb-3" />
            <p className="text-zinc-500">아직 업로드된 시험이 없어요!</p>
            <p className="text-sm text-zinc-400 mt-1">파일을 업로드하면 AI가 자동으로 파싱합니다</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {exams.map((exam) => {
            const s = statusLabel[exam.status] || statusLabel.uploaded;
            const passageCount = exam.parsed_passages?.length || 0;
            const questionCount = exam.parsed_questions?.length || 0;
            const isDeleting = deleting === exam.id;

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
                    <div className="flex items-center gap-2">
                      <Badge variant={s.variant}>{s.text}</Badge>
                      <button
                        onClick={(e) => handleDelete(e, exam.id, exam.title)}
                        disabled={isDeleting}
                        className="p-1.5 rounded-md text-zinc-400 hover:text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                        title="삭제"
                      >
                        {isDeleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </button>
                    </div>
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
