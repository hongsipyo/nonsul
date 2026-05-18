'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Download, Eye, EyeOff } from 'lucide-react';
import type { AnnotationComment } from '@/lib/export/image-annotator';

interface RedPenViewerProps {
  imageUrl: string;
  imagePage: number;
  comments: AnnotationComment[];
  answerOutline?: string;
  summary?: string;
  strengths?: string;
  improvements?: string;
  brand?: '프로세스' | '독립';
  studentName?: string;
  examTitle?: string;
}

export function RedPenViewer({
  imageUrl,
  imagePage,
  comments,
  answerOutline,
  summary,
  strengths,
  improvements,
  brand = '프로세스',
  studentName,
  examTitle,
}: RedPenViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendering, setRendering] = useState(false);
  const [rendered, setRendered] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);

  // Filter comments for this page
  const pageComments = comments.filter((c) => true); // All comments for now (single page)

  const renderAnnotation = async () => {
    setRendering(true);
    try {
      const { annotateImage } = await import('@/lib/export/image-annotator');
      const result = await annotateImage(imageUrl, {
        marginComments: pageComments,
        answerOutline,
        summary,
        strengths,
        improvements,
        brand,
      });

      // Copy to our canvas
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.width = result.width;
        canvas.height = result.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(result, 0, 0);
        }
      }
      setRendered(true);
    } catch (err) {
      console.error('빨간펜 렌더링 실패:', err);
    } finally {
      setRendering(false);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${studentName || '학생'}_${examTitle || '첨삭'}_빨간펜_p${imagePage}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  useEffect(() => {
    if (showOverlay && pageComments.length > 0) {
      renderAnnotation();
    }
  }, [showOverlay, imageUrl]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-500">답안 {imagePage}페이지</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowOverlay(!showOverlay)}
            className="text-xs h-7"
          >
            {showOverlay ? (
              <><EyeOff className="h-3 w-3 mr-1" />원본</>
            ) : (
              <><Eye className="h-3 w-3 mr-1" />빨간펜</>
            )}
          </Button>
          {rendered && (
            <Button variant="ghost" size="sm" onClick={handleDownload} className="text-xs h-7">
              <Download className="h-3 w-3 mr-1" />
              이미지 저장
            </Button>
          )}
        </div>
      </div>

      {showOverlay ? (
        <div className="relative border rounded-lg overflow-hidden bg-white">
          {rendering && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
              <Loader2 className="h-6 w-6 animate-spin text-red-500" />
              <span className="ml-2 text-sm text-red-500">빨간펜 렌더링 중...</span>
            </div>
          )}
          <canvas
            ref={canvasRef}
            className="w-full h-auto"
            style={{ display: rendered ? 'block' : 'none' }}
          />
          {!rendered && !rendering && (
            <div className="flex items-center justify-center py-20">
              <Button onClick={renderAnnotation} variant="outline">
                <Eye className="h-4 w-4 mr-2" />
                빨간펜 보기
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <img
            src={imageUrl}
            alt={`답안 ${imagePage}페이지`}
            className="w-full"
          />
        </div>
      )}
    </div>
  );
}
