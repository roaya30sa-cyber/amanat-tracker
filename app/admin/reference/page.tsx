import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { getDB } from '@/lib/db';
import { redirect } from 'next/navigation';
import { Badge } from '@/components/ui/badge';

export const runtime = 'edge';

const PHASES = ['الأعمال الإدارية', 'المراجعة والتقارير', 'الزيارات الميدانية', 'حملات التواصل ونقل المعرفة'];
const RISK_CATEGORIES = ['إداري/قانوني','موارد بشرية','بيئي/لوجستي','مالي','لوجستي','إدارة مشاريع','تشغيلي','تقني','مجتمعي'];
const JOB_TITLES = ['مدير مشروع','مشرف مشروع','مراجع','مدقق','محلل بيانات','مراقب ميداني','قائد حملات تواصل'];

export default async function ReferencePage() {
  const session = (await auth())!;
  if (session.user.role !== 'admin') redirect('/dashboard');
  const db = getDB();
  const members = await db.prepare(`SELECT * FROM team_members ORDER BY id`).all();

  return (
    <AppShell title="📂 البيانات المرجعية">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-lg font-bold text-brand-navy mb-4">👨‍💼 فريق العمل ({(members.results ?? []).length})</h3>
          <div className="overflow-y-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-brand-soft text-brand-navy sticky top-0">
                <tr className="text-right">
                  <th className="p-3 font-bold">الاسم</th>
                  <th className="p-3 font-bold">المسمى الوظيفي</th>
                </tr>
              </thead>
              <tbody>
                {(members.results as any[] ?? []).map(m => (
                  <tr key={m.id} className="border-b border-slate-100">
                    <td className="p-3 font-semibold">{m.full_name}</td>
                    <td className="p-3 text-muted-foreground">{m.job_title ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-brand-navy mb-3">📋 المراحل</h3>
            <div className="flex flex-wrap gap-2">
              {PHASES.map(p => <Badge key={p} variant="info">{p}</Badge>)}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-brand-navy mb-3">⚠️ فئات المخاطر</h3>
            <div className="flex flex-wrap gap-2">
              {RISK_CATEGORIES.map(c => <Badge key={c} variant="warning">{c}</Badge>)}
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-lg font-bold text-brand-navy mb-3">💼 المسميات الوظيفية</h3>
            <div className="flex flex-wrap gap-2">
              {JOB_TITLES.map(j => <Badge key={j} variant="secondary">{j}</Badge>)}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
