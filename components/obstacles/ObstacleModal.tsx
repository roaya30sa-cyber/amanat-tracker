'use client';

import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import type { Obstacle, Role } from '@/lib/types';

interface Recipient {
  id: number;
  username: string;
  full_name: string | null;
  role: Role;
  region_id: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  item: Obstacle | null;
  currentUserRole: Role;
  onSaved: (o: Obstacle) => void;
}

export function ObstacleModal({ open, onOpenChange, item, currentUserRole, onSaved }: Props) {
  const { toast } = useToast();
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [form, setForm] = useState({
    to_user_id: '',
    statement: '',
    request: '',
    notes: '',
    proposed_due_date: '',
  });
  const [saving, setSaving] = useState(false);
  const isAdmin = currentUserRole === 'admin';

  useEffect(() => {
    if (!open) return;
    fetch('/api/users/recipients', { cache: 'no-store' })
      .then(r => r.json())
      .then((rs: Recipient[]) => setRecipients(Array.isArray(rs) ? rs : []))
      .catch(() => setRecipients([]));

    if (item) {
      setForm({
        to_user_id: String(item.to_user_id),
        statement: item.statement,
        request: item.request ?? '',
        notes: item.notes ?? '',
        proposed_due_date: item.proposed_due_date ?? '',
      });
    } else {
      setForm({ to_user_id: '', statement: '', request: '', notes: '', proposed_due_date: '' });
    }
  }, [open, item]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!form.statement.trim()) { toast({ title: 'البيان مطلوب', variant: 'destructive' }); return; }
    if (!item && !form.to_user_id) { toast({ title: 'اختر المستلم', variant: 'destructive' }); return; }
    setSaving(true);
    const url = item ? `/api/obstacles/${item.id}` : '/api/obstacles';
    const method = item ? 'PATCH' : 'POST';
    const payload: Record<string, unknown> = {
      statement: form.statement,
      request: form.request || null,
      notes: form.notes || null,
      proposed_due_date: form.proposed_due_date || null,
    };
    if (!item) payload.to_user_id = parseInt(form.to_user_id);
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    setSaving(false);
    if (res.ok) {
      const saved = await res.json();
      onSaved(saved);
      toast({ title: item ? 'تم تحديث العائق' : 'تم إرسال العائق' });
      onOpenChange(false);
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل الحفظ', description: err.error, variant: 'destructive' });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{item ? 'تعديل عائق' : 'إضافة عائق جديد'}</DialogTitle></DialogHeader>
        <form onSubmit={save} className="space-y-4">
          {!item && (
            <div>
              <Label>المستلم *</Label>
              <select required className="h-10 w-full mt-1 px-3 border border-input rounded-lg bg-white text-sm"
                value={form.to_user_id} onChange={e => setForm({...form, to_user_id: e.target.value})}>
                <option value="">— اختر المستلم —</option>
                {recipients.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.full_name ?? r.username} ({r.role === 'admin' ? 'مدير النظام' : 'مدير منطقة'})
                  </option>
                ))}
              </select>
              {recipients.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">لا يوجد مستلمون متاحون. تأكد من وجود مدير منطقة/مدير نظام نشط.</p>
              )}
            </div>
          )}
          <div>
            <Label>البيان * <span className="text-xs text-muted-foreground">(وصف العائق)</span></Label>
            <textarea required className="w-full mt-1 px-3 py-2 border border-input rounded-lg bg-white text-sm" rows={3}
              value={form.statement} onChange={e => setForm({...form, statement: e.target.value})} />
          </div>
          <div>
            <Label>الطلب <span className="text-xs text-muted-foreground">(ما المطلوب من المستلم؟)</span></Label>
            <textarea className="w-full mt-1 px-3 py-2 border border-input rounded-lg bg-white text-sm" rows={2}
              value={form.request} onChange={e => setForm({...form, request: e.target.value})} />
          </div>
          <div>
            <Label>الملاحظة</Label>
            <Input className="mt-1" value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
          </div>
          <div>
            <Label>
              {isAdmin ? 'تاريخ الاستحقاق المعتمد *' : 'تاريخ الاستحقاق المقترح'}
              {' '}<span className="text-xs text-muted-foreground">(YYYY-MM-DD)</span>
            </Label>
            <Input type="date" className="mt-1" value={form.proposed_due_date} onChange={e => setForm({...form, proposed_due_date: e.target.value})} />
            {!isAdmin && <p className="text-xs text-muted-foreground mt-1">سيراجع المدير التاريخ ويُعتمده أو يعدله.</p>}
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? '...جارٍ الحفظ' : 'حفظ'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
