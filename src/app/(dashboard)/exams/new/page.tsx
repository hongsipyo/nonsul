'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2, CheckCircle, ImageIcon, X } from 'lucide-react';

const ACCEPTED_EXTENSIONS = '.pdf,.hwp,.doc,.docx,.heic,.heif,.jpg,.jpeg,.png';
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'heic', 'heif'];

function getExt(file: File): string {
  return file.name.split('.').pop()?.toLowerCase() || '';
}

function isAcceptedFile(file: File): boolean {
  return ['pdf', 'hwp', 'doc', 'docx', ...IMAGE_EXTS].includes(getExt(file));
}

function getFileIcon(file: File) {
  return IMAGE_EXTS.includes(getExt(file)) ? ImageIcon : FileText;
}

function stripExtension(name: string) {
  return name.replace(/\.(pdf|hwp|doc|docx|heic|heif|jpg|jpeg|png)$/i, '');
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + 'KB';
  return (bytes / 1024 / 1024).toFixed(1) + 'MB';
}

/**
 * HEIC → JPEG 변환 (브라우저에서)
 * Vercel sharp에 HEIC 디코더가 없어서 반드시 클라이언트에서 변환해야 함
 */
async function convertHeicFile(file: File): Promise<File> {
  const heic2any = (await import('heic2any')).default;
  const result = await heic2any({ blob: file, toType: 'image/jpeg', quality: 0.92 });
  const blob = Array.isArray(result) ? result[0] : result;
  return new File([blob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), { type: 'image/jpeg' });
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
  const [progress, setProgress] = useState('');

  const [converting, setConverting] = useState(false);

  const addFiles = useCallback(async (newFiles: FileList | File[]) => {
    const accepted = Array.from(newFiles).filter(isAcceptedFile);
    if (accepted.length === 0) return;

    // HEIC 파일이 있으면 변환
    const hasHeic = accepted.some((f) => ['heic', 'heif'].includes(getExt(f)));
    if (hasHeic) setConverting(true);

    try {
      const processed: File[] = [];
      for (const f of accepted) {
        const ext = getExt(f);
        if (ext === 'heic' || ext === 'heif') {
          try {
            processed.push(await convertHeicFile(f));
          } catch (err) {
            console.error('HEIC 변환 실패:', err);
            setStatus('error');
            setErrorMsg(`HEIC 변환 실패 (${f.name}): iPhone 설정 → 카메라 → 포맷 → "높은 호환성"으로 변경 후 다시 촬영하거나, JPG로 변환해서 올려주세요.`);
            return;
          }
        } else {
          processed.push(f);
        }
      }
      setFiles((prev) => [...prev, ...processed]);
      if (!title && accepted.length > 0) {
        setTitle(stripExtension(accepted[0].name));
      }
    } finally {
      setConverting(false);
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
    e.target.value = '';
  };

  const handleSubmit = async () => {
    if (files.length === 0 || !title) return;
    setUploading(true);
    setStatus('uploading');
    setErrorMsg('');

    try {
      // 1단계: 첫 번째 파일로 exam 레코드 생성
      setProgress(`업로드 중... (1/${files.length})`);
      const firstForm = new FormData();
      firstForm.append('file', files[0]);
      firstForm.append('title', title);
      firstForm.append('university', university);
      if (scoringNote) firstForm.append('scoringNote', scoringNote);

      const createRes = await fetch('/api/exams', { method: 'POST', body: firstForm });
      if (!createRes.ok) {
        let msg = '업로드 실패';
        try { msg = (await createRes.json()).error || msg; } catch {}
        throw new Error(msg);
      }
      const exam = await createRes.json();

      // 2단계: 나머지 파일 추가 업로드 (하나씩, body size 제한 우회)
      for (let i = 1; i < files.length; i++) {
        setProgress(`업로드 중... (${i + 1}/${files.length})`);
        const addForm = new FormData();
        addForm.append('file', files[i]);

        const addRes = await fetch(`/api/exams/${exam.id}/add-file`, {
          method: 'POST',
          body: addForm,
        });
        if (!addRes.ok) {
          let msg = '추가 파일 업로드 실패';
          try { msg = (await addRes.json()).error || msg; } catch {}
          throw new Error(msg);
        }
      }

      // 3단계: AI 파싱
      setStatus('parsing');
      setProgress('');
      const parseRes = await fetch(`/api/exams/${exam.id}/parse`, { method: 'POST' });
      if (!parseRes.ok) {
        let msg = '파싱 실패';
        try { msg = (await parseRes.json()).error || msg; } catch {}
        throw new Error(msg);
      }

      setStatus('done');
      setTimeout(() => router.push(`/exams/${exam.id}`), 1500);
    } catch (err) {
      setStatus('error');
      setErrorMsg(err instanceof Error ? err.message : '오류 발생');
    } finally {
      setUploading(false);
      setProgress('');
    }
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">시험 업로드</h1>

      <Card>
        <CardHeader>
          <CardTitle>기출문제 업로드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-zinc-300'
            }`}
            onClick={() => document.getElementById('file-input')?.click()}
          >
            {converting ? (
              <div className="space-y-2">
                <Loader2 className="h-10 w-10 mx-auto text-blue-500 animate-spin" />
                <p className="text-zinc-500">HEIC 이미지 변환 중...</p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-zinc-400" />
                <p className="text-zinc-500">파일을 드래그하거나 클릭하세요</p>
                <p className="text-xs text-zinc-400">PDF, HWP, Word, JPG, JPEG, PNG, HEIC — 여러 파일 선택 가능</p>
              </div>
            )}
            <input
              id="file-input"
              type="file"
              accept={ACCEPTED_EXTENSIONS}
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {files.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-zinc-700">{files.length}개 파일</p>
                <p className="text-xs text-zinc-400">총 {formatSize(totalSize)}</p>
              </div>
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
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 2025 중앙대 인문논술 4회차" />
            </div>
            <div>
              <label className="text-sm font-medium">대학교</label>
              <Input value={university} onChange={(e) => setUniversity(e.target.value)} placeholder="예: 중앙대학교" />
            </div>
            <div>
              <label className="text-sm font-medium">대학별 채점 코멘트 (선택)</label>
              <textarea
                value={scoringNote}
                onChange={(e) => setScoringNote(e.target.value)}
                placeholder="예: 경희대 사회는 강력한 비판/옹호 허용. 연세대는 이항대립 이해 필수."
                className="mt-1 w-full rounded-md border border-zinc-300 px-3 py-2 text-sm min-h-[80px] resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-zinc-400 mt-1">채점기준 생성과 첨삭에 반영됩니다.</p>
            </div>
          </div>

          {status === 'error' && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{errorMsg}</div>
          )}

          {status === 'done' ? (
            <div className="flex items-center justify-center gap-2 rounded-md bg-green-50 p-3 text-green-700">
              <CheckCircle className="h-5 w-5" />
              파싱 완료! 시험 상세 페이지로 이동합니다...
            </div>
          ) : (
            <Button onClick={handleSubmit} disabled={files.length === 0 || !title || uploading || converting} className="w-full">
              {status === 'uploading' && <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{progress || '업로드 중...'}</>}
              {status === 'parsing' && <><Loader2 className="mr-2 h-4 w-4 animate-spin" />AI 파싱 중... (30초~1분)</>}
              {(status === 'idle' || status === 'error') && '업로드 및 AI 파싱 시작'}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
