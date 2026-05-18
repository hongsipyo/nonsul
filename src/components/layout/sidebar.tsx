'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import {
  FileText,
  PenTool,
  Users,
  Settings,
  LayoutDashboard,
  LogOut,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const nav = [
  { href: '/', label: '대시보드', icon: LayoutDashboard },
  { href: '/exams', label: '시험 관리', icon: FileText },
  { href: '/corrections', label: '첨삭', icon: PenTool },
  { href: '/students', label: '학생 관리', icon: Users },
  { href: '/settings', label: '설정', icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-zinc-950 text-white">
      <div className="flex h-14 items-center border-b border-zinc-800 px-4">
        <span className="text-lg font-bold tracking-tight">논술첨삭</span>
      </div>
      <nav className="flex-1 space-y-1 p-2">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                active
                  ? 'bg-zinc-800 text-white'
                  : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-zinc-800 p-3">
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-900 hover:text-white transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
