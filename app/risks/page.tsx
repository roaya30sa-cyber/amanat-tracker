import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { cookies } from 'next/headers';
import { RiskTable } from '@/components/risks/RiskTable';
import { PROJECT_COOKIE } from '@/lib/access';
import type { Region, Risk } from '@/lib/types';

export const runtime = 'edge';

const CATEGORIES = [
  'إداري/قانوني', 'موارد بشرية', 'بيئي/لوجستي', 'مالي', 'لوجستي',
  'إدارة مشاريع', 'تشغيلي', 'تقني', 'مجتمعي',
];

export default async function RisksPage() {
  const session = (await auth())!;
  const db = getDB();
  const isAdmin = session.user.role === 'admin';

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
  if (!isAdmin && session.user.regionId) { conds.push('risks.region_id = ?');  binds.push(session.user.regionId); }
  if (activeProjectId)                   { conds.push('risks.project_id = ?'); binds.push(activeProjectId); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  const regionsWhere = activeProjectId ? 'WHERE project_id = ? OR project_id IS NULL' : '';
  const regionsBinds = activeProjectId ? [activeProjectId] : [];

  const [risksRes, regionsRes] = await Promise.all([
    db.prepare(`
      SELECT risks.*, r.code AS region_code, r.name_ar AS region_name_ar,
             p.name_ar AS project_name_ar
        FROM risks
        JOIN regions r ON r.id = risks.region_id
        LEFT JOIN projects p ON p.id = risks.project_id
        ${where}
        ORDER BY risks.region_id, risks.risk_level DESC, risks.id
    `).bind(...binds).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ${regionsWhere} ORDER BY id`).bind(...regionsBinds).all(),
  ]);
  const risks   = (risksRes.results   ?? []) as unknown as Risk[];
  const regions = (regionsRes.results ?? []) as unknown as Region[];

  return (
    <AppShell title="⚠️ سجل المخاطر">
      <RiskTable initial={risks} regions={regions} categories={CATEGORIES}
        isAdmin={isAdmin} userRegionId={session.user.regionId} />
    </AppShell>
  );
}
