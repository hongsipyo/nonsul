import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default function ExamsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">시험 관리</h1>
        <Link href="/exams/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            시험 업로드
          </Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>시험지 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">
            아직 업로드된 시험이 없습니다. PDF를 업로드하면 AI가 자동으로 제시문과 문제를 파싱합니다.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
