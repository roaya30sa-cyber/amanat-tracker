import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { redirect } from 'next/navigation';
import { ProjectsTable } from '@/components/admin/ProjectsTable';
import type { Project } from '@/lib/types';

export const runtime = 'edge';

export default async function ProjectsPage() {
  const session = (await auth())!;
  if (session.user.role !== 'admin') redirect('/dashboard');
  const db = getDB();

  // Fetch projects + counts of tasks/risks per project
  const rows = await db.prepare(`
    SELECT p.*,
           (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id) AS task_count,
           (SELECT COUNT(*) FROM risks r WHERE r.project_id = p.id) AS risk_count,
           (SELECT COUNT(*) FROM users u WHERE u.project_id = p.id) AS user_count
      FROM projects p
      ORDER BY p.id
  `).all();

  const projects = (rows.results ?? []) as unknown as (Project & {
    task_count: number; risk_count: number; user_count: number;
  })[];

  return (
    <AppShell title="🏢 إدارة المشاريع">
      <ProjectsTable initial={projects} />
    </AppShell>
  );
}
