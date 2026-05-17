import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { WeeklyTable } from '@/components/weekly/WeeklyTable';
import type { Region, WeeklyReport } from '@/lib/types';

export const runtime = 'edge';

export default async function WeeklyPage() {
  const session = (await auth())!;
  const db = getDB();
  const isAdmin = session.user.role === 'admin';
  const where = isAdmin ? '' : 'WHERE w.region_id = ?';
  const bindings = isAdmin ? [] : [session.user.regionId];
  const [itemsRes, regionsRes] = await Promise.all([
    db.prepare(`
      SELECT w.*, r.code AS region_code, r.name_ar AS region_name_ar
        FROM weekly_reports w JOIN regions r ON r.id = w.region_id
        ${where} ORDER BY w.report_date DESC, w.id DESC
    `).bind(...bindings).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ORDER BY id`).all(),
  ]);
  const items   = (itemsRes.results   ?? []) as unknown as WeeklyReport[];
  const regions = (regionsRes.results ?? []) as unknown as Region[];

  return (
    <AppShell title="📅 التقارير الأسبوعية">
      <WeeklyTable initial={items} regions={regions} isAdmin={isAdmin} userRegionId={session.user.regionId} />
    </AppShell>
  );
}
