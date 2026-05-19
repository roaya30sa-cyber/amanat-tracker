'use client';

import { useState } from 'react';
import type { Project } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { Pencil, Plus, ShieldOff, ShieldCheck, ClipboardList, AlertTriangle, Users } from 'lucide-react';

type ProjectRow = Project & { task_count: number; risk_count: number; user_count: number };
interface Props { initial: ProjectRow[]; }

export function ProjectsTable({ initial }: Props) {
  const { toast } = useToast();
  const [projects, setProjects] = useState<ProjectRow[]>(initial);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectRow | null>(null);
  const emptyForm = { code: '', name_ar: '', is_active: true };
  const [form, setForm] = useState(emptyForm);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(p: ProjectRow) {
    setEditing(p);
    setForm({ code: p.code, name_ar: p.name_ar, is_active: !!p.is_active });
    setOpen(true);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/projects/${editing.id}` : '/api/projects';
    const method = editing ? 'PATCH' : 'POST';
    // For PATCH we only send name_ar + is_active (code is immutable once created).
    const payload: Record<string, unknown> = editing
      ? { name_ar: form.name_ar, is_active: form.is_active }
      : { code: form.code, name_ar: form.name_ar, is_active: form.is_active };
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (res.ok) {
      const saved = await res.json();
      setProjects(prev => editing
        ? prev.map(p => p.id === saved.id ? { ...p, ...saved } : p)
        : [...prev, { ...saved, task_count: 0, risk_count: 0, user_count: 0 }]
      );
      toast({ title: editing ? 'تم تحديث المشروع' : 'تمت إضافة المشروع' });
      setOpen(false);
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل', description: err.error, variant: 'destructive' });
    }
  }

  async function toggleActive(p: ProjectRow) {
    if (p.id === 1 && p.is_active) {
      toast({ title: 'لا يمكن تعطيل المشروع الأصلي', variant: 'destructive' });
      return;
    }
    const res = await fetch(`/api/projects/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: p.is_active ? 0 : 1 }),
    });
    if (res.ok) {
      const saved = await res.json();
      setProjects(prev => prev.map(x => x.id === saved.id ? { ...x, ...saved } : x));
      toast({ title: saved.is_active ? 'تم تفعيل المشروع' : 'تم تعطيل المشروع' });
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex justify-between items-center mb-5">
        <h3 className="text-lg font-bold text-brand-navy">🏢 إدارة المشاريع</h3>
        <Button onClick={openCreate}><Plus className="h-4 w-4" />إضافة مشروع</Button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-brand-soft text-brand-navy">
            <tr className="text-right">
              <th className="p-3 font-bold">المشروع</th>
              <th className="p-3 font-bold">الرمز</th>
              <th className="p-3 font-bold">المستخدمون</th>
              <th className="p-3 font-bold">المهام</th>
              <th className="p-3 font-bold">المخاطر</th>
              <th className="p-3 font-bold">الحالة</th>
              <th className="p-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {projects.map(p => (
              <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="p-3 font-bold text-brand-navy">{p.name_ar}</td>
                <td className="p-3 ltr-only text-left font-mono text-xs">{p.code}</td>
                <td className="p-3"><span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{p.user_count}</span></td>
                <td className="p-3"><span className="inline-flex items-center gap-1"><ClipboardList className="h-3.5 w-3.5" />{p.task_count}</span></td>
                <td className="p-3"><span className="inline-flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" />{p.risk_count}</span></td>
                <td className="p-3">
                  {p.is_active
                    ? <Badge variant="success">نشط</Badge>
                    : <Badge variant="destructive">معطل</Badge>}
                </td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => openEdit(p)} title="تعديل"><Pencil className="h-4 w-4" /></Button>
                    {p.id !== 1 && (
                      <Button size="icon" variant="ghost" onClick={() => toggleActive(p)} title={p.is_active ? 'تعطيل' : 'تفعيل'}>
                        {p.is_active ? <ShieldOff className="h-4 w-4 text-brand-gold" /> : <ShieldCheck className="h-4 w-4 text-brand-green" />}
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {projects.length === 0 && (
              <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد مشاريع</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? 'تعديل المشروع' : 'إضافة مشروع جديد'}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-4">
            <div>
              <Label>اسم المشروع * <span className="text-xs text-muted-foreground">(بالعربية)</span></Label>
              <Input required className="mt-1" value={form.name_ar} onChange={e => setForm({ ...form, name_ar: e.target.value })} placeholder="مثلاً: أمانة الرياض" />
            </div>
            {!editing && (
              <div>
                <Label>الرمز * <span className="text-xs text-muted-foreground">(حروف إنجليزية/أرقام/_)</span></Label>
                <Input
                  required dir="ltr" className="mt-1 ltr-only text-left font-mono"
                  pattern="^[A-Z0-9_]{2,40}$" maxLength={40}
                  value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="AMANAT_RIYADH"
                />
              </div>
            )}
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} className="w-4 h-4 accent-brand-teal" />
              <span className="text-sm">مشروع نشط</span>
            </label>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button>
              <Button type="submit">حفظ</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
