'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import { ArrowRight, CheckCircle2, Clock, Pencil, Archive, AlertTriangle, Printer } from 'lucide-react';
import type { Circular, CircularRecipientRow, Role } from '@/lib/types';
import { formatDateAr, formatDateTimeAr } from '@/lib/utils';

interface Props {
  circularId: number;
  currentUserId: number;
  currentUserRole: Role;
  onBack: () => void;
  onChanged: (c: Circular) => void;
  onArchived: () => void;
  onAcknowledged: (at: number) => void;
}

export function CircularDetail({
  circularId, currentUserId, currentUserRole, onBack, onChanged, onArchived, onAcknowledged,
}: Props) {
  const { toast } = useToast();
  const isAdmin = currentUserRole === 'admin';
  const [loading, setLoading] = useState(true);
  const [circular, setCircular] = useState<Circular | null>(null);
  const [recipients, setRecipients] = useState<CircularRecipientRow[]>([]);
  const [myAck, setMyAck] = useState<number | null>(null);
  const [isMyRecipient, setIsMyRecipient] = useState(false);
  const [ackOpen, setAckOpen] = useState(false);
  const [ackNote, setAckNote] = useState('');
  const [acking, setAcking] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/circulars/${circularId}`, { cache: 'no-store' });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        toast({ title: 'فشل التحميل', description: e.error, variant: 'destructive' });
        return;
      }
      const d = await r.json();
      setCircular(d.circular);
      setRecipients(d.recipients ?? []);
      setMyAck(d.my_acknowledged_at);
      setIsMyRecipient(!!d.is_my_recipient);
    } finally {
      setLoading(false);
    }
  }, [circularId, toast]);

  useEffect(() => { load(); }, [load]);

  async function acknowledge() {
    setAcking(true);
    try {
      const res = await fetch(`/api/circulars/${circularId}/acknowledge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note: ackNote || null }),
      });
      if (res.ok) {
        const d = await res.json();
        setMyAck(d.acknowledged_at);
        setRecipients(prev => prev.map(r => r.user_id === currentUserId
          ? { ...r, acknowledged_at: d.acknowledged_at, acknowledged_note: ackNote || null }
          : r));
        onAcknowledged(d.acknowledged_at);
        setAckOpen(false);
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ title: 'فشل التأكيد', description: err.error, variant: 'destructive' });
      }
    } finally {
      setAcking(false);
    }
  }

  async function archive() {
    if (!confirm('أرشفة هذا التعميم؟ سيُخفى من قائمة المستلمين لكن يبقى محفوظاً للسجل.')) return;
    const res = await fetch(`/api/circulars/${circularId}`, { method: 'DELETE' });
    if (res.ok) onArchived();
    else toast({ title: 'فشل الأرشفة', variant: 'destructive' });
  }

  if (loading || !circular) {
    return <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>;
  }

  const totalRecipients = recipients.length;
  const acked = recipients.filter(r => r.acknowledged_at).length;
  const pct = totalRecipients ? Math.round((acked / totalRecipients) * 100) : 0;
  const nowMs = Date.now();
  const deadlineMs = circular.ack_deadline ? Date.parse(circular.ack_deadline + 'T23:59:59Z') : NaN;
  const isOverdue = Number.isFinite(deadlineMs) && deadlineMs < nowMs;

  const canEdit = isAdmin && circular.created_by === currentUserId && circular.status === 'active';
  const canArchive = isAdmin && circular.status === 'active';

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <Button variant="ghost" onClick={onBack} className="gap-2">
          <ArrowRight className="h-4 w-4" /> رجوع
        </Button>
        <div className="flex items-center gap-2 print:hidden">
          <Button variant="secondary" onClick={() => window.print()}><Printer className="h-4 w-4" /> طباعة</Button>
          {canEdit && <Button variant="secondary" onClick={() => setEditOpen(true)}><Pencil className="h-4 w-4" /> تعديل</Button>}
          {canArchive && <Button variant="secondary" onClick={archive}><Archive className="h-4 w-4" /> أرشفة</Button>}
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-brand-navy mb-1">{circular.title}</h2>
            <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
              <span>أُرسل من: <b className="text-brand-navy">{circular.created_by_name ?? '—'}</b></span>
              <span>تاريخ الإرسال: {formatDateTimeAr(circular.created_at)}</span>
              {circular.project_name_ar && <span>🏢 {circular.project_name_ar}</span>}
              {circular.status === 'archived' && <Badge variant="secondary">مؤرشف</Badge>}
            </div>
          </div>
          {circular.ack_deadline && (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg ${isOverdue ? 'bg-red-50 text-brand-red' : 'bg-amber-50 text-brand-gold'}`}>
              <Clock className="h-4 w-4" />
              <div className="text-xs">
                <div className="font-bold">الموعد النهائي للتأكيد</div>
                <div>{formatDateAr(circular.ack_deadline)} {isOverdue && '⚠ (متأخر)'}</div>
              </div>
            </div>
          )}
        </div>

        <div className="whitespace-pre-wrap text-sm leading-loose text-slate-800 border border-slate-100 rounded-lg p-4 bg-slate-50/50">
          {circular.body}
        </div>

        {/* Acknowledgement banner */}
        {isMyRecipient && (
          <div className="mt-4">
            {myAck ? (
              <div className="bg-brand-soft/40 border border-brand-teal/30 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-brand-green" />
                <div className="text-sm">
                  <b>تم تأكيد استلامك</b> في {formatDateTimeAr(myAck)}
                </div>
              </div>
            ) : (
              <div className={`rounded-lg p-4 flex items-center justify-between gap-3 flex-wrap ${isOverdue ? 'bg-red-50 border border-brand-red/30' : 'bg-amber-50 border border-brand-gold/30'}`}>
                <div className="flex items-center gap-2">
                  {isOverdue ? <AlertTriangle className="h-5 w-5 text-brand-red" /> : <Clock className="h-5 w-5 text-brand-gold" />}
                  <span className="text-sm font-bold">{isOverdue ? 'لم تؤكد استلام هذا التعميم — تجاوزت الموعد النهائي' : 'يرجى تأكيد استلام هذا التعميم'}</span>
                </div>
                <Button onClick={() => setAckOpen(true)}>تأكيد الاستلام</Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Progress + recipient table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h3 className="font-bold text-brand-navy">سجل التأكيدات</h3>
          <div className="text-sm">
            <b className={pct === 100 ? 'text-brand-green' : 'text-brand-navy'}>{acked}</b> / {totalRecipients}
            <span className="text-muted-foreground"> أكّدوا الاستلام ({pct}%)</span>
          </div>
        </div>
        <div className="w-full h-2 bg-slate-200 rounded-full mb-4 overflow-hidden">
          <div className={`h-full ${pct === 100 ? 'bg-brand-green' : 'bg-brand-teal'}`} style={{ width: `${pct}%` }} />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-soft text-brand-navy">
              <tr className="text-right">
                <th className="p-3 font-bold">المستلم</th>
                <th className="p-3 font-bold">المنطقة</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">وقت التأكيد</th>
                <th className="p-3 font-bold">ملاحظة المستلم</th>
              </tr>
            </thead>
            <tbody>
              {recipients.map(r => (
                <tr key={r.user_id} className="border-b border-slate-100">
                  <td className="p-3">
                    <div>{r.user_full_name ?? r.user_username}</div>
                    <div className="text-xs text-muted-foreground" dir="ltr">{r.user_username}</div>
                  </td>
                  <td className="p-3 text-xs">{r.user_region_name_ar ?? '—'}</td>
                  <td className="p-3">
                    {r.acknowledged_at
                      ? <Badge variant="success">✓ مستلَم</Badge>
                      : isOverdue
                        ? <Badge variant="destructive">⏰ متأخر</Badge>
                        : <Badge variant="warning">في الانتظار</Badge>}
                  </td>
                  <td className="p-3 text-xs whitespace-nowrap">{r.acknowledged_at ? formatDateTimeAr(r.acknowledged_at) : '—'}</td>
                  <td className="p-3 text-xs text-muted-foreground">{r.acknowledged_note ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Acknowledge modal */}
      <Dialog open={ackOpen} onOpenChange={setAckOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>تأكيد استلام التعميم</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              بالضغط على "تأكيد" أنت تُقر بالاطلاع على نص التعميم. لا يمكن التراجع عن هذا التأكيد.
            </p>
            <div>
              <Label>ملاحظة (اختيارية)</Label>
              <Textarea
                className="mt-1"
                rows={3}
                value={ackNote}
                onChange={e => setAckNote(e.target.value)}
                placeholder="مثال: تم الاطلاع وسيتم العمل به"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setAckOpen(false)}>إلغاء</Button>
              <Button onClick={acknowledge} disabled={acking}>{acking ? '...' : 'تأكيد الاستلام'}</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>

      {editOpen && (
        <EditCircularModal
          circular={circular}
          onClose={() => setEditOpen(false)}
          onSaved={(c) => { setCircular(c); onChanged(c); setEditOpen(false); load(); }}
        />
      )}
    </div>
  );
}

// -------------------------- Edit submodal --------------------------
function EditCircularModal({
  circular, onClose, onSaved,
}: {
  circular: Circular;
  onClose: () => void;
  onSaved: (c: Circular) => void;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState({
    title: circular.title,
    body: circular.body,
    ack_deadline: circular.ack_deadline ?? '',
  });
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const contentChanged = form.title !== circular.title || form.body !== circular.body;
      if (contentChanged) {
        const ok = confirm('تعديل النص سيُلغي جميع التأكيدات السابقة ويطلب من المستلمين إعادة التأكيد. متابعة؟');
        if (!ok) return;
      }
      const res = await fetch(`/api/circulars/${circular.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          body: form.body,
          ack_deadline: form.ack_deadline || null,
        }),
      });
      if (res.ok) {
        const c = await res.json();
        toast({ title: contentChanged ? 'تم التعديل — أُعيد طلب التأكيد' : 'تم تحديث الموعد' });
        onSaved(c);
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        toast({ title: 'فشل التعديل', description: err.error, variant: 'destructive' });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={true} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>تعديل التعميم</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div><Label>العنوان *</Label><Input required className="mt-1" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
          <div><Label>النص *</Label><Textarea required rows={6} className="mt-1" value={form.body} onChange={e => setForm({ ...form, body: e.target.value })} /></div>
          <div><Label>الموعد النهائي للتأكيد (اختياري)</Label><Input type="date" className="mt-1" value={form.ack_deadline} onChange={e => setForm({ ...form, ack_deadline: e.target.value })} /></div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>إلغاء</Button>
            <Button type="submit" disabled={saving}>{saving ? '...' : 'حفظ'}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
