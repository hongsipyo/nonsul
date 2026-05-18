import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">설정</h1>

      <Card>
        <CardHeader>
          <CardTitle>브랜드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">출력 브랜딩</p>
              <p className="text-sm text-zinc-500">
                첨삭 결과물과 수업자료에 표시할 브랜드를 선택합니다.
              </p>
            </div>
            <Badge>프로세스</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI 설정</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="font-medium">Anthropic API 키</p>
            <p className="text-sm text-zinc-500">
              Claude AI를 사용하려면 API 키가 필요합니다.
              console.anthropic.com 에서 발급받으세요.
            </p>
            <p className="mt-2 text-sm">
              상태:{' '}
              <span className="text-amber-600 font-medium">미설정</span>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
