'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mic, Upload, Loader2, FileText, BookOpen, MessageSquare, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';

const ORAL_EXAM_DB = [
  { university: '서울대', year: '2023', session: '사회과학 오전', file: '구술_서울대_2023_사회과학_오전.pdf' },
  { university: '서울대', year: '모의', session: '사회과학', file: '구술_서울대_사회과학_모의.pdf' },
  { university: '연세대', year: '2023', session: '활동우수/기회균형 인문사회통합', file: '구술_연세대_2023_활동우수.pdf' },
  { university: '연세대', year: '2022', session: '추천형 오후 인문사회통합', file: '구술_연세대_2022_추천형.pdf' },
];

const universities = ['서울대', '연세대', '고려대'];
const years = ['2024', '2023', '2022', '2021', '2020', '모의'];
const sessions = ['인문학 오전', '인문학 오후', '사회과학 오전', '사회과학 오후', '활동우수/기회균형 인문사회통합', '추천형 오후 인문사회통합'];

interface OralResult {
  passages_analysis?: { label: string; core_argument: string; key_concepts: string[]; relationship_to_others: string }[];
  questions?: {
    number: number;
    question_text: string;
    question_type: string;
    model_answer: string;
    borderline_answer: string;
    answer_structure: string;
    model_vs_borderline: string;
    follow_up_questions: string[];
    follow_up_answers: string[];
    key_tips: string[];
  }[];
  overall_strategy?: string;
  time_allocation?: string;
}

