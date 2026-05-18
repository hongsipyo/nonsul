'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, MessageSquare, TrendingUp, Star } from 'lucide-react';
import Link from 'next/link';

interface StudentComment {
  overall_comment: string;
  progress_assessment: string;
  recurring_strengths: string[];
  recurring_weaknesses: string[];
  next_goals: string[];
  recommended_practice: string;
  motivation_message: string;
}

export default function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<any>(null);
  const [corrections, setCorrections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingComment, setGeneratingComment] = useState(false);
  const [comment, setComment] = useState<StudentComment | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`/api/students`).then((r) => r.json()),
      fetch(`/api/corrections`).then((r) => r.json()),
    ]).then(([students, allCorrections]) => {
      const s = (Array.isArray(students) ? students : []).find((s: any) => s.id === studentId);
      setStudent(s);
      // Filter corrections by student (through student_answers)
      const studentCorrs = (Array.isArray(allCorrections) ? allCorrections : []).filter(
        (c: any) => c.student_answers?.student_name === s?.name
      );
      setCorrections(studentCorrs);
      setLoading(false);
    });
  }, [studentId]);

  const handleGenerateComment = async () => {
    setGeneratingComment(true);
    try {
      const res = await fetch(`/api/students/${studentId}/comment`, { method: 'POST' });
      if (res.ok) {
        setComment(await res.json());
      }
    } finally {
      setGeneratingComment(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!student) return <div className="p-6">학생을 찾을 수 없습니다.</div>;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{student.name}</h1>
          <div className="flex gap-2 mt-1 text-zinc-500 text-sm">
            {student.school && <span>{student.school}</span>}
            {student.class_name && <span>· {student.class_name}</span>}
            {student.target_university && <span>· 목표: {student.target_university}</span>}
          </div>
        </div>
        <Button onClick={handleGenerateComment} disabled={generatingComment || corrections.length === 0}>
          {generatingComment ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
          AI 종합 코멘트 생성
        </Button>
      </div>

      {/* AI Comment */}
      {comment && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader>
            <CardTitle className="text-base">AI 종합 코멘트</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm leading-relaxed">{comment.overall_comment}</p>
            <Separator />
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-green-700 mb-1">반복적 강점</p>
                <ul className="list-disc list-inside text-zinc-600">
                  {comment.recurring_strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
              <div>
                <p className="font-medium text-red-600 mb-1">반복적 약점</p>
                <ul className="list-disc list-inside text-zinc-600">
                  {comment.recurring_weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                </ul>
              </div>
            </div>
            <div>
              <p className="font-medium text-sm mb-1">다음 목표</p>
              <ul className="list-disc list-inside text-sm text-zinc-600">
                {comment.next_goals.map((g, i) => <li key={i}>{g}</li>)}
              </ul>
            </div>
            <div className="bg-amber-50 rounded-lg p-3">
              <p className="text-sm font-medium text-amber-700">추천 연습</p>
              <p className="text-sm mt-1">{comment.recommended_practice}</p>
            </div>
            <p className="text-sm italic text-zinc-500">&ldquo;{comment.motivation_message}&rdquo;</p>
          </CardContent>
        </Card>
      )}

      {/* Correction History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">첨삭 이력 ({corrections.length}건)</CardTitle>
        </CardHeader>
        <CardContent>
          {corrections.length === 0 ? (
            <p className="text-sm text-zinc-500">첨삭 기록이 없습니다.</p>
          ) : (
            <div className="space-y-3">
              {corrections.map((c: any) => (
                <Link key={c.id} href={`/corrections/${c.id}`}>
                  <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-zinc-50 cursor-pointer">
                    <div>
                      <p className="text-sm font-medium">{c.exams?.title}</p>
                      <p className="text-xs text-zinc-400">
                        {new Date(c.created_at).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.total_score != null && (
                        <span className="text-sm font-medium">{c.total_score}점</span>
                      )}
                      {c.grade && <Badge>{c.grade}</Badge>}
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
