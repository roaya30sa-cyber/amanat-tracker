'use client';

import { useState, useTransition } from 'react';
import { Task, Region, TaskStatus, Priority } from '@/lib/types';
import { daysUntil, statusClassification, STATUS_AR, PRIORITY_AR } from '@/lib/formulas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Trash2, Plus } from 'lucide-react';
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
    setTasks(prev => prev.map(t => t.id === id ? { ...t, completion_percent: value } : t));
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
        <Button onClick={openCreate} className="mr-auto"><Plus className="h-4 w-4" />إضافة مهمة</Button>
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
                <th className="p-3 font-bold">الشخص المسؤول</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">الأولوية</th>
                <th className="p-3 font-bold">نسبة الإنجاز</th>
                <th className="p-3 font-bold">الأيام المتبقية</th>
                <th className="p-3 font-bold">تصنيف الحالة</th>
                <th className="p-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={12} className="p-8 text-center text-muted-foreground">لا توجد مهام مطابقة</td></tr>
              )}
              {filtered.map((t, i) => {
                const d = daysUntil(t.deadline);
                const dCls = d === null ? '' : d < 0 ? 'text-brand-red font-bold' : d <= 7 ? 'text-brand-gold font-bold' : 'text-brand-green font-bold';
                const dTxt = d === null ? '—' : d < 0 ? `متأخرة ${-d} يوم` : `${d} يوم`;
                return (
                  <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="p-3 text-muted-foreground">{i+1}</td>
                    {isAdmin && <td className="p-3"><Badge variant="secondary">{t.region_name_ar}</Badge></td>}
                    <td className="p-3 font-semibold">{t.task_name}</td>
                    <td className="p-3"><Badge variant="secondary">{t.phase ?? '-'}</Badge></td>
                    <td className="p-3">{t.deadline ?? '-'}</td>
                    <td className="p-3">{t.responsible_person ?? '-'}</td>
                    <td className="p-3"><Badge variant={STATUS_BADGE[t.status]}>{STATUS_AR[t.status]}</Badge></td>
                    <td className="p-3">{t.priority && <Badge variant={PRIORITY_BADGE[t.priority]}>{PRIORITY_AR[t.priority]}</Badge>}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2 min-w-[140px]">
                        <Slider min={0} max={100} step={1} value={[t.completion_percent]} onValueChange={([v]) => updateCompletion(t.id, v)} className="flex-1" />
                        <span className="text-xs font-bold text-brand-navy w-10 ltr-only text-left">{t.completion_percent}%</span>
                      </div>
                    </td>
                    <td className="p-3"><span className={dCls}>{dTxt}</span></td>
                    <td className="p-3 text-xs text-muted-foreground">{statusClassification(t)}</td>
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
