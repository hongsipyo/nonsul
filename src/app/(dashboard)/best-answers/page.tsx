'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Star, Loader2, GraduationCap } from 'lucide-react';

interface BestAnswer {
  id: string;
  total_score?: number;
  grade?: string;
  summary?: string;
  best_answer_text?: string;
  best_answer_at?: string;
  student_answers?: {
    student_name?: string;
    student_school?: string;
    students?: { class_name?: string };
  };
  exams?: { title?: string; university?: string };
}

export default function BestAnswersPage() {
  const [items, setItems] = useState<BestAnswer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/best-answers')
      .then((r) => r.json())
      .then((d) => setItems(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, []);

  // 시험(그 주)별 그룹
  const groups = new Map<string, BestAnswer[]>();
  for (const it of items) {
    const key = it.exams?.title || '기타';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(it);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Star className="h-6 w-6 text-amber-500 fill-amber-500" />
        <h1 className="text-2xl font-bold">우수답안 모음</h1>
      </div>
      <p className="text-sm text-zinc-500">반·회차별로 선정된 그 주의 우수답안입니다. 첨삭 화면에서 ‘우수답안’을 누르면 여기에 모입니다.</p>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-zinc-400">
            <Star className="h-10 w-10 mx-auto mb-3 text-zinc-300" />
            <p>아직 선정된 우수답안이 없습니다.</p>
            <p className="text-xs mt-1">첨삭 상세 화면에서 ⭐ ‘우수답안’ 버튼으로 지정하세요.</p>
          </CardContent>
        </Card>
      ) : (
        Array.from(groups.entries()).map(([examTitle, list]) => (
          <div key={examTitle} className="space-y-3">
            <h2 className="text-base font-bold text-zinc-700 border-b pb-1">
              {examTitle}
              {list[0]?.exams?.university && <span className="text-zinc-400 font-normal"> · {list[0].exams.university}</span>}
            </h2>
            {list.map((it) => (
              <Card key={it.id} className="border-l-4 border-l-amber-400">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      {it.student_answers?.student_name || '학생'}
                      {it.student_answers?.students?.class_name && (
                        <Badge variant="outline" className="text-xs"><GraduationCap className="h-3 w-3 mr-1" />{it.student_answers.students.class_name}</Badge>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 text-sm">
                      {it.total_score != null && <span className="font-bold">{it.total_score}점</span>}
                      {it.grade && <Badge>{it.grade}</Badge>}
                      <Link href={`/corrections/${it.id}`} className="text-blue-600 hover:underline text-xs">첨삭보기</Link>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {it.summary && <p className="text-sm text-zinc-600">{it.summary}</p>}
                  {it.best_answer_text ? (
                    <div className="rounded-lg bg-amber-50/50 border border-amber-200 p-3">
                      <p className="text-xs font-bold text-amber-700 mb-1">답안 전문 (OCR)</p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-800">{it.best_answer_text}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-zinc-400">답안 전문(OCR) 미저장 — 클로드 첨삭 시 mark_best_answer로 함께 저장됩니다.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        ))
      )}
    </div>
  );
}
