import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { cookies } from 'next/headers';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { CompletionBarChart, StatusDoughnut } from '@/components/dashboard/Charts';
import { computeTaskStats, computeRiskStats, performanceLabel, performanceEval } from '@/lib/formulas';
import { PROJECT_COOKIE } from '@/lib/access';
import { ClipboardList, CheckCircle2, RefreshCw, AlertTriangle, TrendingUp, PauseCircle, Construction, Clock, Megaphone, Inbox } from 'lucide-react';
import Link from 'next/link';
import { formatDateTimeAr } from '@/lib/utils';

export const runtime = 'edge';

export default async function DashboardPage() {
  const session = (await auth())!;
  const db = getDB();
  const isAdmin   = session.user.role === 'admin';
  const regionId  = session.user.regionId;

  // Resolve active project_id: admins → cookie (null = all); others → their assigned project.
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

  // Compose WHERE clause for tasks/risks queries.
  const conds: string[] = [];
  const binds: any[] = [];
  if (!isAdmin && regionId) { conds.push('region_id = ?'); binds.push(regionId); }
  if (activeProjectId)      { conds.push('project_id = ?'); binds.push(activeProjectId); }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';

  // Regions list is also project-scoped when a project is selected.
  const regionsWhere = activeProjectId ? 'WHERE project_id = ? OR project_id IS NULL' : '';
  const regionsBinds = activeProjectId ? [activeProjectId] : [];

  // Obstacles scoping is similar — for non-admins, restrict to "involving me".
  const obsConds: string[] = [];
  const obsBinds: any[] = [];
  if (activeProjectId) { obsConds.push('o.project_id = ?'); obsBinds.push(activeProjectId); }
  if (!isAdmin) {
    obsConds.push('(o.from_user_id = ? OR o.to_user_id = ?)');
    obsBinds.push(session.user.id, session.user.id);
  }
  const obsWhere = obsConds.length ? `WHERE ${obsConds.join(' AND ')}` : '';

  // Circulars KPI scoping. Admin sees all in scope; managers see only theirs.
  const circConds: string[] = ["c.status = 'active'"];
  const circBinds: any[] = [];
  if (activeProjectId) { circConds.push('(c.project_id = ? OR c.project_id IS NULL)'); circBinds.push(activeProjectId); }
  if (!isAdmin) {
    circConds.push(`EXISTS(SELECT 1 FROM circular_recipients WHERE circular_id = c.id AND user_id = ?)`);
    circBinds.push(session.user.id);
  }
  const circWhere = `WHERE ${circConds.join(' AND ')}`;

  const [tasksRes, risksRes, regionsRes, activeProj, obsRes, circRes] = await Promise.all([
    db.prepare(`SELECT region_id, status, completion_percent, deadline, project_id FROM tasks ${where}`).bind(...binds).all(),
    db.prepare(`SELECT region_id, probability, impact, risk_level, project_id FROM risks ${where}`).bind(...binds).all(),
    db.prepare(`SELECT id, code, name_ar, color_hex FROM regions ${regionsWhere} ORDER BY id`).bind(...regionsBinds).all(),
    activeProjectId
      ? db.prepare(`SELECT id, name_ar FROM projects WHERE id = ?`).bind(activeProjectId).first<{ id: number; name_ar: string }>()
      : Promise.resolve(null),
    db.prepare(`
      SELECT o.id, o.statement, o.status, o.approved_due_date, o.proposed_due_date, o.created_at,
             o.from_user_id, o.to_user_id,
             fu.username AS from_user_name, tu.username AS to_user_name
        FROM obstacles o
        JOIN users fu ON fu.id = o.from_user_id
        JOIN users tu ON tu.id = o.to_user_id
        ${obsWhere}
        ORDER BY o.created_at DESC
        LIMIT 50
    `).bind(...obsBinds).all(),
    db.prepare(`
      SELECT c.id, c.title, c.ack_deadline, c.created_by,
             (SELECT COUNT(*) FROM circular_recipients WHERE circular_id = c.id) AS total_recipients,
             (SELECT COUNT(*) FROM circular_recipients WHERE circular_id = c.id AND acknowledged_at IS NOT NULL) AS acknowledged_count,
             (SELECT acknowledged_at FROM circular_recipients WHERE circular_id = c.id AND user_id = ?) AS my_acknowledged_at,
             EXISTS(SELECT 1 FROM circular_recipients WHERE circular_id = c.id AND user_id = ?) AS is_my_recipient
        FROM circulars c
        ${circWhere}
    `).bind(session.user.id, session.user.id, ...circBinds).all(),
  ]);

  const tasks     = (tasksRes.results   ?? []) as any[];
  const risks     = (risksRes.results   ?? []) as any[];
  const regions   = (regionsRes.results ?? []) as any[];
  const obstacles = (obsRes.results     ?? []) as any[];
  const circulars = (circRes.results    ?? []) as any[];

  // Compute circulars KPIs
  function isCircularOverdue(c: any, mine: boolean): boolean {
    if (!c.ack_deadline) return false;
    const t = Date.parse(c.ack_deadline + 'T23:59:59Z');
    if (!Number.isFinite(t) || t >= Date.now()) return false;
    return mine ? (c.is_my_recipient && !c.my_acknowledged_at) : (c.acknowledged_count < c.total_recipients);
  }
  const circMyPending  = circulars.filter(c => c.is_my_recipient && !c.my_acknowledged_at).length;
  const circMyOverdue  = circulars.filter(c => isCircularOverdue(c, true)).length;
  const circSentPending = circulars.filter(c => c.created_by === session.user.id && c.acknowledged_count < c.total_recipients).length;

  // Compute obstacle KPIs
  const todayMs = Date.now();
  function isOverdue(o: any): boolean {
    if (!o.approved_due_date) return false;
    if (o.status === 'resolved' || o.status === 'rejected') return false;
    const t = Date.parse(o.approved_due_date + 'T23:59:59Z');
    return Number.isFinite(t) && t < todayMs;
  }
  const obsPending  = obstacles.filter(o => o.status === 'pending_approval').length;
  const obsActive   = obstacles.filter(o => o.status === 'approved' || o.status === 'in_progress').length;
  const obsOverdue  = obstacles.filter(isOverdue).length;
  const obsResolved = obstacles.filter(o => o.status === 'resolved').length;
  const recentObstacles = obstacles.slice(0, 6);

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
    const phRes = await db.prepare(`SELECT phase, completion_percent FROM tasks ${where}`).bind(...binds).all();
    const phTasks = (phRes.results ?? []) as any[];
    const colors = ['#1F3864', '#2E8B8B', '#F39C12', '#7D3C98'];
    chartData = phasesAr.map((p, i) => {
      const pt = phTasks.filter(t => t.phase === p);
      const avg = pt.length ? Math.round(pt.reduce((s,t)=>s+(t.completion_percent ?? 0),0)/pt.length) : 0;
      return { label: p, value: avg, color: colors[i] };
    });
  }

  const projectBanner = activeProj
    ? `🏢 ${activeProj.name_ar}`
    : (isAdmin ? '🌐 جميع المشاريع' : '');

  return (
    <AppShell title="📊 لوحة التحكم">
      {projectBanner && (
        <div className="mb-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-soft text-brand-navy text-sm font-bold">
          {projectBanner}
        </div>
      )}

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

      {/* Obstacles widget */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-7">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-brand-navy flex items-center gap-2"><Construction className="h-5 w-5" /> العوائق التشغيلية</h3>
          <Link href="/obstacles" className="text-sm text-brand-teal hover:underline">عرض الكل →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
          <KpiCard label="بانتظار الاعتماد" value={obsPending}  icon={Clock}        color="gold" />
          <KpiCard label="قيد التنفيذ"      value={obsActive}   icon={RefreshCw}    color="navy" />
          <KpiCard label="متأخرة"            value={obsOverdue}  icon={AlertTriangle} color="red" />
          <KpiCard label="تم حلها"           value={obsResolved} icon={CheckCircle2} color="green" />
        </div>
        {recentObstacles.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-brand-soft text-brand-navy">
                <tr className="text-right">
                  <th className="p-2 font-bold">البيان</th>
                  <th className="p-2 font-bold">من → إلى</th>
                  <th className="p-2 font-bold">الحالة</th>
                  <th className="p-2 font-bold">الاستحقاق</th>
                  <th className="p-2 font-bold">المنشأ</th>
                </tr>
              </thead>
              <tbody>
                {recentObstacles.map(o => {
                  const overdue = isOverdue(o);
                  const due = o.approved_due_date ?? (o.proposed_due_date ? `مقترح: ${o.proposed_due_date}` : '—');
                  const created = formatDateTimeAr(o.created_at);
                  return (
                    <tr key={o.id} className={`border-b border-slate-100 ${overdue ? 'bg-red-50/60' : ''}`}>
                      <td className="p-2 max-w-[260px] truncate">{o.statement}</td>
                      <td className="p-2 text-xs">{o.from_user_name} → {o.to_user_name}</td>
                      <td className="p-2 text-xs">
                        {overdue
                          ? <span className="text-brand-red font-bold">⚠ متأخر</span>
                          : ({
                              pending_approval: 'بانتظار الاعتماد',
                              approved:         'معتمد',
                              in_progress:      'قيد التنفيذ',
                              resolved:         'تم الحل',
                              rejected:         'مرفوض',
                            } as Record<string,string>)[o.status]}
                      </td>
                      <td className="p-2 text-xs whitespace-nowrap">{due}</td>
                      <td className="p-2 text-xs text-muted-foreground whitespace-nowrap">{created}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Circulars widget */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 mb-7">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h3 className="text-lg font-bold text-brand-navy flex items-center gap-2"><Megaphone className="h-5 w-5" /> التعاميم</h3>
          <Link href="/circulars" className="text-sm text-brand-teal hover:underline">عرض الكل →</Link>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {isAdmin && (
            <KpiCard label="تعاميم بانتظار التأكيد (مُرسَلة)" value={circSentPending} icon={Megaphone}    color="gold" />
          )}
          <KpiCard label="بانتظار تأكيدي"  value={circMyPending} icon={Inbox}         color="navy" />
          <KpiCard label="متأخرة عن التأكيد" value={circMyOverdue} icon={AlertTriangle} color="red"  />
        </div>
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
          <li>⬡ <b>تتبع العوائق:</b> من صفحة "العوائق التشغيلية" — أرسل عائقاً للمدير، وسيعتمد المدير الإطار الزمني.</li>
          {isAdmin && <li>⬡ <b>تبديل المشروع:</b> من القائمة المنسدلة "المشروع" في أعلى الصفحة. اختر "جميع المشاريع" لرؤية البيانات المجمّعة.</li>}
          <li>⬡ جميع الإحصائيات تتحدث فوراً عند إضافة/تعديل أي بيان</li>
        </ul>
      </div>
    </AppShell>
  );
}
