import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { redirect } from 'next/navigation';
import { UsersTable } from '@/components/admin/UsersTable';
import type { Region, User, Project } from '@/lib/types';

export const runtime = 'edge';

export default async function UsersPage() {
  const session = (await auth())!;
  if (session.user.role !== 'admin') redirect('/dashboard');
  const db = getDB();
  const [usersRes, regionsRes, projectsRes] = await Promise.all([
    db.prepare(`SELECT * FROM users ORDER BY id`).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex, project_id FROM regions ORDER BY id`).all(),
    db.prepare(`SELECT * FROM projects ORDER BY id`).all(),
  ]);
  const users    = (usersRes.results    ?? []) as unknown as User[];
  const regions  = (regionsRes.results  ?? []) as unknown as Region[];
  const projects = (projectsRes.results ?? []) as unknown as Project[];
  return (
    <AppShell title="👥 إدارة المستخدمين">
      <UsersTable initial={users} regions={regions} projects={projects} currentUserId={session.user.id} />
    </AppShell>
  );
}
