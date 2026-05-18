'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Sparkles, Download, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

type Grade = '하' | '중하' | '중' | '중상' | '상';

interface AbilityItem {
  label: string;
  grade: Grade;
}

interface ReportData {
  counseling_date: string;
  school: string;
  student_name: string;
  abilities: AbilityItem[];
  current_strengths_summary: Grade;
  strengths: string[];
  improvements: string[];
  overall_comment: string;
}

const GRADE_OPTIONS: Grade[] = ['하', '중하', '중', '중상', '상'];

const gradeColor: Record<Grade, string> = {
  '하': 'bg-red-100 text-red-700',
  '중하': 'bg-orange-100 text-orange-700',
  '중': 'bg-yellow-100 text-yellow-700',
  '중상': 'bg-blue-100 text-blue-700',
  '상': 'bg-green-100 text-green-700',
};

const DEFAULT_REPORT: ReportData = {
  counseling_date: new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }),
  school: '',
  student_name: '',
  abilities: [
    { label: '독해 능력', grade: '중' },
    { label: '어휘력', grade: '중' },
    { label: '문장 및 한국어 사용 능력', grade: '중' },
  ],
  current_strengths_summary: '중',
  strengths: [],
  improvements: [],
  overall_comment: '',
};

export default function StudentReportPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [report, setReport] = useState<ReportData>(DEFAULT_REPORT);

  useEffect(() => {
    fetch('/api/students')
      .then((r) => r.json())
      .then((students) => {
        const s = (Array.isArray(students) ? students : []).find((s: any) => s.id === studentId);
        if (s) {
          setStudent(s);
          setReport((prev) => ({
            ...prev,
            student_name: s.name,
            school: s.school || '',
          }));
        }
        setLoading(false);
      });
  }, [studentId]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`/api/students/${studentId}/comment`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setReport((prev) => ({
          ...prev,
          abilities: [
            { label: '독해 능력', grade: mapToGrade(data.recurring_strengths, '독해') },
            { label: '어휘력', grade: mapToGrade(data.recurring_strengths, '어휘') },
            { label: '문장 및 한국어 사용 능력', grade: mapToGrade(data.recurring_strengths, '문장') },
          ],
          current_strengths_summary: data.recurring_strengths?.length >= 3 ? '중상' : '중',
          strengths: data.recurring_strengths || [],
          improvements: data.recurring_weaknesses || [],
          overall_comment: [
            data.overall_comment,
            data.progress_assessment,
            data.recommended_practice,
            data.motivation_message,
          ].filter(Boolean).join('\n\n'),
        }));
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadPdf = () => {
    alert('PDF 다운로드 기능은 추후 지원 예정입니다.');
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
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      {/* Top Actions */}
      <div className="flex items-center justify-between print:hidden">
        <Link href={`/students/${studentId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            돌아가기
          </Button>
        </Link>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={generating} variant="outline">
            {generating ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 h-4 w-4" />
            )}
            AI 자동 생성
          </Button>
          <Button onClick={handleDownloadPdf}>
            <Download className="mr-2 h-4 w-4" />
            PDF 다운로드
          </Button>
        </div>
      </div>

      {/* Report Card */}
      <Card className="print:shadow-none print:border-2 print:border-black">
        {/* Title */}
        <CardHeader className="text-center border-b">
          <CardTitle className="text-xl font-bold tracking-wide">
            대입논술 기본반 수강생 상담기록지
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 pt-6">
          {/* Header Info */}
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-600 min-w-[5rem]">상담 일자</span>
              <span>{report.counseling_date}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-zinc-600 min-w-[5rem]">학교 / 이름</span>
              <span>{report.school ? `${report.school} / ` : ''}{report.student_name}</span>
            </div>
          </div>

          <Separator />

          {/* Section 1: 역량 분석 */}
          <div className="space-y-4">
            <h3 className="font-bold text-sm text-zinc-800">
              1. 학생의 논술 전반적인 영역에서의 현재 역량 분석
            </h3>
            <div className="space-y-3">
              {report.abilities.map((ability, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <span className="text-sm font-medium text-zinc-700 min-w-[12rem]">
                    {ability.label}
                  </span>
                  <div className="flex gap-1.5">
                    {GRADE_OPTIONS.map((g) => (
                      <button
                        key={g}
                        onClick={() => {
                          const updated = [...report.abilities];
                          updated[idx] = { ...updated[idx], grade: g };
                          setReport({ ...report, abilities: updated });
                        }}
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
                          ability.grade === g
                            ? gradeColor[g] + ' border-current'
                            : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100'
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <div className="flex items-center gap-3 pt-2 border-t">
                <span className="text-sm font-semibold text-zinc-800 min-w-[12rem]">
                  현재 장점 종합
                </span>
                <div className="flex gap-1.5">
                  {GRADE_OPTIONS.map((g) => (
                    <button
                      key={g}
                      onClick={() => setReport({ ...report, current_strengths_summary: g })}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
                        report.current_strengths_summary === g
                          ? gradeColor[g] + ' border-current'
                          : 'bg-zinc-50 text-zinc-400 border-zinc-200 hover:bg-zinc-100'
                      }`}
                    >
                      {g}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 2: 장점 / 보완할 점 */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-zinc-800">
              2. 장점 / 보완할 점
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-sm font-semibold text-green-700">장점</p>
                <div className="min-h-[8rem] rounded-lg border border-green-200 bg-green-50/30 p-3">
                  {report.strengths.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">
                      {report.strengths.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <textarea
                      className="w-full h-full min-h-[6rem] bg-transparent text-sm resize-none outline-none text-zinc-600 placeholder:text-zinc-400"
                      placeholder="장점을 입력하세요..."
                      onChange={(e) =>
                        setReport({ ...report, strengths: e.target.value.split('\n').filter(Boolean) })
                      }
                    />
                  )}
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-semibold text-red-600">보완할 점</p>
                <div className="min-h-[8rem] rounded-lg border border-red-200 bg-red-50/30 p-3">
                  {report.improvements.length > 0 ? (
                    <ul className="list-disc list-inside text-sm text-zinc-700 space-y-1">
                      {report.improvements.map((s, i) => (
                        <li key={i}>{s}</li>
                      ))}
                    </ul>
                  ) : (
                    <textarea
                      className="w-full h-full min-h-[6rem] bg-transparent text-sm resize-none outline-none text-zinc-600 placeholder:text-zinc-400"
                      placeholder="보완할 점을 입력하세요..."
                      onChange={(e) =>
                        setReport({ ...report, improvements: e.target.value.split('\n').filter(Boolean) })
                      }
                    />
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Section 3: 총평 */}
          <div className="space-y-3">
            <h3 className="font-bold text-sm text-zinc-800">
              3. 총평
            </h3>
            <div className="min-h-[10rem] rounded-lg border border-zinc-200 bg-zinc-50/50 p-4">
              {report.overall_comment ? (
                <p className="text-sm leading-relaxed text-zinc-700 whitespace-pre-wrap">
                  {report.overall_comment}
                </p>
              ) : (
                <textarea
                  className="w-full h-full min-h-[8rem] bg-transparent text-sm resize-none outline-none text-zinc-600 placeholder:text-zinc-400"
                  placeholder="총평을 입력하세요..."
                  onChange={(e) => setReport({ ...report, overall_comment: e.target.value })}
                />
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="text-right text-xs text-zinc-400 pt-4 border-t">
            대입논술 기본반 | 상담기록지
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** Map AI comment keywords to a grade estimate */
function mapToGrade(strengths: string[] | undefined, keyword: string): Grade {
  if (!strengths) return '중';
  const matched = strengths.some((s) => s.includes(keyword));
  return matched ? '중상' : '중';
}
