'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, BookOpen, PenTool, Download } from 'lucide-react';
import type { Exam, Passage, Question } from '@/types/exam';

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);

  useEffect(() => {
    fetch(`/api/exams/${examId}`)
      .then((r) => r.json())
      .then(setExam)
      .finally(() => setLoading(false));
  }, [examId]);

  const handleParse = async () => {
    setParsing(true);
    try {
      const res = await fetch(`/api/exams/${examId}/parse`, { method: 'POST' });
      if (res.ok) {
        const updated = await fetch(`/api/exams/${examId}`).then((r) => r.json());
        setExam(updated);
      }
    } finally {
      setParsing(false);
    }
  };

  const handleGenerateRubric = async () => {
    setGeneratingRubric(true);
    try {
      await fetch(`/api/exams/${examId}/rubric`, { method: 'POST' });
    } finally {
      setGeneratingRubric(false);
    }
  };

  const handleGeneratePpt = async () => {
    setGeneratingPpt(true);
    try {
      const res = await fetch(`/api/exams/${examId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ppt', brand: '프로세스' }),
      });
      const data = await res.json();
      if (data.url) window.open(data.url, '_blank');
    } finally {
      setGeneratingPpt(false);
    }
  };

  const handleGenerateExplanation = async () => {
    setGeneratingExplanation(true);
    try {
      await fetch(`/api/exams/${examId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: '해설지', brand: '프로세스' }),
      });
    } finally {
      setGeneratingExplanation(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!exam) return <div className="p-6">시험을 찾을 수 없습니다.</div>;

  const passages = (exam.parsed_passages || []) as Passage[];
  const questions = (exam.parsed_questions || []) as Question[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{exam.title}</h1>
          {exam.university && (
            <p className="text-zinc-500 mt-1">{exam.university}</p>
          )}
        </div>
        <Badge
          variant={
            exam.status === 'parsed' || exam.status === 'analyzed'
              ? 'default'
              : exam.status === 'error'
              ? 'destructive'
              : 'outline'
          }
        >
          {exam.status === 'uploaded' && '업로드됨'}
          {exam.status === 'parsing' && '파싱 중...'}
          {exam.status === 'parsed' && '파싱 완료'}
          {exam.status === 'analyzed' && '분석 완료'}
          {exam.status === 'error' && '오류'}
        </Badge>
      </div>

      {exam.status === 'uploaded' && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-zinc-500 mb-4">
              PDF가 업로드되었습니다. AI 파싱을 시작하세요.
            </p>
            <Button onClick={handleParse} disabled={parsing}>
              {parsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  파싱 중... (30초~1분 소요)
                </>
              ) : (
                'AI 파싱 시작'
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {passages.length > 0 && (
        <Tabs defaultValue="passages">
          <TabsList>
            <TabsTrigger value="passages">
              <FileText className="mr-1.5 h-3.5 w-3.5" />
              시험 원문
            </TabsTrigger>
            <TabsTrigger value="materials">
              <BookOpen className="mr-1.5 h-3.5 w-3.5" />
              수업자료
            </TabsTrigger>
            <TabsTrigger value="corrections">
              <PenTool className="mr-1.5 h-3.5 w-3.5" />
              첨삭 목록
            </TabsTrigger>
          </TabsList>

          <TabsContent value="passages" className="space-y-4 mt-4">
            {passages.map((p, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    제시문 {p.label}
                    {p.source && (
                      <span className="ml-2 text-sm font-normal text-zinc-400">
                        — {p.source}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap leading-relaxed">
                    {p.text}
                  </p>
                </CardContent>
              </Card>
            ))}

            {questions.map((q, i) => (
              <Card key={`q-${i}`} className="border-blue-200 bg-blue-50/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">
                    문제 {q.number}
                    {q.wordLimit && (
                      <Badge variant="outline" className="ml-2 text-xs">
                        {q.wordLimit}자
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{q.text}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="materials" className="space-y-4 mt-4">
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Download className="h-4 w-4" />
                    수업 PPT
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-500 mb-3">
                    검은 배경, 제시문 한 문단씩
                  </p>
                  <Button
                    onClick={handleGeneratePpt}
                    disabled={generatingPpt}
                    className="w-full"
                    size="sm"
                  >
                    {generatingPpt ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    PPT 생성
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <BookOpen className="h-4 w-4" />
                    해설지
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-500 mb-3">
                    논제분석 + 제시문분석 + 예시답안
                  </p>
                  <Button
                    onClick={handleGenerateExplanation}
                    disabled={generatingExplanation}
                    className="w-full"
                    size="sm"
                  >
                    {generatingExplanation ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    해설지 생성
                  </Button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    채점기준표
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-500 mb-3">
                    문제별 배점 + 체크리스트
                  </p>
                  <Button
                    onClick={handleGenerateRubric}
                    disabled={generatingRubric}
                    className="w-full"
                    size="sm"
                  >
                    {generatingRubric ? (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    ) : null}
                    채점기준 생성
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="corrections" className="mt-4">
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-zinc-500">이 시험의 첨삭 기록이 없습니다.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
