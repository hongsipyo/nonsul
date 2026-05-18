import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, Play, Clock, Eye } from 'lucide-react';

const sampleVideos = [
  { id: 1, title: '연세대 논술 기출 해설 (2025)', duration: '42:15', views: 128, status: '공개', thumbnail: null },
  { id: 2, title: '고려대 인문논술 전략', duration: '38:00', views: 95, status: '공개', thumbnail: null },
  { id: 3, title: '논제 분석법 기초', duration: '25:30', views: 210, status: '공개', thumbnail: null },
  { id: 4, title: '성균관대 모의 해설', duration: '35:45', views: 0, status: '비공개', thumbnail: null },
  { id: 5, title: '중앙대 기출 분석', duration: '30:10', views: 67, status: '공개', thumbnail: null },
  { id: 6, title: '첨삭 사례 모음 (1)', duration: '18:20', views: 0, status: '업로드중', thumbnail: null },
];

const statusColor: Record<string, string> = {
  공개: 'bg-green-100 text-green-700',
  비공개: 'bg-zinc-100 text-zinc-500',
  업로드중: 'bg-orange-100 text-orange-700',
};

export default function VideosPage() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">영상 관리</h1>
        <Button className="bg-orange-500 hover:bg-orange-600 text-white">
          <Upload className="h-4 w-4 mr-1" />
          영상 업로드
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sampleVideos.map((video) => (
          <Card key={video.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer">
            <div className="relative aspect-video bg-zinc-800 flex items-center justify-center">
              <Play className="h-10 w-10 text-white/60" />
              <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-1.5 py-0.5 rounded">
                {video.duration}
              </div>
            </div>
            <CardContent className="pt-3">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                <Badge className={statusColor[video.status]}>{video.status}</Badge>
              </div>
              <div className="flex items-center gap-3 mt-2 text-xs text-zinc-400">
                <span className="flex items-center gap-1">
                  <Eye className="h-3 w-3" />
                  {video.views}회
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {video.duration}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
