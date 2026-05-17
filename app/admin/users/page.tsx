import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { redirect } from 'next/navigation';
import { UsersTable } from '@/components/admin/UsersTable';
import type { Region, User } from '@/lib/types';

export const runtime = 'edge';

export default async function UsersPage() {
  const session = (await auth())!;
  if (session.user.role !== 'admin') redirect('/dashboard');
  const db = getDB();
  const [usersRes, regionsRes] = await Promise.all([
    db.prepare(`SELECT * FROM users ORDER BY id`).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ORDER BY id`).all(),
  ]);
  const users   = (usersRes.results   ?? []) as unknown as User[];
  const regions = (regionsRes.results ?? []) as unknown as Region[];
  return (
    <AppShell title="👥 إدارة المستخدمين">
      <UsersTable initial={users} regions={regions} currentUserId={session.user.id} />
    </AppShell>
  );
}
