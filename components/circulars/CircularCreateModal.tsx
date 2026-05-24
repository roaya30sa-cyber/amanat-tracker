'use client';

import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import type { Circular, Project, User } from '@/lib/types';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: (c: Circular) => void;
}

/** Read the admin's active project cookie. Returns null when in "all projects" mode. */
function readActiveProjectIdFromCookie(): number | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)amanat_active_project=([^;]+)/);
  if (!m) return null;
  if (m[1] === 'all') return null;
  const n = parseInt(decodeURIComponent(m[1]), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function CircularCreateModal({ open, onOpenChange, onCreated }: Props) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [managers, setManagers] = useState<User[]>([]);
  const initialProjectId = readActiveProjectIdFromCookie();

  const [form, setForm] = useState({
    title: '',
    body: '',
    audience: 'all_managers' as 'all_managers' | 'specific',
    recipient_ids: [] as number[],
    ack_deadline: '',
    project_id: initialProjectId as number | null,  // null = cross-project
  });

  // Load projects + active managers when modal opens.
  useEffect(() => {
    if (!open) return;
    fetch('/api/projects', { cache: 'no-store' })
      .then(r => r.json())
      .then((rows: Project[]) => setProjects(Array.isArray(rows) ? rows.filter(p => p.is_active) : []))
      .catch(() => setProjects([]));

    fetch('/api/users', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : [])
      .then((rows: User[]) => setManagers(Array.isArray(rows) ? rows.filter(u => u.role === 'regional_manager' && u.is_active) : []))
      .catch(() => setManagers([]));
  }, [open]);

  // Filter managers by selected project (null = show all)
  const filteredManagers = useMemo(() => {
    if (form.project_id === null) return managers;
    return managers.filter(m => m.project_id === form.project_id);
  }, [managers, form.project_id]);

  function toggleRecipient(uid: number) {
    setForm(f => ({
      ...f,
      recipient_ids: f.recipient_ids.includes(uid)
        ? f.recipient_ids.filter(x => x !== uid)
        : [...f.recipient_ids, uid],
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) {
      toast({ title: 'العنوان والنص مطلوبان', variant: 'destructive' });
      return;
    }
    if (form.audience === 'specific' && form.recipient_ids.length === 0) {
      toast({ title: 'يجب اختيار مستلم واحد على الأقل', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload: any = {
        title: form.title,
        body: form.body,
        audience: form.audience,
        ack_deadline: form.ack_deadline || null,
        project_id: form.project_id,
      };
      if (form.audience === 'specific') payload.recipient_ids = form.recipient_ids;

      const res = await fetch('/api/circulars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const c: Circular = await res.json();
        onCreated(c);
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ title: 'فشل الإرسال', description: err.error ?? 'حدث خطأ', variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>📢 تعميم جديد</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          {/* Project selector */}
          {projects.length > 0 && (
            <div>
              <Label>المشروع المُستهدف</Label>
              <select
                className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.project_id ?? 'null'}
                onChange={e => setForm({ ...form, project_id: e.target.value === 'null' ? null : parseInt(e.target.value), recipient_ids: [] })}
              >
                <option value="null">— جميع المشاريع (تعميم عابر) —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.name_ar}</option>)}
              </select>
              <p className="text-xs text-muted-foreground mt-1">يحدد قائمة مدراء المناطق المتاحين للاستهداف</p>
            </div>
          )}

          <div>
            <Label>عنوان التعميم *</Label>
            <Input
              required maxLength={200}
              className="mt-1"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: تعميم بشأن آلية تقديم التقارير الشهرية"
            />
          </div>

          <div>
            <Label>نص التعميم *</Label>
            <Textarea
              required rows={6}
              className="mt-1"
              value={form.body}
              onChange={e => setForm({ ...form, body: e.target.value })}
              placeholder="اكتب نص التعميم هنا..."
            />
          </div>

          <div>
            <Label>الجمهور المستهدف *</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <label className={`p-3 rounded-lg border cursor-pointer text-sm font-bold text-center ${form.audience === 'all_managers' ? 'border-brand-navy bg-brand-soft text-brand-navy' : 'border-slate-200'}`}>
                <input type="radio" className="hidden" checked={form.audience === 'all_managers'}
                  onChange={() => setForm({ ...form, audience: 'all_managers' })} />
                جميع مدراء المناطق ({filteredManagers.length})
              </label>
              <label className={`p-3 rounded-lg border cursor-pointer text-sm font-bold text-center ${form.audience === 'specific' ? 'border-brand-navy bg-brand-soft text-brand-navy' : 'border-slate-200'}`}>
                <input type="radio" className="hidden" checked={form.audience === 'specific'}
                  onChange={() => setForm({ ...form, audience: 'specific' })} />
                تحديد مستلمين
              </label>
            </div>
          </div>

          {form.audience === 'specific' && (
            <div>
              <Label>المستلمون *</Label>
              <div className="mt-1 border border-slate-200 rounded-lg max-h-48 overflow-y-auto">
                {filteredManagers.length === 0 ? (
                  <div className="p-3 text-sm text-muted-foreground text-center">لا يوجد مدراء مناطق متاحون</div>
                ) : filteredManagers.map(m => (
                  <label key={m.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-brand-teal"
                      checked={form.recipient_ids.includes(m.id)}
                      onChange={() => toggleRecipient(m.id)}
                    />
                    <span className="text-sm">{m.full_name ?? m.username}</span>
                    <span className="text-xs text-muted-foreground ml-auto" dir="ltr">{m.username}</span>
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">المحددون: {form.recipient_ids.length}</p>
            </div>
          )}

          <div>
            <Label>الموعد النهائي للتأكيد (اختياري)</Label>
            <Input
              type="date"
              className="mt-1"
              value={form.ack_deadline}
              onChange={e => setForm({ ...form, ack_deadline: e.target.value })}
            />
            <p className="text-xs text-muted-foreground mt-1">إذا حُدِّد ولم يؤكد المستلم قبله، يُرسَل له تذكير قبل الموعد بـ 24 ساعة وتنبيه أحمر عند التجاوز</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? '...' : 'إرسال التعميم'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
