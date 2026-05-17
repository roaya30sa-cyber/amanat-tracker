import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { CompletionBarChart, StatusDoughnut } from '@/components/dashboard/Charts';
import { computeTaskStats, computeRiskStats, performanceLabel, performanceEval } from '@/lib/formulas';
import { ClipboardList, CheckCircle2, RefreshCw, AlertTriangle, TrendingUp, PauseCircle } from 'lucide-react';

export const runtime = 'edge';

export default async function DashboardPage() {
  const session = (await auth())!;
  const db = getDB();
  const isAdmin   = session.user.role === 'admin';
  const regionId  = session.user.regionId;
  const regionFilter = isAdmin ? '' : 'WHERE region_id = ?';
  const bindings: any[] = isAdmin ? [] : [regionId];

  // Pull what we need in parallel for the edge
  const [tasksRes, risksRes, regionsRes] = await Promise.all([
    db.prepare(`SELECT region_id, status, completion_percent, deadline FROM tasks ${regionFilter}`).bind(...bindings).all(),
    db.prepare(`SELECT region_id, probability, impact, risk_level FROM risks ${regionFilter}`).bind(...bindings).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ORDER BY id`).all(),
  ]);

  const tasks  = (tasksRes.results  ?? []) as any[];
  const risks  = (risksRes.results  ?? []) as any[];
  const regions = (regionsRes.results ?? []) as any[];

  const taskStats = computeTaskStats(tasks);
  const riskStats = computeRiskStats(risks);

  // Chart data
  const phasesAr = ['الأعمال الإدارية', 'المراجعة والتقارير', 'الزيارات الميدانية', 'حملات التواصل ونقل المعرفة'];
  let chartData: { label: string; value: number; color: string }[];
  let chartTitle: string;

  if (isAdmin) {
    chartTitle = 'نسبة الإنجاز حسب المنطقة';
    chartData = regions.map(r => {
      const rt = tasks.filter(t => t.region_id === r.id);
      const avg = rt.length ? Math.round(rt.reduce((s,t)=>s+(t.completion_percent ?? 0),0)/rt.length) : 0;
      return { label: r.name_ar, value: avg, color: r.color_hex ?? '#1F3864' };
    });
  } else {
    chartTitle = 'نسبة الإنجاز حسب المرحلة';
    // We need to fetch phase column too — refetch quickly
    const phRes = await db.prepare(`SELECT phase, completion_percent FROM tasks ${regionFilter}`).bind(...bindings).all();
    const phTasks = (phRes.results ?? []) as any[];
    const colors = ['#1F3864', '#2E8B8B', '#F39C12', '#7D3C98'];
    chartData = phasesAr.map((p, i) => {
      const pt = phTasks.filter(t => t.phase === p);
      const avg = pt.length ? Math.round(pt.reduce((s,t)=>s+(t.completion_percent ?? 0),0)/pt.length) : 0;
      return { label: p, value: avg, color: colors[i] };
    });
  }

  return (
    <AppShell title="📊 لوحة التحكم">
      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-7">
        <KpiCard label="إجمالي المهام"     value={taskStats.total}       icon={ClipboardList} color="navy" />
        <KpiCard label="مكتملة"            value={taskStats.completed}   icon={CheckCircle2}   color="green" />
        <KpiCard label="قيد التنفيذ"       value={taskStats.in_progress} icon={RefreshCw}      color="gold" />
        <KpiCard label="لم تبدأ"           value={taskStats.not_started} icon={PauseCircle}    color="red" />
        <KpiCard label="متوسط الإنجاز"     value={`${Math.round(taskStats.avg_completion_pct)}%`} icon={TrendingUp} color="purple" />
        <KpiCard label="مخاطر حرجة + عالية" value={riskStats.critical + riskStats.high} icon={AlertTriangle} color="red" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-7">
        <CompletionBarChart data={chartData} title={chartTitle} />
        <StatusDoughnut completed={taskStats.completed} inProgress={taskStats.in_progress} notStarted={taskStats.not_started} />
      </div>

      {/* Regional breakdown — admin only */}
      {isAdmin && (
        <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-7">
          <h3 className="text-lg font-bold text-brand-navy mb-4">🏗️ التحليل الإقليمي التفصيلي</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-soft text-brand-navy">
                <tr className="text-right">
                  <th className="p-3 font-bold">المنطقة</th>
                  <th className="p-3 font-bold">إجمالي المهام</th>
                  <th className="p-3 font-bold">مكتملة</th>
                  <th className="p-3 font-bold">قيد التنفيذ</th>
                  <th className="p-3 font-bold">لم تبدأ</th>
                  <th className="p-3 font-bold">متوسط الإنجاز</th>
                  <th className="p-3 font-bold">تصنيف الأداء</th>
                  <th className="p-3 font-bold">المخاطر المرتبطة</th>
                  <th className="p-3 font-bold">التقييم</th>
                </tr>
              </thead>
              <tbody>
                {regions.map(r => {
                  const rt = tasks.filter(t => t.region_id === r.id);
                  const rk = risks.filter(x => x.region_id === r.id);
                  const stats = computeTaskStats(rt);
                  const perf = performanceLabel(stats.avg_completion_01);
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="p-3 font-bold">🏗 {r.name_ar}</td>
                      <td className="p-3">{stats.total}</td>
                      <td className="p-3">{stats.completed}</td>
                      <td className="p-3">{stats.in_progress}</td>
                      <td className="p-3">{stats.not_started}</td>
                      <td className="p-3 font-semibold">{Math.round(stats.avg_completion_pct)}%</td>
                      <td className="p-3"><span className={`px-3 py-1 rounded-full text-xs font-bold ${perf.className}`}>{perf.txt}</span></td>
                      <td className="p-3">{rk.length}</td>
                      <td className="p-3 text-muted-foreground">{performanceEval(stats.avg_completion_01)}</td>
                    </tr>
                  );
                })}
                {(() => {
                  const totalPerf = performanceLabel(taskStats.avg_completion_01);
                  return (
                    <tr className="bg-blue-50 font-bold">
                      <td className="p-3">📊 الإجمالي الكلي</td>
                      <td className="p-3">{taskStats.total}</td>
                      <td className="p-3">{taskStats.completed}</td>
                      <td className="p-3">{taskStats.in_progress}</td>
                      <td className="p-3">{taskStats.not_started}</td>
                      <td className="p-3">{Math.round(taskStats.avg_completion_pct)}%</td>
                      <td className="p-3"><span className={`px-3 py-1 rounded-full text-xs font-bold ${totalPerf.className}`}>{totalPerf.txt}</span></td>
                      <td className="p-3">{riskStats.total}</td>
                      <td className="p-3">{performanceEval(taskStats.avg_completion_01)}</td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Guide */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-lg font-bold text-brand-navy mb-3">📘 دليل سريع</h3>
        <ul className="space-y-2 text-sm text-muted-foreground leading-loose">
          <li>⬡ <b>إضافة مهمة:</b> من صفحة "المهام" اضغط "+ إضافة مهمة جديدة"</li>
          <li>⬡ <b>إضافة خطر:</b> من صفحة "سجل المخاطر" — مستوى الخطر يُحسب تلقائياً (الاحتمالية × التأثير)</li>
          <li>⬡ <b>تتبع العوائق:</b> من صفحة "التقارير الأسبوعية"</li>
          <li>⬡ جميع الإحصائيات تتحدث فوراً عند إضافة/تعديل أي بيان</li>
        </ul>
      </div>
    </AppShell>
  );
}
