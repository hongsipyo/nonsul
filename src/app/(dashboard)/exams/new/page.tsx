'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2, CheckCircle, ImageIcon, X } from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.pdf,.hwp,.doc,.docx,.heic,.heif,.jpg,.jpeg,.png';

function isAcceptedFile(file: File): boolean {
  const ext = file.name.split('.').pop()?.toLowerCase();
  return ['pdf', 'hwp', 'doc', 'docx', 'heic', 'heif', 'jpg', 'jpeg', 'png'].includes(ext || '');
}

function getFileIcon(file: File) {
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (['jpg', 'jpeg', 'png', 'heic', 'heif'].includes(ext || '')) return ImageIcon;
  return FileText;
}

function stripExtension(name: string) {
  return name.replace(/\.(pdf|hwp|doc|docx|heic|heif|jpg|jpeg|png)$/i, '');
}

function formatSize(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}

export default function ExamUploadPage() {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState('');
  const [university, setUniversity] = useState('');
  const [scoringNote, setScoringNote] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'parsing' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter(isAcceptedFile);
    if (accepted.length === 0) return;
    setFiles((prev) => [...prev, ...accepted]);
    if (!title && accepted.length > 0) {
      setTitle(stripExtension(accepted[0].name));
    }
  }, [title]);

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = ''; // 같은 파일 다시 선택 가능하게
  };

  const handleSubmit = async () => {
    if (files.length === 0 || !title) return;
    setUploading(true);
    setStatus('uploading');
    setErrorMsg('');

    try {
      const formData = new FormData();
      // 파일이 1개면 기존대로, 여러 개면 모두 append
      for (const f of files) {
        formData.append('files', f);
      }
      formData.append('title', title);
      formData.append('university', university);
      if (scoringNote) formData.append('scoringNote', scoringNote);

      const uploadRes = await fetch('/api/exams', { method: 'POST', body: formData });
      if (!uploadRes.ok) {
        const err = await uploadRes.json();
        throw new Error(err.error || '업로드 실패');
      }
      const exam = await uploadRes.json();

      setStatus('parsing');
      const parseRes = await fetch(`/api/exams/${exam.id}/parse`, { method: 'POST' });
      if (!parseRes.ok) {
        const err = await parseRes.json();
        throw new Error(err.error || '파싱 실패');
      }

      setStatus('done');
      setTimeout(() => router.push(`/exams/${exam.id}`), 1500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">시험 업로드</h1>

      <Card>
        <CardHeader>
          <CardTitle>기출문제 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* 드래그앤드롭 영역 */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-zinc-300'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            <div className="space-y-2">
              <Upload className="h-10 w-10 mx-auto text-zinc-400" />
              <p className="text-zinc-500">파일을 드래그하거나 클릭하세요</p>
              <p className="text-xs text-zinc-400">PDF, HWP, Word, JPG, JPEG, PNG, HEIC — 여러 파일 선택 가능</p>
            </div>
            <input
              id="file-input"
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* 파일 목록 */}
          {files.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">{files.length}개 파일 선택됨</p>
              <div className="max-h-48 overflow-y-auto space-y-1">
                {files.map((f, i) => {
                  const Icon = getFileIcon(f);
                  return (
                    <div key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-zinc-50 rounded-md text-sm">
                      <Icon className="h-4 w-4 text-blue-500 shrink-0" />
                      <span className="truncate flex-1">{f.name}</span>
                      <span className="text-xs text-zinc-400 shrink-0">{formatSize(f.size)}</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                        className="text-zinc-400 hover:text-red-500 shrink-0"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">시험 제목</label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="예: 2025 중앙대 인문논술 4회차"
              />
            </div>
            <div>
              <label className="text-sm font-medium">대학교</label>
              <Input
                value={university}
                onChange={(e) => setUniversity(e.target.value)}
                placeholder="예: 중앙대학교"
              />
            </div>
            <div>
              <label className="text-sm font-medium">대학별 채점 코멘트 (선택)</label>
              <textarea
                value={scoringNote}
                onChange={(e) => setScoringNote(e.target.value)}
                placeholder="예: 경희대 사회는 강력한 비판/옹호 허용, 수리논술 시사점 코멘트 중요. 연세대는 이항대립 이해 필수."
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-400 mt-1">
                여기 적은 내용이 채점기준 생성과 첨삭에 반영됩니다.
              </p>
            </div>
          </div>

          {status === 'error' && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
              {errorMsg}
            </div>
          )}

          {status === 'done' ? (
            <div className="flex items-center justify-center gap-2 rounded-md bg-green-50 p-3 text-green-700">
              <CheckCircle className="h-5 w-5" />
              파싱 완료! 시험 상세 페이지로 이동합니다...
            </div>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={files.length === 0 || !title || uploading}
              className="w-full"
            >
              {status === 'uploading' && (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />업로드 중...</>
              )}
              {status === 'parsing' && (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI 파싱 중... (30초~1분)</>
              )}
              {(status === 'idle' || status === 'error') && '업로드 및 AI 파싱 시작'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
