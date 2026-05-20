import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Sidebar } from './Sidebar';
import { ProjectSwitcher } from './ProjectSwitcher';
import { NotificationBell } from './NotificationBell';
import { getDB } from '@/lib/db';
import { PROJECT_COOKIE } from '@/lib/access';
import { formatDateTimeAr } from '@/lib/utils';

interface AppShellProps {
  children: React.ReactNode;
  title: string;
}

export async function AppShell({ children, title }: AppShellProps) {
  const session = await auth();
  if (!session?.user) redirect('/login');

  let regionLabel = 'جميع المناطق';
  if (session.user.regionId) {
    try {
      const db = getDB();
      const r = await db.prepare('SELECT name_ar FROM regions WHERE id = ?').bind(session.user.regionId).first<{ name_ar: string }>();
      if (r) regionLabel = r.name_ar;
    } catch {}
  }

  // Resolve the project label/active id for the header.
  let projectLabel: string | null = null;
  let activeProjectId: number | null = null;

  if (session.user.role === 'admin') {
    const cookieVal = cookies().get(PROJECT_COOKIE)?.value;
    if (cookieVal && cookieVal !== 'all') {
      const parsed = parseInt(cookieVal, 10);
      if (Number.isFinite(parsed) && parsed > 0) activeProjectId = parsed;
    }
  } else if (session.user.projectId) {
    activeProjectId = session.user.projectId;
    projectLabel = session.user.projectNameAr ?? null;
  }

  if (activeProjectId && !projectLabel) {
    try {
      const db = getDB();
      const p = await db.prepare('SELECT name_ar FROM projects WHERE id = ?').bind(activeProjectId).first<{ name_ar: string }>();
      if (p) projectLabel = p.name_ar;
    } catch {}
  }

  const updatedAt = formatDateTimeAr(new Date());

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={session.user.role}
        userName={session.user.name ?? session.user.username ?? '—'}
        regionLabel={regionLabel}
        projectLabel={projectLabel ?? (session.user.role === 'admin' ? 'جميع المشاريع' : '—')}
      />
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        {/* Print-only header — visible only when window.print() runs */}
        <div className="hidden print:flex print:items-center print:justify-between print:mb-4 print:pb-3 print:border-b print:border-slate-300">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="HLB" className="h-12 w-auto" />
          <div className="text-right">
            <div className="font-bold text-brand-navy">{title}</div>
            <div className="text-xs text-muted-foreground">{updatedAt}</div>
            {projectLabel && projectLabel !== 'جميع المشاريع' && projectLabel !== '—' && (
              <div className="text-xs text-muted-foreground">المشروع: {projectLabel}</div>
            )}
          </div>
        </div>

        <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl lg:text-3xl font-bold text-brand-navy">{title}</h1>
          <div className="flex items-center gap-4 flex-wrap">
            {session.user.role === 'admin' && (
              <ProjectSwitcher activeProjectId={activeProjectId} />
            )}
            <NotificationBell />
            <div className="text-sm text-muted-foreground">
              آخر تحديث: <span className="font-semibold text-brand-navy">{updatedAt}</span>
            </div>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
