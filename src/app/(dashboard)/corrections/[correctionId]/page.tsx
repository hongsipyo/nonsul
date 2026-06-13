'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  MessageSquare,
  Star,
  AlertTriangle,
  TrendingUp,
  Download,
  CheckCircle,
  Lightbulb,
  ArrowLeft,
  Pencil,
  Save,
  X,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';
import { RedPenViewer } from '@/components/correction/red-pen-viewer';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

interface CorrectionData {
  id: string;
  status: string;
  grade?: string;
  total_score?: number;
  is_best_answer?: boolean;
  summary?: string;
  answer_outline?: string;
  strengths?: string;
  improvements?: string;
  margin_comments?: {
    id: string;
    page: number;
    y_position: number;
    text: string;
    type: 'praise' | 'improvement' | 'error' | 'suggestion';
  }[];
  scores?: {
    question_number: number;
    point_scores: { name: string; earned: number; max: number; notes?: string }[];
    deductions: { name: string; count: number; deduction: number }[];
    subtotal: number;
  }[];
  corrected_images?: { page: number; storage_path: string; url: string }[];
  corrected_pdf_path?: string;
  student_answers?: {
    student_name?: string;
    student_school?: string;
    answer_images?: { page: number; url: string }[];
  };
  exams?: {
    title: string;
    university?: string;
  };
}

