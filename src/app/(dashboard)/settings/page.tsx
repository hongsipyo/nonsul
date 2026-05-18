'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { GraduationCap, Settings, Sparkles } from 'lucide-react';

interface UniversityPreset {
  name: string;
  tag: string;
  description: string;
  color: string;
}

const universityPresets: UniversityPreset[] = [
  {
    name: '경희대 인문',
    tag: '인문',
    description: '후마니타스 학풍, 인문학적 가치 중시. 텍스트의 철학적 함의를 깊이 있게 분석하는 것이 핵심.',
    color: 'bg-purple-100 text-purple-700',
  },
  {
    name: '경희대 사회',
    tag: '사회',
    description: '강력한 비판/옹호 허용. 수리논술 시사점 코멘트가 중요. 사회과학적 분석력과 논리적 근거 제시 필수.',
    color: 'bg-indigo-100 text-indigo-700',
  },
  {
    name: '연세대',
    tag: '최상위',
    description: '이항대립 이해 필수, 스키마(도식) 활용이 중요. 제시문 간 관계 파악과 통합적 사고력 평가.',
    color: 'bg-blue-100 text-blue-700',
  },
  {
    name: '고려대',
    tag: '최상위',
    description: '시민과 국가, 공동체 윤리 주제 빈출. 사회적 쟁점에 대한 균형 잡힌 시각 요구.',
    color: 'bg-red-100 text-red-700',
  },
  {
    name: '성균관대',
    tag: '상위',
    description: '정형화된 출제 패턴, 정석 빌드 중심. 유형별 접근법 숙지가 고득점 핵심.',
    color: 'bg-green-100 text-green-700',
  },
  {
    name: '동국대',
    tag: '중상위',
    description: '지문은 짧지만 요구사항이 많음. 중상위 난이도로, 제한된 분량 안에서의 핵심 파악력 평가.',
    color: 'bg-amber-100 text-amber-700',
  },
  {
    name: '홍익대',
    tag: '비정형',
    description: '비정형 출제. 매년 유형이 달라지므로 기본기와 유연한 대응력이 중요.',
    color: 'bg-pink-100 text-pink-700',
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Settings className="h-6 w-6 text-zinc-600" />
        <h1 className="text-2xl font-bold">설정</h1>
      </div>

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

      <Separator />

      {/* University Scoring Presets */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-zinc-600" />
            <CardTitle>대학별 채점 프리셋</CardTitle>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            대학별 논술 채점 기준과 출제 특성을 정리한 참고 자료입니다.
            첨삭 시 해당 대학의 특성을 반영합니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {universityPresets.map((preset, idx) => (
            <div key={idx}>
              {idx > 0 && <Separator className="mb-3" />}
              <div className="flex items-start gap-3">
                <div className="flex items-center gap-2 min-w-[7rem]">
                  <Sparkles className="h-4 w-4 text-zinc-400 shrink-0" />
                  <span className="font-semibold text-sm">{preset.name}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${preset.color}`}>
                      {preset.tag}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-600 leading-relaxed">
                    {preset.description}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
