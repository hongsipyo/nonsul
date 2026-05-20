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
  Mic,
  BookOpen,
  Calendar,
  Stethoscope,
  MessageSquare,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const nav = [
  { href: '/', label: '대시보드', icon: LayoutDashboard, group: 'main' },
  { href: '/exams', label: '시험 관리', icon: FileText, group: '수업' },
  { href: '/corrections', label: '첨삭', icon: PenTool, group: '수업' },
  { href: '/oral-exam', label: '구술 면접', icon: Mic, group: '수업' },
  { href: '/students', label: '학생 관리', icon: Users, group: '학원' },
  { href: '/classes', label: '반 관리', icon: BookOpen, group: '학원' },
  { href: '/attendance', label: '출결', icon: Calendar, group: '학원' },
  { href: '/clinic', label: '클리닉 예약', icon: Stethoscope, group: '학원' },
  { href: '/messages', label: '알림/메시지', icon: MessageSquare, group: '학원' },
  { href: '/settings', label: '설정', icon: Settings, group: 'system' },
];

const groups = [
  { key: 'main', label: null },
  { key: '수업', label: '수업 · 첨삭' },
  { key: '학원', label: '학원 관리' },
  { key: 'system', label: null },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-zinc-950 text-white">
      <div className="flex h-14 items-center border-b border-zinc-800 px-4">
        <span className="text-lg font-bold tracking-tight">멋진논술연구소</span>
      </div>
      <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
        {groups.map(({ key, label }) => {
          const items = nav.filter((n) => n.group === key);
          if (items.length === 0) return null;
          return (
            <div key={key}>
              {label && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                  {label}
                </p>
              )}
              {items.map(({ href, label: itemLabel, icon: Icon }) => {
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
                    {itemLabel}
                  </Link>
                );
              })}
            </div>
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
