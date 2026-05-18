'use client';

import { useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Upload, FileText, Loader2 } from 'lucide-react';

export default function ExamUploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [university, setUniversity] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') {
      setFile(dropped);
      if (!title) setTitle(dropped.name.replace('.pdf', ''));
    }
  }, [title]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      if (!title) setTitle(selected.name.replace('.pdf', ''));
    }
  };

  const handleSubmit = async () => {
    if (!file || !title) return;
    setUploading(true);
    // TODO: Upload to Supabase Storage + create exam record + trigger AI parse
    setTimeout(() => setUploading(false), 2000);
  };

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">시험 업로드</h1>

      <Card>
        <CardHeader>
          <CardTitle>기출문제 PDF</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-lg p-10 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-blue-500 bg-blue-50' : 'border-zinc-300'
            }`}
            onClick={() => document.getElementById('pdf-input')?.click()}
          >
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileText className="h-8 w-8 text-blue-500" />
                <div className="text-left">
                  <p className="font-medium">{file.name}</p>
                  <p className="text-sm text-zinc-500">
                    {(file.size / 1024 / 1024).toFixed(1)}MB
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 mx-auto text-zinc-400" />
                <p className="text-zinc-500">PDF 파일을 드래그하거나 클릭하세요</p>
              </div>
            )}
            <input
              id="pdf-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

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
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!file || !title || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                업로드 중...
              </>
            ) : (
              '업로드 및 AI 파싱 시작'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
