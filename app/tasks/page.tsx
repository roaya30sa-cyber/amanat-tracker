import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { cookies } from 'next/headers';
import { TaskTable } from '@/components/tasks/TaskTable';
import { PROJECT_COOKIE } from '@/lib/access';
import type { Region, Task } from '@/lib/types';

export const runtime = 'edge';

export default async function TasksPage() {
  const session = (await auth())!;
  const db = getDB();

  const isAdmin  = session.user.role === 'admin';
  let activeProjectId: number | null = null;
  if (isAdmin) {
    const cv = cookies().get(PROJECT_COOKIE)?.value;
    if (cv && cv !== 'all') {
      const n = parseInt(cv, 10);
      if (Number.isFinite(n) && n > 0) activeProjectId = n;
    }
  } else {
    activeProjectId = session.user.projectId;
  }

  const conds: string[] = [];
  const binds: any[] = [];
  if (!isAdmin && session.user.regionId) { conds.push('t.region_id = ?');  binds.push(session.user.regionId); }
  if (activeProjectId)                   { conds.push('t.project_id = ?'); binds.push(activeProjectId); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const regionsWhere = activeProjectId ? 'WHERE project_id = ? OR project_id IS NULL' : '';
  const regionsBinds = activeProjectId ? [activeProjectId] : [];

  const [tasksRes, regionsRes] = await Promise.all([
    db.prepare(`
      SELECT t.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM tasks t
        JOIN regions  r ON r.id = t.region_id
        LEFT JOIN projects p ON p.id = t.project_id
        ${where}
       ORDER BY t.region_id, t.id
    `).bind(...binds).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ${regionsWhere} ORDER BY id`).bind(...regionsBinds).all(),
  ]);

  const tasks   = (tasksRes.results   ?? []) as unknown as Task[];
  const regions = (regionsRes.results ?? []) as unknown as Region[];

  return (
    <AppShell title="📋 إدارة المهام">
      <TaskTable initial={tasks} regions={regions} isAdmin={isAdmin} userRegionId={session.user.regionId} />
    </AppShell>
  );
}
