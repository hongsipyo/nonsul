import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

export default function StudentsPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">학생 관리</h1>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          학생 추가
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>학생 목록</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-zinc-500">등록된 학생이 없습니다.</p>
        </CardContent>
      </Card>
    </div>
  );
}
