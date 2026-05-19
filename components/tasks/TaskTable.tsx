'use client';

import { useState, useTransition } from 'react';
import { Task, Region, TaskStatus, Priority } from '@/lib/types';
import {
  daysUntil, statusClassification, STATUS_AR, PRIORITY_AR,
  autoProgressPercent, progressGap, toCSV,
} from '@/lib/formulas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Trash2, Plus, Download, Wand2, Printer } from 'lucide-react';
import { TaskModal } from './TaskModal';
import { useRouter } from 'next/navigation';

interface Props {
  initial: Task[];
  regions: Region[];
  isAdmin: boolean;
  userRegionId: number | null;
}

const STATUS_BADGE: Record<TaskStatus, 'success' | 'warning' | 'destructive'> = {
  completed: 'success', in_progress: 'warning', not_started: 'destructive',
};
const PRIORITY_BADGE: Record<Priority, 'destructive' | 'warning' | 'secondary'> = {
  high: 'destructive', medium: 'warning', low: 'secondary',
};

export function TaskTable({ initial, regions, isAdmin, userRegionId }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [, startTransition] = useTransition();

  const [tasks, setTasks] = useState<Task[]>(initial);
  const [search, setSearch] = useState('');
  const [filterRegion, setFilterRegion] = useState('');
  const [filterPhase, setFilterPhase] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  const phases = Array.from(new Set(initial.map(t => t.phase).filter(Boolean))) as string[];

  const filtered = tasks.filter(t => {
    if (filterRegion && t.region_code !== filterRegion) return false;
    if (filterPhase && t.phase !== filterPhase) return false;
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (search && !(t.task_name + ' ' + (t.responsible_person ?? '')).includes(search)) return false;
    return true;
  });

  async function updateCompletion(id: number, value: number) {
    // optimistic update
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completion_percent: value, updated_at: Date.now() } : t));
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completion_percent: value }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل التحديث', description: err.error ?? 'حدث خطأ', variant: 'destructive' });
      startTransition(() => router.refresh());
    }
  }

  async function applyAutoProgress(t: Task) {
    const auto = autoProgressPercent(t);
    if (auto === t.completion_percent) {
      toast({ title: 'القيمة المقترحة تطابق الحالية' });
      return;
    }
    await updateCompletion(t.id, auto);
    toast({ title: `تم تطبيق المقترح: ${auto}%` });
  }

  async function deleteTask(id: number) {
    if (!confirm('حذف هذه المهمة؟')) return;
    const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setTasks(prev => prev.filter(t => t.id !== id));
      toast({ title: 'تم حذف المهمة' });
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل الحذف', description: err.error ?? 'غير مصرح', variant: 'destructive' });
    }
  }

  function exportCSV() {
    const csv = toCSV(filtered.map(t => ({
      id: t.id,
      project: t.project_name_ar ?? '',
      region: t.region_name_ar ?? '',
      task: t.task_name,
      phase: t.phase ?? '',
      deadline: t.deadline ?? '',
      responsible: t.responsible_person ?? '',
      status: STATUS_AR[t.status],
      priority: t.priority ? PRIORITY_AR[t.priority] : '',
      completion_pct: t.completion_percent,
      auto_pct: autoProgressPercent(t),
      days_remaining: daysUntil(t.deadline) ?? '',
      classification: statusClassification(t),
      notes: t.notes ?? '',
      created_at: new Date(t.created_at).toLocaleString('ar-SA'),
      updated_at: new Date(t.updated_at).toLocaleString('ar-SA'),
    })), [
      { key: 'id',              label: 'المعرف' },
      { key: 'project',         label: 'المشروع' },
      { key: 'region',          label: 'المنطقة' },
      { key: 'task',            label: 'المهمة' },
      { key: 'phase',           label: 'المرحلة' },
      { key: 'deadline',        label: 'الموعد النهائي' },
      { key: 'responsible',     label: 'المسؤول' },
      { key: 'status',          label: 'الحالة' },
      { key: 'priority',        label: 'الأولوية' },
      { key: 'completion_pct',  label: 'الإنجاز %' },
      { key: 'auto_pct',        label: 'المقترح %' },
      { key: 'days_remaining',  label: 'الأيام المتبقية' },
      { key: 'classification',  label: 'التصنيف' },
      { key: 'notes',           label: 'الملاحظات' },
      { key: 'created_at',      label: 'تاريخ الإنشاء' },
      { key: 'updated_at',      label: 'آخر تعديل' },
    ]);

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tasks-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `تم تصدير ${filtered.length} مهمة` });
  }

  function openCreate() { setEditing(null); setModalOpen(true); }
  function openEdit(t: Task) { setEditing(t); setModalOpen(true); }

  return (
    <>
      <div className="flex flex-wrap gap-3 items-center mb-5">
        {isAdmin && (
          <select
            value={filterRegion} onChange={e => setFilterRegion(e.target.value)}
            className="h-10 px-3 border border-input rounded-lg bg-white text-sm"
          >
            <option value="">كل المناطق</option>
            {regions.map(r => <option key={r.code} value={r.code}>{r.name_ar}</option>)}
          </select>
        )}
        <select value={filterPhase} onChange={e => setFilterPhase(e.target.value)} className="h-10 px-3 border border-input rounded-lg bg-white text-sm">
          <option value="">كل المراحل</option>
          {phases.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="h-10 px-3 border border-input rounded-lg bg-white text-sm">
          <option value="">كل الحالات</option>
          <option value="completed">مكتمل ✓</option>
          <option value="in_progress">قيد التنفيذ</option>
          <option value="not_started">لم يبدأ</option>
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="h-10 px-3 border border-input rounded-lg bg-white text-sm">
          <option value="">كل الأولويات</option>
          <option value="high">عالي</option>
          <option value="medium">متوسط</option>
          <option value="low">منخفض</option>
        </select>
        <Input placeholder="🔍 بحث..." value={search} onChange={e => setSearch(e.target.value)} className="w-48" />
        <div className="flex gap-2 mr-auto">
          <Button variant="secondary" onClick={exportCSV} title="تصدير CSV"><Download className="h-4 w-4" />تصدير</Button>
          <Button variant="secondary" onClick={() => window.print()} title="طباعة / حفظ PDF عبر المتصفح"><Printer className="h-4 w-4" />طباعة</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" />إضافة مهمة</Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-280px)]">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10 bg-brand-soft text-brand-navy">
              <tr className="text-right">
                <th className="p-3 font-bold">#</th>
                {isAdmin && <th className="p-3 font-bold">المنطقة</th>}
                <th className="p-3 font-bold">اسم المهمة</th>
                <th className="p-3 font-bold">المرحلة</th>
                <th className="p-3 font-bold">الموعد النهائي</th>
                <th className="p-3 font-bold">المسؤول</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">الأولوية</th>
                <th className="p-3 font-bold">الإنجاز / المقترح</th>
                <th className="p-3 font-bold">الأيام المتبقية</th>
                <th className="p-3 font-bold">التصنيف</th>
                <th className="p-3 font-bold">الملاحظات</th>
                <th className="p-3 font-bold">التواريخ</th>
                <th className="p-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={14} className="p-8 text-center text-muted-foreground">لا توجد مهام مطابقة</td></tr>
              )}
              {filtered.map((t, i) => {
                const d = daysUntil(t.deadline);
                const dCls = d === null ? '' : d < 0 ? 'text-brand-red font-bold' : d <= 7 ? 'text-brand-gold font-bold' : 'text-brand-green font-bold';
                const dTxt = d === null ? '—' : d < 0 ? `متأخرة ${-d} يوم` : `${d} يوم`;
                const auto = autoProgressPercent(t);
                const gap = progressGap(t.completion_percent, auto);
                const gapClass = gap === 'behind' ? 'text-brand-red' : gap === 'ahead' ? 'text-brand-gold' : 'text-muted-foreground';
                const createdAt = new Date(t.created_at).toLocaleDateString('ar-SA');
                const updatedAt = new Date(t.updated_at).toLocaleDateString('ar-SA');
                return (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-muted-foreground">{i+1}</td>
                    {isAdmin && <td className="p-3"><Badge variant="secondary">{t.region_name_ar}</Badge></td>}
                    <td className="p-3 font-semibold">{t.task_name}</td>
                    <td className="p-3"><Badge variant="secondary">{t.phase ?? '-'}</Badge></td>
                    <td className="p-3 whitespace-nowrap">{t.deadline ?? '-'}</td>
                    <td className="p-3">{t.responsible_person ?? '-'}</td>
                    <td className="p-3"><Badge variant={STATUS_BADGE[t.status]}>{STATUS_AR[t.status]}</Badge></td>
                    <td className="p-3">{t.priority && <Badge variant={PRIORITY_BADGE[t.priority]}>{PRIORITY_AR[t.priority]}</Badge>}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 min-w-[160px]">
                        <Slider min={0} max={100} step={1} value={[t.completion_percent]} onValueChange={([v]) => updateCompletion(t.id, v)} className="flex-1" />
                        <span className="text-xs font-bold text-brand-navy w-9 ltr-only text-left">{t.completion_percent}%</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] ${gapClass}`} title="المقترح حسب الحالة × الأيام × الأولوية">
                          مقترح: <b>{auto}%</b>
                        </span>
                        <button
                          type="button"
                          onClick={() => applyAutoProgress(t)}
                          className="text-[10px] text-brand-teal hover:underline inline-flex items-center gap-0.5"
                          title="تطبيق المقترح"
                        >
                          <Wand2 className="h-3 w-3" /> تطبيق
                        </button>
                      </div>
                    </td>
                    <td className="p-3 whitespace-nowrap"><span className={dCls}>{dTxt}</span></td>
                    <td className="p-3 text-xs text-muted-foreground">{statusClassification(t)}</td>
                    <td className="p-3 text-xs max-w-[220px] text-muted-foreground">{t.notes ?? <span className="opacity-50">—</span>}</td>
                    <td className="p-3 text-[10px] text-muted-foreground whitespace-nowrap">
                      <div><b>أُنشئت:</b> {createdAt}</div>
                      <div><b>عُدّلت:</b> {updatedAt}</div>
                    </td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => deleteTask(t.id)}><Trash2 className="h-4 w-4 text-brand-red" /></Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <TaskModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editing}
        regions={regions}
        isAdmin={isAdmin}
        userRegionId={userRegionId}
        onSaved={(t) => {
          setTasks(prev => editing
            ? prev.map(x => x.id === t.id ? t : x)
            : [...prev, t]
          );
        }}
      />
    </>
  );
}
