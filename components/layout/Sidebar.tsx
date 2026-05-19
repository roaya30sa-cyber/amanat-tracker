'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  LayoutDashboard, ClipboardList, AlertTriangle, CalendarDays, Users, Folder, LogOut, KeyRound, Building2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NavItem { href: string; label: string; icon: any; adminOnly?: boolean; }

const NAV: NavItem[] = [
  { href: '/dashboard',       label: 'لوحة التحكم',         icon: LayoutDashboard },
  { href: '/tasks',           label: 'المهام',              icon: ClipboardList },
  { href: '/risks',           label: 'سجل المخاطر',        icon: AlertTriangle },
  { href: '/weekly-reports',  label: 'التقارير الأسبوعية',  icon: CalendarDays },
  { href: '/admin/projects',  label: 'المشاريع',           icon: Building2, adminOnly: true },
  { href: '/admin/users',     label: 'المستخدمون',         icon: Users,     adminOnly: true },
  { href: '/admin/reference', label: 'البيانات المرجعية',  icon: Folder,    adminOnly: true },
];

interface SidebarProps {
  role: 'admin' | 'regional_manager' | 'viewer';
  userName: string;
  regionLabel: string;
  projectLabel: string;
}

export function Sidebar({ role, userName, regionLabel, projectLabel }: SidebarProps) {
  const pathname = usePathname();
  const visible = NAV.filter(n => !n.adminOnly || role === 'admin');

  return (
    <aside className="w-64 shrink-0 bg-brand-navy text-white flex flex-col sticky top-0 h-screen overflow-y-auto">
      <div className="p-5 border-b border-white/10 flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-teal rounded-xl flex items-center justify-center text-xl">🏛️</div>
        <div>
          <h2 className="font-bold text-sm leading-tight">أداة متابعة<br/>مشاريع الأمانة</h2>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {visible.map((item, i) => {
          const Icon = item.icon;
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          // Add section divider before admin items
          const showSection = item.adminOnly && visible[i - 1] && !visible[i - 1].adminOnly;
          return (
            <div key={item.href}>
              {showSection && (
                <div className="px-3 pt-4 pb-1 text-[11px] font-bold uppercase tracking-wider text-white/40">الإدارة</div>
              )}
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-semibold transition-colors',
                  active ? 'bg-brand-teal text-white' : 'text-white/85 hover:bg-white/10'
                )}
              >
                <Icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 bg-white/5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 bg-brand-teal rounded-full flex items-center justify-center font-bold text-sm">
            {userName.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-sm font-bold truncate">{userName}</div>
            <div className="text-[11px] text-white/60 truncate">{projectLabel} · {regionLabel}</div>
          </div>
        </div>
        <Link
          href="/account/password"
          className="w-full flex items-center justify-center gap-2 px-3 py-2 mb-2 rounded-lg bg-white/10 hover:bg-brand-teal text-xs font-semibold transition-colors"
        >
          <KeyRound className="h-3.5 w-3.5" />
          تغيير كلمة المرور
        </Link>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-brand-red text-xs font-semibold transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          تسجيل الخروج
        </button>
      </div>
    </aside>
  );
}
