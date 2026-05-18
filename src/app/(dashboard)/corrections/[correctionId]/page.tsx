'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, MessageSquare, Star, AlertTriangle, TrendingUp } from 'lucide-react';

interface CorrectionData {
  id: string;
  status: string;
  grade?: string;
  total_score?: number;
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
  praise: { icon: Star, color: 'text-green-600', bg: 'bg-green-50', label: '칭찬' },
  improvement: { icon: TrendingUp, color: 'text-blue-600', bg: 'bg-blue-50', label: '개선' },
  error: { icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50', label: '오류' },
  suggestion: { icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50', label: '제안' },
};

export default function CorrectionDetailPage() {
  const { correctionId } = useParams<{ correctionId: string }>();
  const [data, setData] = useState<CorrectionData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/corrections/${correctionId}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [correctionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!data) return <div className="p-6">첨삭을 찾을 수 없습니다.</div>;

  const comments = data.margin_comments || [];
  const praiseCount = comments.filter((c) => c.type === 'praise').length;
  const improvementCount = comments.filter((c) => c.type === 'improvement').length;
  const errorCount = comments.filter((c) => c.type === 'error').length;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">
            {data.student_answers?.student_name || '학생'} 첨삭 결과
          </h1>
          <p className="text-zinc-500 mt-1">
            {data.exams?.title}
            {data.student_answers?.student_school && ` · ${data.student_answers.student_school}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {data.total_score != null && (
            <span className="text-2xl font-bold">{data.total_score}점</span>
          )}
          {data.grade && (
            <Badge className="text-lg px-3 py-1">{data.grade}</Badge>
          )}
        </div>
      </div>

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

      {data.status === 'completed' && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left: Answer images + Comments */}
          <div className="lg:col-span-2 space-y-4">
            {/* Answer Outline */}
            {data.answer_outline && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">학생 답안 전개 요약</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{data.answer_outline}</p>
                </CardContent>
              </Card>
            )}

            {/* Answer Images */}
            {data.student_answers?.answer_images?.map((img) => (
              <Card key={img.page}>
                <CardContent className="p-2">
                  <img
                    src={img.url}
                    alt={`답안 ${img.page}페이지`}
                    className="w-full rounded"
                  />
                </CardContent>
              </Card>
            ))}

            {/* All Comments */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-3">
                  코멘트
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-green-600">칭찬 {praiseCount}</Badge>
                    <Badge variant="outline" className="text-blue-600">개선 {improvementCount}</Badge>
                    <Badge variant="outline" className="text-red-600">오류 {errorCount}</Badge>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {comments.map((c, i) => {
                  const config = commentTypeConfig[c.type] || commentTypeConfig.suggestion;
                  const Icon = config.icon;
                  return (
                    <div key={i} className={`flex items-start gap-3 rounded-lg p-3 ${config.bg}`}>
                      <Icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                      <div>
                        <span className={`text-xs font-medium ${config.color}`}>{config.label}</span>
                        <p className="text-sm mt-0.5">{c.text}</p>
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Right: Scores + Summary */}
          <div className="space-y-4">
            {/* Score Breakdown */}
            {data.scores && data.scores.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">채점 상세</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.scores.map((s) => (
                    <div key={s.question_number}>
                      <p className="text-sm font-medium mb-2">
                        문제 {s.question_number}
                        <span className="ml-2 text-zinc-400">({s.subtotal}점)</span>
                      </p>
                      <div className="space-y-1">
                        {s.point_scores.map((ps, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-zinc-600">{ps.name}</span>
                            <span className="font-medium">
                              {ps.earned}/{ps.max}
                            </span>
                          </div>
                        ))}
                        {s.deductions.map((d, i) => (
                          <div key={i} className="flex justify-between text-sm text-red-500">
                            <span>{d.name} (x{d.count})</span>
                            <span>{d.deduction}</span>
                          </div>
                        ))}
                      </div>
                      <Separator className="mt-2" />
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Strengths */}
            {data.strengths && (
              <Card className="border-green-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-green-700 flex items-center gap-2">
                    <Star className="h-4 w-4" /> 잘한 부분
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{data.strengths}</p>
                </CardContent>
              </Card>
            )}

            {/* Improvements */}
            {data.improvements && (
              <Card className="border-blue-200">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base text-blue-700 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> 개선 포인트
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{data.improvements}</p>
                </CardContent>
              </Card>
            )}

            {/* Summary */}
            {data.summary && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">종합 총평</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {data.summary}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
