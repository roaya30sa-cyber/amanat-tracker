'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import type { Task, Region, TaskStatus, Priority, Project } from '@/lib/types';
import { todayIso } from '@/lib/utils';

/**
 * Read the admin's active project cookie set by ProjectSwitcher.
 * Returns null if "all" or not set.
 */
function readActiveProjectIdFromCookie(): number | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)amanat_active_project=([^;]+)/);
  if (!m) return null;
  if (m[1] === 'all') return null;
  const n = parseInt(decodeURIComponent(m[1]), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  task: Task | null;
  regions: Region[];
  isAdmin: boolean;
  userRegionId: number | null;
  onSaved: (task: Task) => void;
}

const PHASES = ['الأعمال الإدارية', 'المراجعة والتقارير', 'الزيارات الميدانية', 'حملات التواصل ونقل المعرفة'];

export function TaskModal({ open, onOpenChange, task, regions, isAdmin, userRegionId, onSaved }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState({
    region_id: userRegionId ?? (regions[0]?.id ?? 1),
    project_id: null as number | null,
    task_name: '',
    phase: PHASES[0],
    deadline: todayIso(),
    responsible_person: '',
    status: 'not_started' as TaskStatus,
    priority: 'medium' as Priority,
    completion_percent: 0,
    notes: '',
  });

  // Fetch projects list when modal opens for an admin (so they can pick when in "all" mode).
  useEffect(() => {
    if (!open || !isAdmin) return;
    fetch('/api/projects', { cache: 'no-store' })
      .then(r => r.json())
      .then((rows: Project[]) => setProjects(Array.isArray(rows) ? rows.filter(p => p.is_active) : []))
      .catch(() => setProjects([]));
  }, [open, isAdmin]);

  useEffect(() => {
    if (task) {
      setForm({
        region_id: task.region_id,
        project_id: task.project_id,
        task_name: task.task_name,
        phase: task.phase ?? PHASES[0],
        deadline: task.deadline ?? todayIso(),
        responsible_person: task.responsible_person ?? '',
        status: task.status,
        priority: (task.priority ?? 'medium') as Priority,
        completion_percent: task.completion_percent,
        notes: task.notes ?? '',
      });
    } else {
      const cookieProject = readActiveProjectIdFromCookie();
      setForm(f => ({
        ...f,
        region_id: userRegionId ?? (regions[0]?.id ?? 1),
        project_id: cookieProject ?? (projects[0]?.id ?? null),
      }));
    }
  }, [task, open, userRegionId, regions, projects]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const url = task ? `/api/tasks/${task.id}` : '/api/tasks';
    const method = task ? 'PATCH' : 'POST';
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      toast({ title: task ? 'تم تحديث المهمة' : 'تمت إضافة المهمة' });
      onSaved(saved);
      onOpenChange(false);
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل الحفظ', description: err.error ?? 'حدث خطأ', variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{task ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {isAdmin && !task && projects.length > 0 && (
            <div>
              <Label>المشروع *</Label>
              <select required className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.project_id ?? ''} onChange={e => setForm({ ...form, project_id: parseInt(e.target.value) })}>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
              </select>
            </div>
          )}
          {isAdmin && (
            <div>
              <Label>المنطقة</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.region_id} onChange={e => setForm({ ...form, region_id: parseInt(e.target.value) })}>
                {regions.map(r => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
              </select>
            </div>
          )}
          <div><Label>اسم المهمة *</Label><Input className="mt-1" required value={form.task_name} onChange={e => setForm({ ...form, task_name: e.target.value })} /></div>
          <div>
            <Label>المرحلة *</Label>
            <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm" required
              value={form.phase} onChange={e => setForm({ ...form, phase: e.target.value })}>
              {PHASES.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>الموعد النهائي *</Label><Input type="date" required className="mt-1" value={form.deadline} onChange={e => setForm({ ...form, deadline: e.target.value })} /></div>
            <div><Label>الشخص المسؤول</Label><Input className="mt-1" value={form.responsible_person} onChange={e => setForm({ ...form, responsible_person: e.target.value })} /></div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>الحالة *</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm" required
                value={form.status} onChange={e => setForm({ ...form, status: e.target.value as TaskStatus })}>
                <option value="not_started">لم يبدأ</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">مكتمل ✓</option>
              </select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <select className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Priority })}>
                <option value="high">عالي</option>
                <option value="medium">متوسط</option>
                <option value="low">منخفض</option>
              </select>
            </div>
            <div>
              <Label>الإنجاز %</Label>
              <Input type="number" min={0} max={100} className="mt-1" value={form.completion_percent} onChange={e => setForm({ ...form, completion_percent: parseInt(e.target.value) || 0 })} />
            </div>
          </div>
          <div><Label>ملاحظات</Label><Textarea className="mt-1" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ...' : 'حفظ'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
