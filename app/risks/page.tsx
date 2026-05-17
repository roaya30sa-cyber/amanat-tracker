import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { RiskTable } from '@/components/risks/RiskTable';
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
  const where = isAdmin ? '' : 'WHERE risks.region_id = ?';
  const bindings = isAdmin ? [] : [session.user.regionId];

  const [risksRes, regionsRes] = await Promise.all([
    db.prepare(`
      SELECT risks.*, r.code AS region_code, r.name_ar AS region_name_ar
        FROM risks JOIN regions r ON r.id = risks.region_id
        ${where} ORDER BY risks.region_id, risks.risk_level DESC, risks.id
    `).bind(...bindings).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ORDER BY id`).all(),
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
