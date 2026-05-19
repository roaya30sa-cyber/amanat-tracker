// GET /api/dashboard/kpis  — returns aggregated KPIs respecting user's role/region/project.
import { NextResponse } from 'next/server';
import { getDB } from '@/lib/db';
import { requireSession, regionScope, projectScope, buildScopeClause, handleAccess } from '@/lib/access';
import { computeTaskStats, computeRiskStats } from '@/lib/formulas';

export const runtime = 'edge';

export async function GET() {
  return handleAccess(async () => {
    const session = await requireSession();
    const rScope = regionScope(session);
    const pScope = projectScope(session);
    const { where, binds } = buildScopeClause({
      regionScope: rScope,
      projectScope: pScope,
      // no prefix — used against plain tasks/risks tables
    });

    const db = getDB();
    // Regions are filtered by project too (a region belongs to one project)
    const regionsWhere = pScope === null ? '' : 'WHERE project_id = ? OR project_id IS NULL';
    const regionsBinds = pScope === null ? [] : [pScope];

    const [tRes, rRes, regsRes, pRes, activeProj] = await Promise.all([
      db.prepare(`SELECT status, completion_percent, region_id, project_id FROM tasks ${where}`).bind(...binds).all(),
      db.prepare(`SELECT risk_level, probability, impact, region_id, project_id FROM risks ${where}`).bind(...binds).all(),
      db.prepare(`SELECT id, code, name_ar FROM regions ${regionsWhere} ORDER BY id`).bind(...regionsBinds).all(),
      db.prepare(`SELECT id, code, name_ar FROM projects WHERE is_active = 1 ORDER BY id`).all(),
      pScope === null
        ? Promise.resolve(null)
        : db.prepare(`SELECT id, code, name_ar FROM projects WHERE id = ?`).bind(pScope).first(),
    ]);

    const tasks   = (tRes.results ?? []) as any[];
    const risks   = (rRes.results ?? []) as any[];
    const regions = (regsRes.results ?? []) as any[];
    const projects = (pRes.results ?? []) as any[];

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
      project_id: session.user.projectId,
      active_project_id: pScope,
      active_project: activeProj,
      task_stats: taskStats,
      risk_stats: riskStats,
      by_region: byRegion,
      projects,
      generated_at: Date.now(),
    });
  });
}
