import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { TaskTable } from '@/components/tasks/TaskTable';
import type { Region, Task } from '@/lib/types';

export const runtime = 'edge';

export default async function TasksPage() {
  const session = (await auth())!;
  const db = getDB();

  const isAdmin = session.user.role === 'admin';
  const where = isAdmin ? '' : 'WHERE t.region_id = ?';
  const bindings = isAdmin ? [] : [session.user.regionId];

  const [tasksRes, regionsRes] = await Promise.all([
    db.prepare(`
      SELECT t.*, r.code AS region_code, r.name_ar AS region_name_ar
        FROM tasks t
        JOIN regions r ON r.id = t.region_id
        ${where}
       ORDER BY t.region_id, t.id
    `).bind(...bindings).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ORDER BY id`).all(),
  ]);

  const tasks   = (tasksRes.results   ?? []) as unknown as Task[];
  const regions = (regionsRes.results ?? []) as unknown as Region[];

  return (
    <AppShell title="📋 إدارة المهام">
      <TaskTable initial={tasks} regions={regions} isAdmin={isAdmin} userRegionId={session.user.regionId} />
    </AppShell>
  );
}
