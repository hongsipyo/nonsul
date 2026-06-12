'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
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
  Star,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

const nav = [
  { href: '/', label: '대시보드', icon: LayoutDashboard, emoji: '🏠', group: 'main' },
  { href: '/exams', label: '시험 관리', icon: FileText, emoji: '📝', group: '수업' },
  { href: '/corrections', label: '첨삭', icon: PenTool, emoji: '✏️', group: '수업' },
  { href: '/best-answers', label: '우수답안', icon: Star, emoji: '⭐', group: '수업' },
  { href: '/oral-exam', label: '구술 면접', icon: Mic, emoji: '🎤', group: '수업' },
  { href: '/students', label: '학생 관리', icon: Users, emoji: '👨‍🎓', group: '학원' },
  { href: '/classes', label: '반 관리', icon: BookOpen, emoji: '📚', group: '학원' },
  { href: '/attendance', label: '출결', icon: Calendar, emoji: '📅', group: '학원' },
  { href: '/clinic', label: '클리닉 예약', icon: Stethoscope, emoji: '🩺', group: '학원' },
  { href: '/messages', label: '알림/메시지', icon: MessageSquare, emoji: '💌', group: '학원' },
  { href: '/settings', label: '설정', icon: Settings, emoji: '⚙️', group: 'system' },
];

const groups = [
  { key: 'main', label: null },
  { key: '수업', label: '📖 수업 · 첨삭' },
  { key: '학원', label: '🏫 학원 관리' },
  { key: 'system', label: null },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 flex-col border-r border-orange-200 bg-gradient-to-b from-amber-50 via-orange-50 to-yellow-50">
      {/* 로고 영역 */}
      <div className="flex flex-col items-center border-b border-orange-200 px-4 py-4 bg-white/50">
        <Image src="/stickers/chunsik-homework.png" alt="춘식이" width={80} height={80} className="mb-1" />
        <span className="text-base font-extrabold tracking-tight text-orange-600">홍시표T 논술 작업실</span>
      </div>

      <nav className="flex-1 space-y-0.5 p-2 overflow-y-auto">
        {groups.map(({ key, label }) => {
          const items = nav.filter((n) => n.group === key);
          if (items.length === 0) return null;
          return (
            <div key={key}>
              {label && (
                <p className="px-3 pt-4 pb-1 text-[10px] font-bold tracking-wider text-orange-400">
                  {label}
                </p>
              )}
              {items.map(({ href, label: itemLabel, emoji }) => {
                const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      'flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all',
                      active
                        ? 'bg-orange-200/70 text-orange-800 font-semibold shadow-sm'
                        : 'text-zinc-600 hover:bg-orange-100/60 hover:text-orange-700'
                    )}
                  >
                    <span className="text-base">{emoji}</span>
                    {itemLabel}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* 하단 */}
      <div className="border-t border-orange-200 p-3 bg-white/30">
        <button
          onClick={async () => {
            const supabase = createClient();
            await supabase.auth.signOut();
            window.location.href = '/login';
          }}
          className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-zinc-500 hover:bg-orange-100 hover:text-orange-700 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
