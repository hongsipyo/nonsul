'use client';

import Image from 'next/image';

export function Topbar({ title }: { title?: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-orange-100 bg-gradient-to-r from-white to-orange-50/50 px-6">
      <h1 className="text-lg font-semibold text-zinc-800">{title}</h1>
      <div className="flex items-center gap-3">
        <Image src="/logos/process-logo-sm.svg" alt="프로세스 논술" width={100} height={22} className="opacity-50" />
      </div>
    </header>
  );
}
