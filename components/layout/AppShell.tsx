import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { getDB } from '@/lib/db';

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

  const updatedAt = new Date().toLocaleString('ar-SA', { dateStyle: 'medium', timeStyle: 'short' });

  return (
    <div className="flex min-h-screen">
      <Sidebar
        role={session.user.role}
        userName={session.user.name ?? session.user.username ?? '—'}
        regionLabel={regionLabel}
      />
      <main className="flex-1 p-6 lg:p-8 overflow-x-hidden">
        <header className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <h1 className="text-2xl lg:text-3xl font-bold text-brand-navy">{title}</h1>
          <div className="text-sm text-muted-foreground">
            آخر تحديث: <span className="font-semibold text-brand-navy">{updatedAt}</span>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}
