'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Paperclip, X } from 'lucide-react';
import type { Circular, Project, User } from '@/lib/types';

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.gif',
  '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.csv'];

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

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
  const [files, setFiles] = useState<File[]>([]);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    const rejected: string[] = [];
    const accepted: File[] = [];
    for (const f of picked) {
      if (f.size > MAX_FILE_BYTES) { rejected.push(`${f.name} (الحجم > 15MB)`); continue; }
      const ext = '.' + (f.name.split('.').pop() || '').toLowerCase();
      if (!ALLOWED_EXTENSIONS.includes(ext)) { rejected.push(`${f.name} (نوع غير مسموح)`); continue; }
      accepted.push(f);
    }
    if (rejected.length) toast({ title: 'تم تخطي بعض الملفات', description: rejected.join(' • '), variant: 'destructive' });
    setFiles(prev => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function removeFile(idx: number) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
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
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ title: 'فشل الإرسال', description: err.error ?? 'حدث خطأ', variant: 'destructive' });
        return;
      }
      const c: Circular = await res.json();

      // Upload attachments one by one so the user sees progress per file.
      // If any upload fails the circular still exists; the user can retry from the detail page.
      let failed = 0;
      for (let i = 0; i < files.length; i++) {
        setUploadingIdx(i);
        const fd = new FormData();
        fd.append('file', files[i]);
        const upRes = await fetch(`/api/circulars/${c.id}/attachments`, { method: 'POST', body: fd });
        if (!upRes.ok) {
          failed++;
          const err = (await upRes.json().catch(() => ({}))) as { error?: string };
          toast({ title: `فشل رفع: ${files[i].name}`, description: err.error, variant: 'destructive' });
        }
      }
      setUploadingIdx(null);
      if (failed > 0) {
        toast({ title: `أُرسل التعميم — فشل رفع ${failed} من ${files.length} ملف`, description: 'يمكنك إعادة المحاولة من صفحة التعميم', variant: 'destructive' });
      }
      onCreated(c);
    } finally {
      setSaving(false);
      setUploadingIdx(null);
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

          {/* Attachments */}
          <div>
            <Label className="flex items-center gap-1.5"><Paperclip className="h-4 w-4" /> المرفقات (اختياري)</Label>
            <div className="mt-1">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept={ALLOWED_EXTENSIONS.join(',')}
                onChange={onFileChange}
                className="hidden"
                id="circular-files"
              />
              <label
                htmlFor="circular-files"
                className="inline-flex items-center gap-2 px-4 py-2 border border-dashed border-slate-300 rounded-lg cursor-pointer text-sm hover:bg-slate-50"
              >
                <Paperclip className="h-4 w-4" />
                اختيار ملفات (PDF / صور / Word / Excel — حد 15MB لكل ملف)
              </label>
            </div>
            {files.length > 0 && (
              <ul className="mt-2 space-y-1">
                {files.map((f, i) => (
                  <li key={i} className={`flex items-center justify-between text-xs bg-slate-50 rounded px-2 py-1.5 ${uploadingIdx === i ? 'bg-brand-soft/40' : ''}`}>
                    <span className="truncate flex-1">
                      📎 {f.name} <span className="text-muted-foreground">({humanSize(f.size)})</span>
                      {uploadingIdx === i && <span className="mr-2 text-brand-teal">⏳ جاري الرفع...</span>}
                    </span>
                    {uploadingIdx === null && (
                      <button type="button" onClick={() => removeFile(i)} className="text-brand-red p-1 hover:bg-white rounded" aria-label="إزالة">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
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
