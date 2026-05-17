'use client';

import { useState } from 'react';
import { WeeklyReport, Region, Priority } from '@/lib/types';
import { PRIORITY_AR } from '@/lib/formulas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Trash2, Plus, CalendarDays, AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { WeeklyModal } from './WeeklyModal';
import { KpiCard } from '@/components/dashboard/KpiCard';

interface Props { initial: WeeklyReport[]; regions: Region[]; isAdmin: boolean; userRegionId: number | null; }

const PRIORITY_BADGE: Record<Priority, 'destructive' | 'warning' | 'secondary'> = {
  high: 'destructive', medium: 'warning', low: 'secondary',
};

export function WeeklyTable({ initial, regions, isAdmin, userRegionId }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<WeeklyReport[]>(initial);
  const [filterRegion, setFilterRegion] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<WeeklyReport | null>(null);

  const filtered = items.filter(w => !filterRegion || w.region_code === filterRegion);
  const high = items.filter(w => w.priority === 'high').length;
  const medium = items.filter(w => w.priority === 'medium').length;
  const low = items.filter(w => w.priority === 'low').length;

  async function deleteItem(id: number) {
    if (!confirm('حذف هذا التقرير؟')) return;
    const res = await fetch(`/api/weekly-reports/${id}`, { method: 'DELETE' });
    if (res.ok) { setItems(prev => prev.filter(w => w.id !== id)); toast({ title: 'تم الحذف' }); }
    else toast({ title: 'فشل الحذف', variant: 'destructive' });
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="إجمالي العوائق"   value={items.length} icon={CalendarDays} color="navy" />
        <KpiCard label="🔴 عالي الأولوية"  value={high}         icon={AlertTriangle} color="red" />
        <KpiCard label="🟡 متوسط الأولوية" value={medium}       icon={AlertCircle}   color="gold" />
        <KpiCard label="🟢 منخفض الأولوية" value={low}          icon={Info}          color="green" />
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-5">
        {isAdmin && (
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="h-10 px-3 border border-input rounded-lg bg-white text-sm">
            <option value="">كل المناطق</option>
            {regions.map(r => <option key={r.code} value={r.code}>{r.name_ar}</option>)}
          </select>
        )}
        <Button onClick={() => { setEditing(null); setModalOpen(true); }} className="mr-auto">
          <Plus className="h-4 w-4" /> إضافة عائق جديد
        </Button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-soft text-brand-navy">
              <tr className="text-right">
                <th className="p-3 font-bold">التاريخ</th>
                {isAdmin && <th className="p-3 font-bold">المنطقة</th>}
                <th className="p-3 font-bold">المهمة الحالية</th>
                <th className="p-3 font-bold">الأولوية</th>
                <th className="p-3 font-bold">معوقات التنفيذ</th>
                <th className="p-3 font-bold">خطة الحل</th>
                <th className="p-3 font-bold">الموارد المطلوبة</th>
                <th className="p-3 font-bold">تاريخ المتابعة</th>
                <th className="p-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">لا توجد تقارير</td></tr>}
              {filtered.map(w => (
                <tr key={w.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-3 whitespace-nowrap">{w.report_date}</td>
                  {isAdmin && <td className="p-3"><Badge variant="secondary">{w.region_name_ar}</Badge></td>}
                  <td className="p-3 font-semibold">{w.current_task}</td>
                  <td className="p-3">{w.priority && <Badge variant={PRIORITY_BADGE[w.priority]}>{PRIORITY_AR[w.priority]}</Badge>}</td>
                  <td className="p-3 max-w-[260px] text-xs">{w.obstacles}</td>
                  <td className="p-3 max-w-[260px] text-xs">{w.solution_plan}</td>
                  <td className="p-3 max-w-[200px] text-xs">{w.required_resources}</td>
                  <td className="p-3 whitespace-nowrap">{w.follow_up_date ?? '-'}</td>
                  <td className="p-3">
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(w); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" onClick={() => deleteItem(w.id)}><Trash2 className="h-4 w-4 text-brand-red" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <WeeklyModal
        open={modalOpen} onOpenChange={setModalOpen}
        item={editing} regions={regions} isAdmin={isAdmin} userRegionId={userRegionId}
        onSaved={w => setItems(prev => editing ? prev.map(x => x.id === w.id ? w : x) : [...prev, w])}
      />
    </>
  );
}
