// GET /api/dashboard/kpis  — returns aggregated KPIs respecting user's role/region.
import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, regionScope, handleAccess } from '@/lib/access';
import { computeTaskStats, computeRiskStats } from '@/lib/formulas';

export const runtime = 'edge';

export async function GET() {
  return handleAccess(async () => {
    const session = await requireSession();
    const scope = regionScope(session);
    const where = scope === null ? '' : 'WHERE region_id = ?';
    const binds = scope === null ? [] : [scope];
    const db = getDB();
    const [tRes, rRes, regsRes] = await Promise.all([
      db.prepare(`SELECT status, completion_percent, region_id FROM tasks ${where}`).bind(...binds).all(),
      db.prepare(`SELECT risk_level, probability, impact, region_id FROM risks ${where}`).bind(...binds).all(),
      db.prepare(`SELECT id, code, name_ar FROM regions ORDER BY id`).all(),
    ]);

    const tasks = (tRes.results ?? []) as any[];
    const risks = (rRes.results ?? []) as any[];
    const regions = (regsRes.results ?? []) as any[];

    const taskStats = computeTaskStats(tasks);
    const riskStats = computeRiskStats(risks);
    const byRegion = regions.map(r => ({
      ...r,
      task_stats: computeTaskStats(tasks.filter(t => t.region_id === r.id)),
      risk_stats: computeRiskStats(risks.filter(x => x.region_id === r.id)),
    }));

    return NextResponse.json({
      role: session.user.role,
      region_id: session.user.regionId,
      task_stats: taskStats,
      risk_stats: riskStats,
      by_region: byRegion,
      generated_at: Date.now(),
    });
  });
}