const commentTypeConfig = {
  praise: { icon: Star, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', label: '칭찬', dotColor: 'bg-emerald-500' },
  improvement: { icon: TrendingUp, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', label: '개선', dotColor: 'bg-blue-500' },
  error: { icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50 border-red-200', label: '오류', dotColor: 'bg-red-500' },
  suggestion: { icon: Lightbulb, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', label: '제안', dotColor: 'bg-amber-500' },
};

function ScoreBar({ earned, max }: { earned: number; max: number }) {
  const pct = max > 0 ? (earned / max) * 100 : 0;
  const color = pct >= 80 ? 'bg-emerald-500' : pct >= 60 ? 'bg-blue-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-zinc-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold tabular-nums w-12 text-right">{earned}/{max}</span>
    </div>
  );
}

function GradeCircle({ grade, score }: { grade?: string; score?: number }) {
  const gradeColors: Record<string, string> = {
    'A+': 'from-emerald-500 to-emerald-600',
    'A': 'from-emerald-400 to-emerald-500',
    'A0': 'from-emerald-400 to-emerald-500',
    'B+': 'from-blue-400 to-blue-500',
    'B': 'from-blue-400 to-blue-500',
    'B0': 'from-blue-400 to-blue-500',
    'C+': 'from-amber-400 to-amber-500',
    'C': 'from-amber-400 to-amber-500',
    'D': 'from-red-400 to-red-500',
    'F': 'from-red-500 to-red-600',
  };
  const bg = gradeColors[grade || ''] || 'from-zinc-400 to-zinc-500';

  return (
    <div className={`relative w-24 h-24 rounded-full bg-gradient-to-br ${bg} flex flex-col items-center justify-center text-white shadow-lg`}>
      {score != null && <span className="text-2xl font-black">{score}</span>}
      {grade && <span className="text-xs font-bold opacity-90">{grade}</span>}
    </div>
  );
}

export default function CorrectionDetailPage() {
  const { correctionId } = useParams<{ correctionId: string }>();
  const [data, setData] = useState<CorrectionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentFilter, setCommentFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<CorrectionData>>({});
  const [bestSaving, setBestSaving] = useState(false);

  const toggleBest = async () => {
    setBestSaving(true);
    try {
      const res = await fetch(`/api/corrections/${correctionId}/best-answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error((await res.json()).error || '실패');
      const { is_best_answer } = await res.json();
      setData((prev) => (prev ? { ...prev, is_best_answer } : prev));
    } catch (err) {
      alert(err instanceof Error ? err.message : '오류');
    } finally {
      setBestSaving(false);
    }
  };

  useEffect(() => {
    fetch(`/api/corrections/${correctionId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [correctionId]);

  const handleDownloadPDF = async () => {
    const { generateCorrectionPDF } = await import('@/lib/export/correction-pdf');
    const doc = await generateCorrectionPDF({
      studentName: data!.student_answers?.student_name || '학생',
      studentSchool: data!.student_answers?.student_school,
      examTitle: data!.exams?.title || '',
      university: data!.exams?.university,
      totalScore: data!.total_score,
      grade: data!.grade,
      answerOutline: data!.answer_outline,
      marginComments: data!.margin_comments,
      scores: data!.scores,
      strengths: data!.strengths,
      improvements: data!.improvements,
      summary: data!.summary,
      brand: '프로세스',
    });
    const name = data!.student_answers?.student_name || '학생';
    const exam = data!.exams?.title || '첨삭';
    doc.save(`${name}_${exam}_첨삭결과.pdf`);
  };

  const startEdit = () => {
    if (!data) return;
    setForm({
      total_score: data.total_score,
      grade: data.grade,
      answer_outline: data.answer_outline,
      summary: data.summary,
      strengths: data.strengths,
      improvements: data.improvements,
      margin_comments: data.margin_comments ? [...data.margin_comments] : [],
    });
    setEditing(true);
  };

  const updateComment = (idx: number, text: string) => {
    setForm((f) => ({
      ...f,
      margin_comments: (f.margin_comments || []).map((c, i) => (i === idx ? { ...c, text } : c)),
    }));
  };

  const deleteComment = (idx: number) => {
    setForm((f) => ({
      ...f,
      margin_comments: (f.margin_comments || []).filter((_, i) => i !== idx),
    }));
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const payload = {
        total_score: form.total_score != null ? Number(form.total_score) : null,
        grade: form.grade,
        answer_outline: form.answer_outline,
        summary: form.summary,
        strengths: form.strengths,
        improvements: form.improvements,
        margin_comments: form.margin_comments,
      };
      const res = await fetch(`/api/corrections/${correctionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).error || '저장 실패');
      setData((prev) => (prev ? { ...prev, ...payload } as CorrectionData : prev));
      setEditing(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : '저장 오류');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!data) return <div className="p-6">첨삭을 찾을 수 없습니다.</div>;

  const comments = data.margin_comments || [];
  // 빨간펜 PDF 공개 URL: corrected 이미지 URL의 버킷 base에서 파일명만 교체
  const correctedPdfUrl = (() => {
    if (!data.corrected_pdf_path) return undefined;
    const sample = data.corrected_images?.[0]?.url;
    if (!sample) return undefined;
    const idx = sample.indexOf('/corrected-files/');
    if (idx < 0) return undefined;
    return sample.slice(0, idx + '/corrected-files/'.length) + data.corrected_pdf_path;
  })();
  const praiseComments = comments.filter((c) => c.type === 'praise');
  const improvementComments = comments.filter((c) => c.type === 'improvement');
  const errorComments = comments.filter((c) => c.type === 'error');
  const suggestionComments = comments.filter((c) => c.type === 'suggestion');

  const filteredComments = commentFilter
    ? comments.filter((c) => c.type === commentFilter)
    : comments;

  // Sort: praise first, then by position
  const sortedComments = [...filteredComments].sort((a, b) => {
    if (!commentFilter) {
      const order = { praise: 0, improvement: 1, suggestion: 2, error: 3 };
      const oa = order[a.type] ?? 4;
      const ob = order[b.type] ?? 4;
      if (oa !== ob) return oa - ob;
    }
    return a.y_position - b.y_position;
  });

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto">
      {/* Back button */}
      <Link href="/corrections" className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-800">
        <ArrowLeft className="h-4 w-4 mr-1" />
        첨삭 목록
      </Link>

      {/* ===== HERO HEADER — 점수 + 이름 + 등급 한눈에 ===== */}
      <div className="flex items-center gap-6 bg-white rounded-xl border p-5 shadow-sm">
        {data.status === 'completed' && (
          <GradeCircle grade={data.grade} score={data.total_score ?? undefined} />
        )}
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold truncate">
            {data.student_answers?.student_name || '학생'} 첨삭 결과
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {data.exams?.title}
            {data.exams?.university && ` · ${data.exams.university}`}
            {data.student_answers?.student_school && ` · ${data.student_answers.student_school}`}
          </p>
          {data.status === 'completed' && comments.length > 0 && (
            <div className="flex gap-3 mt-2">
              <span className="text-xs text-emerald-600 font-medium">칭찬 {praiseComments.length}</span>
              <span className="text-xs text-blue-600 font-medium">개선 {improvementComments.length}</span>
              <span className="text-xs text-red-600 font-medium">오류 {errorComments.length}</span>
              <span className="text-xs text-amber-600 font-medium">제안 {suggestionComments.length}</span>
            </div>
          )}
        </div>
        {data.status === 'completed' && !editing && (
          <div className="flex gap-2 shrink-0">
            <Button
              variant={data.is_best_answer ? 'default' : 'outline'}
              size="sm"
              onClick={toggleBest}
              disabled={bestSaving}
              className={data.is_best_answer ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''}
            >
              <Star className={`h-4 w-4 mr-1 ${data.is_best_answer ? 'fill-current' : ''}`} />
              {data.is_best_answer ? '우수답안 ✓' : '우수답안'}
            </Button>
            <Button variant="outline" size="sm" onClick={startEdit}>
              <Pencil className="h-4 w-4 mr-1" />
              수정
            </Button>
            {data.corrected_pdf_path && correctedPdfUrl && (
              <a href={correctedPdfUrl} target="_blank" rel="noopener noreferrer">
                <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50">
                  <Download className="h-4 w-4 mr-1" />
                  빨간펜 PDF
                </Button>
              </a>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
              <Download className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
        )}
        {editing && (
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setEditing(false)} disabled={saving}>
              <X className="h-4 w-4 mr-1" />
              취소
            </Button>
            <Button size="sm" onClick={saveEdit} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              저장
            </Button>
          </div>
        )}
      </div>

      {/* Status messages */}
      {data.status !== 'completed' && (
        <Card>
          <CardContent className="py-8 text-center">
            {data.status === 'processing' && (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>AI가 첨삭 중입니다...</span>
              </div>
            )}
            {data.status === 'error' && (
              <p className="text-red-600">첨삭 생성 중 오류가 발생했습니다.</p>
            )}
            {data.status === 'uploaded' && (
              <p className="text-zinc-500">아직 첨삭이 시작되지 않았습니다.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ===== 수정 모드 ===== */}
      {editing && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">점수 · 등급</CardTitle>
            </CardHeader>
            <CardContent className="flex gap-4">
              <div className="w-32">
                <label className="text-xs text-zinc-500">총점</label>
                <Input
                  type="number"
                  value={form.total_score ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, total_score: e.target.value === '' ? undefined : Number(e.target.value) }))}
                />
              </div>
              <div className="w-32">
                <label className="text-xs text-zinc-500">등급</label>
                <Input
                  value={form.grade ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, grade: e.target.value }))}
                />
              </div>
            </CardContent>
          </Card>

          {([
            ['answer_outline', '답안 전개 요약'],
            ['strengths', '잘한 부분'],
            ['improvements', '개선 포인트'],
            ['summary', '종합 총평'],
          ] as const).map(([key, label]) => (
            <Card key={key}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{label}</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={key === 'summary' ? 5 : 3}
                  value={(form[key] as string) ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                />
              </CardContent>
            </Card>
          ))}

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">문장별 코멘트 ({(form.margin_comments || []).length}개)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(form.margin_comments || []).map((c, i) => {
                const config = commentTypeConfig[c.type] || commentTypeConfig.suggestion;
                return (
                  <div key={i} className={`flex items-start gap-2 rounded-lg p-2 border ${config.bg}`}>
                    <span className={`text-xs font-bold ${config.color} shrink-0 mt-2 w-10`}>{config.label}</span>
                    <Textarea
                      rows={2}
                      value={c.text}
                      onChange={(e) => updateComment(i, e.target.value)}
                      className="flex-1 bg-white"
                    />
                    <Button variant="ghost" size="sm" onClick={() => deleteComment(i)} className="shrink-0 text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {(form.margin_comments || []).length === 0 && (
                <p className="text-sm text-zinc-400 text-center py-2">코멘트 없음</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {data.status === 'completed' && !editing && (
        <>
          {/* ===== 답안 전개 요약 — 눈에 확 띄게 ===== */}
          {data.answer_outline && (
            <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/30">
              <CardContent className="py-4 px-5">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-indigo-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-indigo-800 mb-1">학생 답안 전개 요약</p>
                    <p className="text-sm leading-relaxed text-zinc-700">{data.answer_outline}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ===== 잘한 부분 + 개선점 나란히 ===== */}
          <div className="grid gap-4 md:grid-cols-2">
            {data.strengths && (
              <Card className="border-l-4 border-l-emerald-500 bg-emerald-50/30">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-800">잘한 부분</span>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-700">{data.strengths}</p>
                </CardContent>
              </Card>
            )}
            {data.improvements && (
              <Card className="border-l-4 border-l-blue-500 bg-blue-50/30">
                <CardContent className="py-4 px-5">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-bold text-blue-800">개선 포인트</span>
                  </div>
                  <p className="text-sm leading-relaxed text-zinc-700">{data.improvements}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* ===== LEFT: 코멘트 전체 ===== */}
            <div className="lg:col-span-2 space-y-4">
              {/* Answer Images with Red Pen Overlay */}
              {data.student_answers?.answer_images?.map((img) => (
                <Card key={img.page}>
                  <CardContent className="p-3">
                    <RedPenViewer
                      imageUrl={img.url}
                      imagePage={img.page}
                      correctedImageUrl={data.corrected_images?.find((ci) => ci.page === img.page)?.url}
                      comments={comments.map((c) => ({
                        text: c.text,
                        type: c.type,
                        y_position: c.y_position,
                      }))}
                      answerOutline={data.answer_outline}
                      summary={data.summary}
                      strengths={data.strengths}
                      improvements={data.improvements}
                      brand="프로세스"
                      studentName={data.student_answers?.student_name}
                      examTitle={data.exams?.title}
                    />
                  </CardContent>
                </Card>
              ))}

              {/* Comments with filter */}
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      문장별 코멘트 ({comments.length}개)
                    </CardTitle>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setCommentFilter(null)}
                        className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                          !commentFilter ? 'bg-zinc-800 text-white' : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                        }`}
                      >
                        전체
                      </button>
                      {(['praise', 'improvement', 'error', 'suggestion'] as const).map((type) => {
                        const config = commentTypeConfig[type];
                        const count = comments.filter((c) => c.type === type).length;
                        if (count === 0) return null;
                        return (
                          <button
                            key={type}
                            onClick={() => setCommentFilter(commentFilter === type ? null : type)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                              commentFilter === type ? `${config.bg} ${config.color} border` : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                            }`}
                          >
                            {config.label} {count}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {sortedComments.map((c, i) => {
                    const config = commentTypeConfig[c.type] || commentTypeConfig.suggestion;
                    const Icon = config.icon;
                    return (
                      <div key={i} className={`flex items-start gap-3 rounded-lg p-3 border ${config.bg} transition-all`}>
                        <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${config.dotColor}`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                            <span className={`text-xs font-bold ${config.color}`}>{config.label}</span>
                          </div>
                          <p className="text-sm leading-relaxed">{c.text}</p>
                        </div>
                      </div>
                    );
                  })}
                  {sortedComments.length === 0 && (
                    <p className="text-sm text-zinc-400 text-center py-4">해당 유형의 코멘트가 없습니다.</p>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ===== RIGHT: 점수 + 총평 ===== */}
            <div className="space-y-4">
              {/* Score Breakdown with visual bars */}
              {data.scores && data.scores.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">채점 상세</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {data.scores.map((s) => (
                      <div key={s.question_number}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-sm font-bold">문제 {s.question_number}</span>
                          <span className="text-lg font-black">{s.subtotal}점</span>
                        </div>
                        <div className="space-y-2">
                          {s.point_scores.map((ps, i) => (
                            <div key={i}>
                              <div className="flex justify-between text-xs text-zinc-600 mb-1">
                                <span>{ps.name}</span>
                              </div>
                              <ScoreBar earned={ps.earned} max={ps.max} />
                              {ps.notes && (
                                <p className="text-xs text-zinc-400 mt-0.5 ml-1">{ps.notes}</p>
                              )}
                            </div>
                          ))}
                          {s.deductions.map((d, i) => (
                            <div key={i} className="flex justify-between text-xs text-red-500 bg-red-50 rounded px-2 py-1">
                              <span>{d.name} (x{d.count})</span>
                              <span className="font-bold">{d.deduction}</span>
                            </div>
                          ))}
                        </div>
                        <Separator className="mt-3" />
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Summary — 빨간 박스 스타일 (프로세스 첨삭 하단 총평) */}
              {data.summary && (
                <Card className="border-2 border-red-300 bg-red-50/50">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base text-red-800 flex items-center gap-2">
                      <Star className="h-4 w-4" />
                      종합 총평
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-zinc-800">
                      {data.summary}
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
