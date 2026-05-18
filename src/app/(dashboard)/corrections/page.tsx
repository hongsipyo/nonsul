import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PenTool } from 'lucide-react';

export default function CorrectionsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">첨삭</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5" />
              새 첨삭
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-zinc-500">
              시험을 선택하고 학생 답안을 업로드하면 AI가 자동으로 첨삭합니다.
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium">시험 선택</label>
                <p className="text-sm text-zinc-400 mt-1">
                  먼저 시험을 업로드하세요.
                </p>
              </div>
              <div>
                <label className="text-sm font-medium">학생 답안</label>
                <div className="border-2 border-dashed rounded-lg p-8 text-center text-zinc-400 mt-1">
                  시험을 선택한 후 답안 이미지를 업로드하세요
                </div>
              </div>
            </div>
            <Button disabled className="w-full">
              AI 첨삭 시작
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>최근 첨삭 기록</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-zinc-500">첨삭 기록이 없습니다.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
