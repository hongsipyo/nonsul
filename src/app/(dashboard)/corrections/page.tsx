'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
import { PenTool, Upload, Loader2, FileText, Calendar } from 'lucide-react';
import type { Exam, Correction } from '@/types/exam';

export default function CorrectionsPage() {
  const router = useRouter();
  const [exams, setExams] = useState<Exam[]>([]);
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [studentName, setStudentName] = useState('');
  const [studentSchool, setStudentSchool] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'generating' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  // 일괄 첨삭
  const [batchQueue, setBatchQueue] = useState<{ name: string; school: string; files: File[] }[]>([]);
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchLog, setBatchLog] = useState<{ name: string; state: 'wait' | 'doing' | 'done' | 'fail'; msg?: string }[]>([]);

  useEffect(() => {
    fetch('/api/exams')
      .then((r) => r.json())
      .then((data) => {
        const parsed = (Array.isArray(data) ? data : []).filter(
          (e: Exam) => e.status === 'parsed' || e.status === 'analyzed'
        );
        setExams(parsed);
      });

    fetch('/api/corrections')
      .then((r) => r.json())
      .then((data) => setCorrections(Array.isArray(data) ? data : []))
      .catch(() => setCorrections([]));
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleSubmit = async () => {
    if (!selectedExam || files.length === 0) return;
    setSubmitting(true);
    setStatus('uploading');
    setErrorMsg('');

    try {
      // 1. Upload answer + create correction
      const formData = new FormData();
      formData.append('examId', selectedExam);
      formData.append('studentName', studentName);
      formData.append('studentSchool', studentSchool);
      files.forEach((f) => formData.append('files', f));

      const uploadRes = await fetch('/api/corrections', {
        method: 'POST',
        body: formData,
      });
      if (!uploadRes.ok) throw new Error((await uploadRes.json()).error);
      const { correctionId } = await uploadRes.json();

      // 2. Trigger AI correction
      setStatus('generating');
      const genRes = await fetch(`/api/corrections/${correctionId}/generate`, {
        method: 'POST',
      });
      if (!genRes.ok) {
        const err = await genRes.json();
        throw new Error(err.error || 'AI 첨삭 생성 실패');
      }

      setStatus('done');
      setTimeout(() => router.push(`/corrections/${correctionId}`), 1500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setSubmitting(false);
    }
  };

  const processOne = async (name: string, school: string, fileList: File[]) => {
    const fd = new FormData();
    fd.append('examId', selectedExam);
    fd.append('studentName', name);
    fd.append('studentSchool', school);
    fileList.forEach((f) => fd.append('files', f));
    const up = await fetch('/api/corrections', { method: 'POST', body: fd });
    if (!up.ok) throw new Error((await up.json()).error || '업로드 실패');
    const { correctionId } = await up.json();
    const gen = await fetch(`/api/corrections/${correctionId}/generate`, { method: 'POST' });
    if (!gen.ok) throw new Error((await gen.json()).error || 'AI 첨삭 실패');
    return correctionId;
  };

  const addToBatch = () => {
    if (!studentName.trim() || files.length === 0) return;
    setBatchQueue((q) => [...q, { name: studentName.trim(), school: studentSchool.trim(), files }]);
    setStudentName('');
    setStudentSchool('');
    setFiles([]);
  };

  const removeFromBatch = (idx: number) => setBatchQueue((q) => q.filter((_, i) => i !== idx));

  const runBatch = async () => {
    if (!selectedExam || batchQueue.length === 0) return;
    setBatchRunning(true);
    setBatchLog(batchQueue.map((b) => ({ name: b.name, state: 'wait' as const })));
    for (let i = 0; i < batchQueue.length; i++) {
      setBatchLog((log) => log.map((l, idx) => (idx === i ? { ...l, state: 'doing' } : l)));
      try {
        await processOne(batchQueue[i].name, batchQueue[i].school, batchQueue[i].files);
        setBatchLog((log) => log.map((l, idx) => (idx === i ? { ...l, state: 'done' } : l)));
      } catch (err) {
        setBatchLog((log) => log.map((l, idx) => (idx === i ? { ...l, state: 'fail', msg: err instanceof Error ? err.message : '오류' } : l)));
      }
    }
    setBatchRunning(false);
    fetch('/api/corrections').then((r) => r.json()).then((d) => setCorrections(Array.isArray(d) ? d : []));
    setBatchQueue([]);
  };

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">첨삭</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              새 첨삭
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">시험 선택</label>
              {exams.length === 0 ? (
                <p className="text-sm text-zinc-400 mt-1">
                  파싱 완료된 시험이 없습니다. 먼저 시험을 업로드하세요.
                </p>
              ) : (
                <Select value={selectedExam} onValueChange={(v) => v && setSelectedExam(v)}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="시험을 선택하세요" />
                  </SelectTrigger>
                  <SelectContent>
                    {exams.map((exam) => (
                      <SelectItem key={exam.id} value={exam.id}>
                        {exam.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">학생 이름</label>
                <Input
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  placeholder="이름"
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">학교</label>
                <Input
                  value={studentSchool}
                  onChange={(e) => setStudentSchool(e.target.value)}
                  placeholder="학교"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">학생 답안 이미지</label>
              <div
                className="border-2 border-dashed rounded-lg p-6 text-center mt-1 cursor-pointer hover:border-blue-400 transition-colors"
                onClick={() => document.getElementById('answer-input')?.click()}
              >
                {files.length > 0 ? (
                  <div className="space-y-1">
                    {files.map((f, i) => (
                      <p key={i} className="text-sm">
                        📄 {f.name} ({(f.size / 1024).toFixed(0)}KB)
                      </p>
                    ))}
                  </div>
                ) : (
                  <div>
                    <Upload className="h-8 w-8 mx-auto text-zinc-400 mb-2" />
                    <p className="text-sm text-zinc-500">답안 이미지를 선택하세요 (복수 선택 가능)</p>
                  </div>
                )}
                <input
                  id="answer-input"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleFileChange}
                />
              </div>
            </div>

            {status === 'error' && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
                {errorMsg}
              </div>
            )}

            {status === 'done' ? (
              <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 text-center">
                첨삭 완료! 결과 페이지로 이동합니다...
              </div>
            ) : (
              <Button
                onClick={handleSubmit}
                disabled={!selectedExam || files.length === 0 || submitting}
                className="w-full"
              >
                {status === 'uploading' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status === 'generating' && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {status === 'uploading' && '답안 업로드 중...'}
                {status === 'generating' && 'AI 첨삭 중... (1~2분)'}
                {(status === 'idle' || status === 'error') && 'AI 첨삭 시작'}
              </Button>
            )}

            {/* ===== 일괄 첨삭 ===== */}
            <div className="border-t pt-4 mt-2 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-600">일괄 첨삭 (여러 학생)</p>
                <Button variant="outline" size="sm" onClick={addToBatch} disabled={!studentName.trim() || files.length === 0 || batchRunning}>
                  + 대기열 추가
                </Button>
              </div>
              <p className="text-xs text-zinc-400">학생 이름·답안을 채우고 ‘대기열 추가’를 반복한 뒤, 아래 버튼으로 한 번에 처리합니다.</p>

              {batchQueue.length > 0 && (
                <div className="space-y-1">
                  {batchQueue.map((b, i) => (
                    <div key={i} className="flex items-center justify-between text-sm bg-zinc-50 rounded px-3 py-1.5">
                      <span>{b.name} {b.school && <span className="text-zinc-400">· {b.school}</span>} <span className="text-zinc-400">({b.files.length}장)</span></span>
                      <button onClick={() => removeFromBatch(i)} disabled={batchRunning} className="text-zinc-400 hover:text-red-500 text-xs">삭제</button>
                    </div>
                  ))}
                </div>
              )}

              {batchLog.length > 0 && (
                <div className="space-y-1">
                  {batchLog.map((l, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <span>{l.state === 'done' ? '✅' : l.state === 'fail' ? '❌' : l.state === 'doing' ? '⏳' : '⏸️'}</span>
                      <span>{l.name}</span>
                      {l.msg && <span className="text-xs text-red-500">{l.msg}</span>}
                    </div>
                  ))}
                </div>
              )}

              {batchQueue.length > 0 && (
                <Button onClick={runBatch} disabled={!selectedExam || batchRunning} className="w-full" variant="secondary">
                  {batchRunning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> 일괄 첨삭 중...</> : `일괄 첨삭 시작 (${batchQueue.length}명)`}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 첨삭 기록</CardTitle>
          </CardHeader>
          <CardContent>
            {corrections.length === 0 ? (
              <p className="text-sm text-zinc-500">첨삭 기록이 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {corrections.slice(0, 10).map((c: any) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:bg-zinc-50"
                    onClick={() => router.push(`/corrections/${c.id}`)}
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-zinc-400" />
                      <div>
                        <p className="text-sm font-medium">
                          {c.student_answers?.student_name || '이름 없음'}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {c.exams?.title}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {c.grade && <Badge variant="outline">{c.grade}</Badge>}
                      <Badge
                        variant={c.status === 'completed' ? 'default' : c.status === 'error' ? 'destructive' : 'outline'}
                      >
                        {c.status === 'completed' ? '완료' : c.status === 'processing' ? '진행중' : c.status === 'error' ? '오류' : '대기'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
