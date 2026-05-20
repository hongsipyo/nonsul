'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, BookOpen, PenTool, Download, AlertCircle, CheckCircle, Image as ImageIcon, Table2, FileDown } from 'lucide-react';
import type { Exam, Passage, Question } from '@/types/exam';

export default function ExamDetailPage() {
  const { examId } = useParams<{ examId: string }>();
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [generatingRubric, setGeneratingRubric] = useState(false);
  const [generatingPpt, setGeneratingPpt] = useState(false);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);
  const [rubricResult, setRubricResult] = useState<any>(null);
  const [explanationResult, setExplanationResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/exams/${examId}`)
      .then((r) => r.json())
      .then(setExam)
      .finally(() => setLoading(false));
  }, [examId]);

  const handleParse = async () => {
    setParsing(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/parse`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '파싱 실패');
      const updated = await fetch(`/api/exams/${examId}`).then((r) => r.json());
      setExam(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : '파싱 오류');
    } finally {
      setParsing(false);
    }
  };

  const handleGenerateRubric = async () => {
    setGeneratingRubric(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/rubric`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '채점기준 생성 실패');
      setRubricResult(data.rubric);
    } catch (err) {
      setError(err instanceof Error ? err.message : '채점기준 생성 오류');
    } finally {
      setGeneratingRubric(false);
    }
  };

  const handleGeneratePpt = async () => {
    setGeneratingPpt(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'ppt', brand: '프로세스' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'PPT 생성 실패');
      if (data.url) window.open(data.url, '_blank');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PPT 생성 오류');
    } finally {
      setGeneratingPpt(false);
    }
  };

  const handleGenerateExplanation = async () => {
    setGeneratingExplanation(true);
    setError(null);
    try {
      const res = await fetch(`/api/exams/${examId}/materials`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: '해설지', brand: '프로세스' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '해설지 생성 실패');
      setExplanationResult(data.content);
    } catch (err) {
      setError(err instanceof Error ? err.message : '해설지 생성 오류');
    } finally {
      setGeneratingExplanation(false);
    }
  };

  const handleDownloadExplanationPDF = async () => {
    if (!explanationResult?.sections) return;
    const { generateExplanationPDF } = await import('@/lib/export/explanation-pdf');
    const doc = await generateExplanationPDF({
      examTitle: exam?.title || '시험',
      university: exam?.university || undefined,
      sections: explanationResult.sections,
      brand: '프로세스',
    });
    doc.save(`${exam?.title || '해설지'}_해설.pdf`);
  };

  const handleDownloadRubricPDF = async () => {
    if (!rubricResult?.items) return;
    const { generateRubricPDF } = await import('@/lib/export/rubric-pdf');
    const doc = await generateRubricPDF({
      examTitle: exam?.title || '시험',
      university: exam?.university || undefined,
      items: rubricResult.items,
      globalDeductions: rubricResult.global_deductions,
      brand: '프로세스',
    });
    doc.save(`${exam?.title || '채점기준표'}_채점기준표.pdf`);
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

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">닫기</button>
        </div>
      )}

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

          {/* ===== 시험 원문 탭 ===== */}
          <TabsContent value="passages" className="space-y-4 mt-4">
            {passages.map((p, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    제시문 {p.label}
                    {p.has_table && <Badge variant="outline" className="text-xs"><Table2 className="h-3 w-3 mr-1" />표</Badge>}
                    {p.has_graph && <Badge variant="outline" className="text-xs"><ImageIcon className="h-3 w-3 mr-1" />그래프</Badge>}
                    {p.source && (
                      <span className="text-sm font-normal text-zinc-400">
                        — {p.source}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* 원본 페이지 이미지 (표/그래프가 있는 경우) */}
                  {(p.has_table || p.has_graph) && p.page_image_url && (
                    <div className="border rounded-lg overflow-hidden bg-zinc-50">
                      <div className="px-3 py-1.5 bg-zinc-100 text-xs text-zinc-500 font-medium flex items-center gap-1">
                        <ImageIcon className="h-3 w-3" />
                        원본 PDF (페이지 {p.page_number})
                      </div>
                      <img
                        src={p.page_image_url}
                        alt={`제시문 ${p.label} 원본`}
                        className="w-full"
                      />
                    </div>
                  )}

                  {/* 표 markdown */}
                  {p.has_table && p.table_markdown && (
                    <div className="border rounded-lg overflow-auto bg-zinc-50 p-3">
                      <div className="text-xs text-zinc-500 font-medium mb-2 flex items-center gap-1">
                        <Table2 className="h-3 w-3" />
                        표 데이터 (텍스트)
                      </div>
                      <pre className="text-xs font-mono whitespace-pre-wrap">{p.table_markdown}</pre>
                    </div>
                  )}

                  {/* 텍스트 */}
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

          {/* ===== 수업자료 탭 ===== */}
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
                    검은 배경, 문단별 분할, 표/그래프 이미지 포함
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
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        AI 생성 중... (1~2분)
                      </>
                    ) : explanationResult ? (
                      <>
                        <CheckCircle className="mr-2 h-3 w-3" />
                        다시 생성
                      </>
                    ) : '해설지 생성'}
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
                      <>
                        <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                        AI 생성 중... (30초~1분)
                      </>
                    ) : rubricResult ? (
                      <>
                        <CheckCircle className="mr-2 h-3 w-3" />
                        다시 생성
                      </>
                    ) : '채점기준 생성'}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* 해설지 결과 표시 */}
            {explanationResult?.sections && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">해설지 결과</h3>
                  <Button
                    onClick={handleDownloadExplanationPDF}
                    variant="outline"
                    size="sm"
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    PDF 다운로드
                  </Button>
                </div>
                {explanationResult.sections.map((sec: any, i: number) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        {sec.type}
                        {sec.question_number && ` — 문제 ${sec.question_number}`}
                        {sec.passage_label && ` — ${sec.passage_label}`}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-sm whitespace-pre-wrap leading-relaxed">
                        {sec.content}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* 채점기준 결과 표시 */}
            {rubricResult?.items && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">채점기준표 결과</h3>
                  <Button
                    onClick={handleDownloadRubricPDF}
                    variant="outline"
                    size="sm"
                  >
                    <FileDown className="mr-1.5 h-3.5 w-3.5" />
                    PDF 다운로드
                  </Button>
                </div>
                {rubricResult.items.map((item: any, i: number) => (
                  <Card key={i}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">
                        문제 {item.question_number} ({item.total_points}점)
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {item.scoring_points?.map((sp: any, j: number) => (
                        <div key={j} className="flex justify-between text-sm">
                          <span className="text-zinc-600">{sp.name} <span className="text-xs text-zinc-400">({sp.category})</span></span>
                          <span className="font-medium">{sp.points}점</span>
                        </div>
                      ))}
                      {item.deduction_items?.map((d: any, j: number) => (
                        <div key={j} className="flex justify-between text-sm text-red-500">
                          <span>{d.name}</span>
                          <span>{d.deduction}점</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
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