export default function OralExamPage() {
  const [university, setUniversity] = useState('');
  const [year, setYear] = useState('');
  const [session, setSession] = useState('');
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<OralResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedQ, setExpandedQ] = useState<number | null>(0);

  const handleUploadAndAnalyze = async () => {
    if (!file || !university) return;
    setUploading(true);
    setError(null);
    setResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('university', university);
      if (year) formData.append('year', year);
      if (session) formData.append('session', session);

      const res = await fetch('/api/oral-exam/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');
      setResult(data.answer || data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setUploading(false);
    }
  };

  // 기출 DB에서 매칭
  const matchedExams = ORAL_EXAM_DB.filter((e) =>
    (!university || e.university === university) &&
    (!year || e.year === year)
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">구술 면접</h1>
        <Badge variant="outline">서연고 인문계열</Badge>
      </div>

      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-xs underline">닫기</button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* PDF 업로드 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              구술문제 PDF 업로드
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">
              구술문제 PDF를 업로드하면 AI가 제시문 파싱 → 예시답안 + 추가질문 답변을 생성합니다.
            </p>

            <div className="grid grid-cols-3 gap-2">
              <Select value={university} onValueChange={(v) => v && setUniversity(v)}>
                <SelectTrigger><SelectValue placeholder="대학" /></SelectTrigger>
                <SelectContent>
                  {universities.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={year} onValueChange={(v) => v && setYear(v)}>
                <SelectTrigger><SelectValue placeholder="연도" /></SelectTrigger>
                <SelectContent>
                  {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={session} onValueChange={(v) => v && setSession(v)}>
                <SelectTrigger><SelectValue placeholder="시간대" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => document.getElementById('oral-pdf-input')?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                  <span className="text-xs text-zinc-400">({(file.size / 1024 / 1024).toFixed(1)}MB)</span>
                </div>
              ) : (
                <div>
                  <Upload className="h-6 w-6 mx-auto text-zinc-400 mb-1" />
                  <p className="text-sm text-zinc-500">PDF 클릭/드래그</p>
                </div>
              )}
              <input
                id="oral-pdf-input"
                type="file"
                accept=".pdf"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
              />
            </div>

            <Button
              onClick={handleUploadAndAnalyze}
              disabled={!file || !university || uploading}
              className="w-full"
            >
              {uploading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />분석 중... (1~2분)</>
              ) : (
                '업로드 및 예시답안 생성'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 기출 DB */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              보유 기출 ({ORAL_EXAM_DB.length}개)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {ORAL_EXAM_DB.map((exam, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg border hover:bg-zinc-50">
                <div>
                  <p className="text-sm font-medium">{exam.university} {exam.year}</p>
                  <p className="text-xs text-zinc-500">{exam.session}</p>
                </div>
                <Badge variant="outline" className="text-xs">{exam.file ? '보유' : '미보유'}</Badge>
              </div>
            ))}
            <p className="text-xs text-zinc-400 mt-2">
              PDF를 직접 업로드하면 더 많은 기출을 분석할 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ===== 결과 표시 ===== */}
      {result && (
        <div className="space-y-4">
          {/* 전체 전략 */}
          {result.overall_strategy && (
            <Card className="border-l-4 border-l-indigo-500 bg-indigo-50/30">
              <CardContent className="py-4 px-5">
                <p className="text-sm font-bold text-indigo-800 mb-1">전체 전략</p>
                <p className="text-sm text-zinc-700">{result.overall_strategy}</p>
                {result.time_allocation && (
                  <p className="text-xs text-zinc-500 mt-2">시간 배분: {result.time_allocation}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* 제시문 분석 */}
          {result.passages_analysis && result.passages_analysis.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">제시문 분석</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {result.passages_analysis.map((p, i) => (
                  <div key={i} className="rounded-lg bg-zinc-50 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{p.label}</Badge>
                      <div className="flex gap-1">
                        {p.key_concepts?.map((c, j) => (
                          <span key={j} className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-zinc-700">{p.core_argument}</p>
                    {p.relationship_to_others && (
                      <p className="text-xs text-zinc-500 mt-1">관계: {p.relationship_to_others}</p>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 문제별 예시답안 */}
          {result.questions?.map((q, i) => (
            <Card key={i} className="overflow-hidden">
              <button
                className="w-full text-left"
                onClick={() => setExpandedQ(expandedQ === i ? null : i)}
              >
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-blue-600" />
                    문제 {q.number}
                    <Badge variant="outline" className="text-xs">{q.question_type}</Badge>
                  </CardTitle>
                  {expandedQ === i ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardHeader>
              </button>

              {expandedQ === i && (
                <CardContent className="space-y-4 pt-0">
                  {/* 문제 원문 */}
                  <div className="bg-zinc-50 rounded-lg p-3">
                    <p className="text-sm whitespace-pre-wrap">{q.question_text}</p>
                  </div>

                  {/* 모범답안 */}
                  <div className="border-l-4 border-l-emerald-500 bg-emerald-50/30 rounded-r-lg p-4">
                    <p className="text-sm font-bold text-emerald-800 mb-2">모범답안 (만점 수준)</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.model_answer}</p>
                  </div>

                  {/* 한계답안 */}
                  <div className="border-l-4 border-l-amber-500 bg-amber-50/30 rounded-r-lg p-4">
                    <p className="text-sm font-bold text-amber-800 mb-2">한계답안 (합격선)</p>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{q.borderline_answer}</p>
                  </div>

                  {/* 답변 구조 */}
                  {q.answer_structure && (
                    <div className="bg-blue-50/50 rounded-lg p-3">
                      <p className="text-xs font-bold text-blue-700 mb-1">답변 구조</p>
                      <p className="text-sm text-zinc-700">{q.answer_structure}</p>
                    </div>
                  )}

                  {/* 핵심 팁 */}
                  {q.key_tips && q.key_tips.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {q.key_tips.map((tip, j) => (
                        <span key={j} className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded-full">
                          💡 {tip}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* 추가질문 */}
                  {q.follow_up_questions && q.follow_up_questions.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-red-600">예상 추가질문</p>
                      {q.follow_up_questions.map((fq, j) => (
                        <div key={j} className="rounded-lg border p-3">
                          <p className="text-sm font-medium text-red-700">Q: {fq}</p>
                          {q.follow_up_answers?.[j] && (
                            <p className="text-sm text-zinc-700 mt-1">A: {q.follow_up_answers[j]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
