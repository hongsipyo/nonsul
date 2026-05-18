'use client';

import { Badge } from '@/components/ui/badge';

export function Topbar({ title }: { title?: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-6">
      <h1 className="text-lg font-semibold">{title}</h1>
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs">
          프로세스
        </Badge>
      </div>
    </header>
  );
}
