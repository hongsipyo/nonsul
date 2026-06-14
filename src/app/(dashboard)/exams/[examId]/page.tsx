'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, FileText, BookOpen, PenTool, Download, AlertCircle, CheckCircle, Image as ImageIcon, Table2, FileDown, Search } from 'lucide-react';
import type { Exam, Passage, Question } from '@/types/exam';

interface ProofreadIssue {
  type: string;
  original: string;
  corrected: string;
  reason: string;
}

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
  const [proofreading, setProofreading] = useState(false);
  const [proofreadResult, setProofreadResult] = useState<{ issues: ProofreadIssue[]; summary: string; total_issues: number } | null>(null);
  const [proofreadTarget, setProofreadTarget] = useState<string>('');
  const [applyingCorrections, setApplyingCorrections] = useState(false);

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
    if (!explanationResult) return;
    // 서버사이드 렌더(실폰트·실로고) — 클라 번들에서 fs/폰트 제거
    const res = await fetch('/api/explanations/pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        examTitle: exam?.title || '시험',
        university: exam?.university || undefined,
        brand: '프로세스',
        overview: explanationResult.overview,
        passage_analyses: explanationResult.passage_analyses,
        solutions: explanationResult.solutions,
        scoring_criteria: explanationResult.scoring_criteria,
        model_answers: explanationResult.model_answers,
        sections: explanationResult.sections,
      }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || '해설지 PDF 생성 실패');
      return;
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${exam?.title || '해설지'}_해설.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleProofread = async (label: string, text: string) => {
    setProofreading(true);
    setProofreadTarget(label);
    setProofreadResult(null);
    try {
      const res = await fetch('/api/proofread', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '검수 실패');
      setProofreadResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '검수 오류');
    } finally {
      setProofreading(false);
    }
  };

  /** 검수 결과를 파싱 데이터에 일괄 반영 */
  const handleApplyCorrections = async () => {
    if (!proofreadResult?.issues?.length || !exam) return;
    setApplyingCorrections(true);
    try {
      const res = await fetch(`/api/exams/${examId}/apply-corrections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issues: proofreadResult.issues, target: proofreadTarget }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '반영 실패');
      // 반영 후 exam 데이터 새로고침
      const examRes = await fetch(`/api/exams/${examId}`);
      const updatedExam = await examRes.json();
      setExam(updatedExam);
      setProofreadResult(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '교정 반영 오류');
    } finally {
      setApplyingCorrections(false);
    }
  };

  /** 콘텐츠에서 검수용 텍스트 추출 */
  const extractTextForProofread = (result: any, type: '해설지' | '채점기준표' | '파싱'): string => {
    if (type === '파싱' && exam?.parsed_passages) {
      const parts: string[] = [];
      for (const p of exam.parsed_passages) parts.push(`${p.label}\n${p.text}`);
      for (const q of (exam.parsed_questions || [])) parts.push(`문제 ${q.number}: ${q.text}`);
      return parts.join('\n\n');
    }
    if (type === '해설지' && result) {
      if (result.overview) {
        const parts: string[] = [];
        for (const q of result.overview?.questions || []) parts.push(q.analysis);
        for (const p of result.passage_analyses || []) parts.push(p.core_argument);
        for (const s of result.solutions || []) parts.push(s.answer_structure, s.approach);
        for (const a of result.model_answers || []) parts.push(a.content);
        return parts.join('\n\n');
      }
      if (result.sections) {
        return result.sections.map((s: any) => s.content).join('\n\n');
      }
    }
    if (type === '채점기준표' && result?.items) {
      return JSON.stringify(result.items, null, 2);
    }
    return '';
  };

  const handleDownloadExamPaperPDF = async () => {
    if (!exam?.parsed_passages) return;
    const { generateExamPaperPDF } = await import('@/lib/export/exam-paper-pdf');
    // title에서 수업 정보 추출 (예: "가톨릭대 파이널 특강 4강")
    const titleParts = exam.title.split(/\s+/);
    const uniName = exam.university || titleParts[0] || exam.title;
    const classInfo = exam.university
      ? exam.title.replace(exam.university, '').trim()
      : titleParts.slice(1).join(' ');
    const doc = await generateExamPaperPDF({
      examTitle: exam.title,
      university: uniName,
      year: exam.exam_year ? String(exam.exam_year) : undefined,
      className: classInfo || undefined,
      passages: exam.parsed_passages || [],
      questions: exam.parsed_questions || [],
      brand: '프로세스',
    });
    doc.save(`${exam.title}_시험지.pdf`);
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

      {/* 검수 결과 표시 */}
      {proofreadResult && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search className="h-4 w-4 text-blue-600" />
                검수 결과 — {proofreadTarget}
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline">
                  {proofreadResult.total_issues}건 발견
                </Badge>
                {proofreadResult.total_issues > 0 && proofreadTarget === 'OCR 파싱' && (
                  <Button
                    onClick={handleApplyCorrections}
                    disabled={applyingCorrections}
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    {applyingCorrections ? (
                      <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />반영 중...</>
                    ) : (
                      <><CheckCircle className="mr-1.5 h-3.5 w-3.5" />일괄 반영</>
                    )}
                  </Button>
                )}
                <button onClick={() => setProofreadResult(null)} className="text-xs text-zinc-400 underline">닫기</button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {proofreadResult.total_issues === 0 ? (
              <p className="text-sm text-green-700 flex items-center gap-1">
                <CheckCircle className="h-4 w-4" />
                오류가 발견되지 않았습니다.
              </p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm text-zinc-600">{proofreadResult.summary}</p>
                <div className="divide-y">
                  {proofreadResult.issues.map((issue, i) => (
                    <div key={i} className="py-2 text-sm">
                      <div className="flex items-start gap-2">
                        <Badge variant="outline" className="text-xs shrink-0">{issue.type}</Badge>
                        <div>
                          <p>
                            <span className="line-through text-red-500">{issue.original}</span>
                            {' → '}
                            <span className="text-green-700 font-medium">{issue.corrected}</span>
                          </p>
                          <p className="text-xs text-zinc-400 mt-0.5">{issue.reason}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
            {passages.length > 0 && (
              <div className="flex justify-end">
                <Button
                  onClick={() => handleProofread('OCR 파싱', extractTextForProofread(null, '파싱'))}
                  disabled={proofreading}
                  variant="outline"
                  size="sm"
                >
                  {proofreading && proofreadTarget === 'OCR 파싱' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                  OCR 텍스트 검수
                </Button>
              </div>
            )}
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
                  {/* ★표/그래프 크롭 이미지 (figures) — 텍스트로 안 뜯고 원본 영역만 잘라서 */}
                  {p.figures && p.figures.filter((f) => f.url).length > 0 ? (
                    <div className="space-y-2">
                      {p.figures.filter((f) => f.url).map((f, fi) => (
                        <div key={fi} className="border rounded-lg overflow-hidden bg-white">
                          <div className="px-3 py-1.5 bg-zinc-100 text-xs text-zinc-500 font-medium flex items-center gap-1">
                            {f.kind === 'graph' ? <ImageIcon className="h-3 w-3" /> : <Table2 className="h-3 w-3" />}
                            {f.caption || (f.kind === 'graph' ? '그래프' : '표')}
                          </div>
                          <img src={f.url} alt={f.caption || '표/그래프'} className="w-full" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <>
                      {/* 폴백: figures 크롭이 없으면 원본 페이지 전체 이미지 */}
                      {(p.has_table || p.has_graph) && p.page_image_url && (
                        <div className="border rounded-lg overflow-hidden bg-zinc-50">
                          <div className="px-3 py-1.5 bg-zinc-100 text-xs text-zinc-500 font-medium flex items-center gap-1">
                            <ImageIcon className="h-3 w-3" />
                            원본 PDF (페이지 {p.page_number})
                          </div>
                          <img src={p.page_image_url} alt={`제시문 ${p.label} 원본`} className="w-full" />
                        </div>
                      )}
                      {/* 폴백: 표 markdown */}
                      {p.has_table && p.table_markdown && (
                        <div className="border rounded-lg overflow-auto bg-zinc-50 p-3">
                          <div className="text-xs text-zinc-500 font-medium mb-2 flex items-center gap-1">
                            <Table2 className="h-3 w-3" />
                            표 데이터 (텍스트)
                          </div>
                          <pre className="text-xs font-mono whitespace-pre-wrap">{p.table_markdown}</pre>
                        </div>
                      )}
                    </>
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    시험지 PDF
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-zinc-500 mb-3">
                    프로세스 브랜드 시험지 형식
                  </p>
                  <Button
                    onClick={handleDownloadExamPaperPDF}
                    disabled={!exam?.parsed_passages}
                    className="w-full"
                    size="sm"
                  >
                    시험지 다운로드
                  </Button>
                </CardContent>
              </Card>

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
            {explanationResult && (explanationResult.overview || explanationResult.sections) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm">해설지 결과</h3>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleProofread('해설지', extractTextForProofread(explanationResult, '해설지'))}
                      disabled={proofreading}
                      variant="outline"
                      size="sm"
                    >
                      {proofreading && proofreadTarget === '해설지' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                      검수
                    </Button>
                    <Button
                      onClick={handleDownloadExplanationPDF}
                      variant="outline"
                      size="sm"
                    >
                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      PDF 다운로드
                    </Button>
                  </div>
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
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleProofread('채점기준표', extractTextForProofread(rubricResult, '채점기준표'))}
                      disabled={proofreading}
                      variant="outline"
                      size="sm"
                    >
                      {proofreading && proofreadTarget === '채점기준표' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Search className="mr-1.5 h-3.5 w-3.5" />}
                      검수
                    </Button>
                    <Button
                      onClick={handleDownloadRubricPDF}
                      variant="outline"
                      size="sm"
                    >
                      <FileDown className="mr-1.5 h-3.5 w-3.5" />
                      PDF 다운로드
                    </Button>
                  </div>
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
