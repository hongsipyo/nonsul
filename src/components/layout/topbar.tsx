'use client';

export function Topbar({ title }: { title?: string }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-orange-100 bg-gradient-to-r from-white to-orange-50/50 px-6">
      <h1 className="text-lg font-semibold text-zinc-800">{title}</h1>
      <div className="flex items-center gap-2 text-sm text-orange-400">
        🐱 홍시표T 논술 작업실
      </div>
    </header>
  );
}
