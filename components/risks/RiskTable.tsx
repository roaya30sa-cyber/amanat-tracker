'use client';

import { useState } from 'react';
import { Risk, Region } from '@/lib/types';
import { riskBucket, computeRiskStats, RISK_STATUS_AR, toCSV } from '@/lib/formulas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Trash2, Plus, Download, Printer } from 'lucide-react';
import { RiskModal } from './RiskModal';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { BarChart3, AlertOctagon, AlertTriangle, AlertCircle, Info, TrendingUp } from 'lucide-react';

interface Props {
  initial: Risk[];
  regions: Region[];
  categories: string[];
  isAdmin: boolean;
  userRegionId: number | null;
}

export function RiskTable({ initial, regions, categories, isAdmin, userRegionId }: Props) {
  const { toast } = useToast();
  const [risks, setRisks] = useState<Risk[]>(initial);
  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Risk | null>(null);

  const stats = computeRiskStats(risks);

  const filtered = risks.filter(r => {
    if (filterRegion && r.region_code !== filterRegion) return false;
    if (filterCategory && r.category !== filterCategory) return false;
    if (filterStatus && r.status !== filterStatus) return false;
    if (search && !r.risk_description.includes(search)) return false;
    return true;
  });

  async function deleteRisk(id: number) {
    if (!confirm('حذف هذا الخطر؟')) return;
    const res = await fetch(`/api/risks/${id}`, { method: 'DELETE' });
    if (res.ok) { setRisks(prev => prev.filter(r => r.id !== id)); toast({ title: 'تم الحذف' }); }
    else { const err = (await res.json().catch(() => ({}))) as { error?: string }; toast({ title: 'فشل الحذف', description: err.error, variant: 'destructive' }); }
  }

  function exportCSV() {
    const csv = toCSV(filtered.map(r => ({
      id: r.id,
      project: r.project_name_ar ?? '',
      region: r.region_name_ar ?? '',
      description: r.risk_description,
      affected_project: r.affected_project ?? '',
      category: r.category ?? '',
      probability: r.probability,
      impact: r.impact,
      risk_level: r.risk_level,
      bucket: riskBucket(r.risk_level).txt,
      response_plan: r.response_plan ?? '',
      owner: r.owner ?? '',
      status: RISK_STATUS_AR[r.status] ?? r.status,
      notes: r.notes ?? '',
      created_at: new Date(r.created_at).toLocaleString('ar-SA'),
      updated_at: new Date(r.updated_at).toLocaleString('ar-SA'),
    })), [
      { key: 'id',               label: 'المعرف' },
      { key: 'project',          label: 'المشروع' },
      { key: 'region',           label: 'المنطقة' },
      { key: 'description',      label: 'وصف الخطر' },
      { key: 'affected_project', label: 'المشروع المتأثر' },
      { key: 'category',         label: 'الفئة' },
      { key: 'probability',      label: 'الاحتمالية' },
      { key: 'impact',           label: 'التأثير' },
      { key: 'risk_level',       label: 'المستوى' },
      { key: 'bucket',           label: 'التصنيف' },
      { key: 'response_plan',    label: 'خطة الاستجابة' },
      { key: 'owner',            label: 'المسؤول' },
      { key: 'status',           label: 'الحالة' },
      { key: 'notes',            label: 'الملاحظات' },
      { key: 'created_at',       label: 'تاريخ الإنشاء' },
      { key: 'updated_at',       label: 'آخر تعديل' },
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `risks-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `تم تصدير ${filtered.length} خطر` });
  }

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        <KpiCard label="إجمالي المخاطر"     value={stats.total}    icon={BarChart3}    color="navy" />
        <KpiCard label="🔴 حرج (≥20)"       value={stats.critical} icon={AlertOctagon} color="red" />
        <KpiCard label="🟠 عالٍ (13-19)"    value={stats.high}     icon={AlertTriangle} color="gold" />
        <KpiCard label="🟡 متوسط (6-12)"    value={stats.medium}   icon={AlertCircle}  color="teal" />
        <KpiCard label="🟢 منخفض (1-5)"     value={stats.low}      icon={Info}         color="green" />
        <KpiCard label="متوسط / أعلى خطر"  value={`${stats.avg_level} / ${stats.max_level}`} icon={TrendingUp} color="purple" />
      </div>

      <div className="flex flex-wrap gap-3 items-center mb-5">
        {isAdmin && (
          <select value={filterRegion} onChange={e => setFilterRegion(e.target.value)} className="h-10 px-3 border border-input rounded-lg bg-white text-sm">
            <option value="">كل المناطق</option>
            {regions.map(r => <option key={r.code} value={r.code}>{r.name_ar}</option>)}
          </select>
        )}
        <select value={filterCategory} onChange={e => setFilterCategory(e.target.value)} className="h-10 px-3 border border-input rounded-lg bg-white text-sm">
          <option value="">كل الفئات</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-10 px-3 border border-input rounded-lg bg-white text-sm">
          <option value="">كل الحالات</option>
          <option value="open">🔴 مفتوح</option>
          <option value="in_progress">🟡 قيد المعالجة</option>
          <option value="controlled">🟢 تحت السيطرة</option>
        </select>
        <Input placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
        <div className="flex gap-2 mr-auto">
          <Button variant="secondary" onClick={exportCSV} title="تصدير CSV"><Download className="h-4 w-4" />تصدير</Button>
          <Button variant="secondary" onClick={() => window.print()} title="طباعة / حفظ PDF"><Printer className="h-4 w-4" />طباعة</Button>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> إضافة خطر
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-400px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-brand-soft text-brand-navy">
              <tr className="text-right">
                <th className="p-3 font-bold">#</th>
                {isAdmin && <th className="p-3 font-bold">المنطقة</th>}
                <th className="p-3 font-bold">وصف الخطر</th>
                <th className="p-3 font-bold">المشروع المتأثر</th>
                <th className="p-3 font-bold">الفئة</th>
                <th className="p-3 font-bold text-center">الاحتمالية</th>
                <th className="p-3 font-bold text-center">التأثير</th>
                <th className="p-3 font-bold text-center">مستوى الخطر</th>
                <th className="p-3 font-bold">خطة الاستجابة</th>
                <th className="p-3 font-bold">المسؤول</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">لا توجد مخاطر مطابقة</td></tr>}
              {filtered.map((r, i) => {
                const b = riskBucket(r.risk_level);
                return (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-muted-foreground">{i+1}</td>
                    {isAdmin && <td className="p-3"><Badge variant="secondary">{r.region_name_ar}</Badge></td>}
                    <td className="p-3 font-semibold max-w-xs">{r.risk_description}</td>
                    <td className="p-3">{r.affected_project ?? '-'}</td>
                    <td className="p-3"><Badge variant="warning">{r.category ?? '-'}</Badge></td>
                    <td className="p-3 text-center">{r.probability}</td>
                    <td className="p-3 text-center">{r.impact}</td>
                    <td className="p-3 text-center">
                      <span className={`inline-block px-3 py-1 rounded-lg font-bold border ${b.className}`}>{r.risk_level} {b.txt}</span>
                    </td>
                    <td className="p-3 max-w-[250px] text-xs text-muted-foreground">{r.response_plan ?? '-'}</td>
                    <td className="p-3">{r.owner ?? '-'}</td>
                    <td className="p-3 whitespace-nowrap">{RISK_STATUS_AR[r.status]}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteRisk(r.id)}><Trash2 className="h-4 w-4 text-brand-red" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <RiskModal
        open={modalOpen} onOpenChange={setModalOpen}
        risk={editing} regions={regions} categories={categories}
        isAdmin={isAdmin} userRegionId={userRegionId}
        onSaved={r => setRisks(prev => editing ? prev.map(x => x.id === r.id ? r : x) : [...prev, r])}
      />
    </>
  );
}
