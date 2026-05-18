'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Mic, Upload, Loader2, FileText, BookOpen } from 'lucide-react';

const universities = ['서울대', '연세대', '고려대'];
const years = ['2024', '2023', '2022', '2021', '2020', '2019', '2018', '2017', '2016'];
const sessions = ['인문학 오전', '인문학 오후', '사회과학 오전', '사회과학 오후'];

export default function OralExamPage() {
  const [university, setUniversity] = useState('');
  const [year, setYear] = useState('');
  const [session, setSession] = useState('');
  const [generating, setGenerating] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  const handleGenerate = async () => {
    if (!university || !year) return;
    setGenerating(true);
    // TODO: Call AI to generate oral exam answer
    setTimeout(() => setGenerating(false), 2000);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">구술 면접</h1>
        <Badge variant="outline">서연고 인문계열</Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 기출 선택 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              기출문제 예시답안 생성
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">
              대학, 연도, 시간대를 선택하면 AI가 예시답안 + 수업자료를 생성합니다.
            </p>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium">대학</label>
                <Select value={university} onValueChange={(v) => v && setUniversity(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="대학" />
                  </SelectTrigger>
                  <SelectContent>
                    {universities.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">연도</label>
                <Select value={year} onValueChange={(v) => v && setYear(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="연도" />
                  </SelectTrigger>
                  <SelectContent>
                    {years.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium">시간대</label>
                <Select value={session} onValueChange={(v) => v && setSession(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="선택" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!university || !year || generating}
              className="w-full"
            >
              {generating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />예시답안 생성 중...</>
              ) : (
                '예시답안 + 수업자료 생성'
              )}
            </Button>
          </CardContent>
        </Card>

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
              구술문제 PDF를 직접 업로드하면 AI가 제시문을 파싱하고 예시답안을 생성합니다.
            </p>
            <div
              className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-blue-400 transition-colors"
              onClick={() => document.getElementById('oral-pdf-input')?.click()}
            >
              {file ? (
                <div className="flex items-center justify-center gap-2">
                  <FileText className="h-6 w-6 text-blue-500" />
                  <span className="text-sm font-medium">{file.name}</span>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                  <p className="text-sm text-zinc-500">PDF 파일을 드래그하거나 클릭</p>
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
            <Button disabled={!file} className="w-full" variant="outline">
              업로드 및 분석
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* 최근 생성 기록 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            생성된 수업자료
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">아직 생성된 구술 수업자료가 없습니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
