'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, Download, ArrowLeft, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';

interface CorrectionEntry {
  id: string;
  created_at: string;
  total_score: number | null;
  grade: string | null;
  exam_title: string;
  university?: string;
}

export default function StudentTranscriptPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const [student, setStudent] = useState<any>(null);
  const [entries, setEntries] = useState<CorrectionEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/students').then((r) => r.json()),
      fetch('/api/corrections').then((r) => r.json()),
    ]).then(([students, allCorrections]) => {
      const s = (Array.isArray(students) ? students : []).find((s: any) => s.id === studentId);
      setStudent(s);

      const corrs = (Array.isArray(allCorrections) ? allCorrections : [])
        .filter((c: any) => c.student_answers?.student_name === s?.name && c.status === 'completed')
        .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        .map((c: any) => ({
          id: c.id,
          created_at: c.created_at,
          total_score: c.total_score,
          grade: c.grade,
          exam_title: c.exams?.title || '시험',
          university: c.exams?.university,
        }));

      setEntries(corrs);
      setLoading(false);
    });
  }, [studentId]);

  const handleDownloadPDF = async () => {
    if (!student || entries.length === 0) return;

    const { generateCorrectionPDF } = await import('@/lib/export/correction-pdf');
    const jsPDF = (await import('jspdf')).default;
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Load Pretendard font
    const [regularBuf, boldBuf] = await Promise.all([
      fetch('/fonts/Pretendard-Regular.ttf').then((r) => r.arrayBuffer()),
      fetch('/fonts/Pretendard-Bold.ttf').then((r) => r.arrayBuffer()),
    ]);
    const toBase64 = (buf: ArrayBuffer) => {
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    };
    doc.addFileToVFS('Pretendard-Regular.ttf', toBase64(regularBuf));
    doc.addFont('Pretendard-Regular.ttf', 'Pretendard', 'normal');
    doc.addFileToVFS('Pretendard-Bold.ttf', toBase64(boldBuf));
    doc.addFont('Pretendard-Bold.ttf', 'Pretendard', 'bold');
    doc.setFont('Pretendard', 'normal');

    const margin = 15;
    const pageWidth = 210;
    let y = margin;

    // Header
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(255, 119, 0);
    doc.text('프로세스 논술학원', margin, y);
    y += 6;

    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text('논술 성적표', margin, y);
    y += 10;

    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(11);
    doc.setTextColor(80, 80, 80);
    const info = [student.name, student.school, student.target_university ? `목표: ${student.target_university}` : ''].filter(Boolean).join(' | ');
    doc.text(info, margin, y);
    y += 10;

    // Table header
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    doc.setFont('Pretendard', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(0, 0, 0);
    doc.text('회차', margin, y);
    doc.text('일자', margin + 15, y);
    doc.text('시험', margin + 45, y);
    doc.text('대학', margin + 115, y);
    doc.text('점수', margin + 145, y);
    doc.text('등급', margin + 165, y);
    y += 3;
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;

    // Table rows
    doc.setFont('Pretendard', 'normal');
    doc.setFontSize(9);
    entries.forEach((entry, i) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.setTextColor(80, 80, 80);
      doc.text(`${i + 1}`, margin + 3, y);
      doc.text(new Date(entry.created_at).toLocaleDateString('ko-KR'), margin + 15, y);

      const titleText = doc.splitTextToSize(entry.exam_title, 65);
      doc.setTextColor(0, 0, 0);
      doc.text(titleText[0], margin + 45, y);

      doc.setTextColor(80, 80, 80);
      doc.text(entry.university || '-', margin + 115, y);

      if (entry.total_score != null) {
        doc.setTextColor(0, 0, 0);
        doc.setFont('Pretendard', 'bold');
        doc.text(`${entry.total_score}`, margin + 148, y);
        doc.setFont('Pretendard', 'normal');
      } else {
        doc.text('-', margin + 148, y);
      }

      doc.text(entry.grade || '-', margin + 168, y);
      y += 7;
    });

    // Summary
    y += 5;
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;

    const scores = entries.map((e) => e.total_score).filter((s): s is number => s != null);
    if (scores.length > 0) {
      const avg = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
      const max = Math.max(...scores);
      const min = Math.min(...scores);
      const trend = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;

      doc.setFont('Pretendard', 'bold');
      doc.setFontSize(10);
      doc.text('요약', margin, y);
      y += 6;

      doc.setFont('Pretendard', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text(`평균: ${avg}점  |  최고: ${max}점  |  최저: ${min}점  |  추세: ${trend >= 0 ? '+' : ''}${trend}점`, margin, y);
    }

    // Footer
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(`${i} / ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
      doc.text('프로세스 논술학원', pageWidth - margin, 290, { align: 'right' });
    }

    doc.save(`${student.name}_논술성적표.pdf`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!student) return <div className="p-6">학생을 찾을 수 없습니다.</div>;

  // Stats
  const scores = entries.map((e) => e.total_score).filter((s): s is number => s != null);
  const avg = scores.length > 0 ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1) : '-';
  const maxScore = scores.length > 0 ? Math.max(...scores) : null;
  const trend = scores.length >= 2 ? scores[scores.length - 1] - scores[0] : 0;

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/students/${studentId}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-1 h-4 w-4" />
              돌아가기
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold">{student.name} 성적표</h1>
            <p className="text-sm text-zinc-500">
              {student.school && `${student.school} · `}
              {entries.length}회 첨삭
            </p>
          </div>
        </div>
        <Button onClick={handleDownloadPDF} disabled={entries.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          PDF 다운로드
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-zinc-500">총 첨삭</p>
            <p className="text-2xl font-bold">{entries.length}회</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-zinc-500">평균 점수</p>
            <p className="text-2xl font-bold">{avg}점</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-zinc-500">최고 점수</p>
            <p className="text-2xl font-bold">{maxScore != null ? `${maxScore}점` : '-'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 text-center">
            <p className="text-sm text-zinc-500">추세</p>
            <div className="flex items-center justify-center gap-1">
              {trend > 0 ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : trend < 0 ? (
                <TrendingDown className="h-5 w-5 text-red-600" />
              ) : (
                <Minus className="h-5 w-5 text-zinc-400" />
              )}
              <span className={`text-2xl font-bold ${trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-600' : ''}`}>
                {trend >= 0 ? '+' : ''}{trend}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Score Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">점수 이력</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-zinc-500 py-4 text-center">완료된 첨삭이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-zinc-500">
                    <th className="py-2 px-2 w-12">회차</th>
                    <th className="py-2 px-2">일자</th>
                    <th className="py-2 px-2">시험</th>
                    <th className="py-2 px-2">대학</th>
                    <th className="py-2 px-2 text-right">점수</th>
                    <th className="py-2 px-2 text-center">등급</th>
                    <th className="py-2 px-2 text-right">변동</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, i) => {
                    const prevScore = i > 0 ? entries[i - 1].total_score : null;
                    const diff = entry.total_score != null && prevScore != null ? entry.total_score - prevScore : null;
                    return (
                      <tr key={entry.id} className="border-b hover:bg-zinc-50">
                        <td className="py-2.5 px-2 text-zinc-400">{i + 1}</td>
                        <td className="py-2.5 px-2">
                          {new Date(entry.created_at).toLocaleDateString('ko-KR')}
                        </td>
                        <td className="py-2.5 px-2">
                          <Link href={`/corrections/${entry.id}`} className="text-blue-600 hover:underline">
                            {entry.exam_title}
                          </Link>
                        </td>
                        <td className="py-2.5 px-2 text-zinc-500">{entry.university || '-'}</td>
                        <td className="py-2.5 px-2 text-right font-bold">
                          {entry.total_score != null ? `${entry.total_score}점` : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-center">
                          {entry.grade ? <Badge variant="outline">{entry.grade}</Badge> : '-'}
                        </td>
                        <td className="py-2.5 px-2 text-right">
                          {diff != null && (
                            <span className={diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-600' : 'text-zinc-400'}>
                              {diff > 0 ? `+${diff}` : diff}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Score Bar Chart (simple CSS bars) */}
      {scores.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">점수 추이</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-40">
              {entries.map((entry, i) => {
                const score = entry.total_score || 0;
                const maxPossible = 100;
                const height = (score / maxPossible) * 100;
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-medium">{score}</span>
                    <div
                      className="w-full rounded-t bg-blue-500 transition-all"
                      style={{ height: `${height}%`, minHeight: '4px' }}
                    />
                    <span className="text-[10px] text-zinc-400">{i + 1}회</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
