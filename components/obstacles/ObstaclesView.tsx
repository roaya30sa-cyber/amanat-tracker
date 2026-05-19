'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Pencil, Trash2, Check, X, Play, CheckCircle2, Inbox, Send, ListFilter, Download, Printer } from 'lucide-react';
import type { Obstacle, ObstacleStatus, Role } from '@/lib/types';
import { ObstacleStatusBadge } from './ObstacleStatusBadge';
import { ObstacleModal } from './ObstacleModal';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { toCSV } from '@/lib/formulas';

const STATUS_LABEL: Record<ObstacleStatus, string> = {
  pending_approval: 'بانتظار الاعتماد',
  approved:         'معتمد',
  in_progress:      'قيد التنفيذ',
  resolved:         'تم الحل',
  rejected:         'مرفوض',
};

interface Props {
  currentUserId: number;
  currentUserRole: Role;
}

type FilterTab = 'all' | 'inbox' | 'sent';

export function ObstaclesView({ currentUserId, currentUserRole }: Props) {
  const { toast } = useToast();
  const [items, setItems] = useState<Obstacle[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Obstacle | null>(null);

  const isAdmin = currentUserRole === 'admin';

  const load = useCallback(async () => {
    setLoading(true);
    const url = filter === 'all' ? '/api/obstacles' : `/api/obstacles?filter=${filter}`;
    const res = await fetch(url, { cache: 'no-store' });
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  async function patchStatus(id: number, body: Record<string, unknown>) {
    const res = await fetch(`/api/obstacles/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const saved = await res.json();
      setItems(prev => prev.map(o => o.id === saved.id ? saved : o));
      toast({ title: 'تم التحديث' });
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل', description: err.error, variant: 'destructive' });
    }
  }

  async function approve(o: Obstacle) {
    const due = window.prompt('تاريخ الاستحقاق المعتمد (YYYY-MM-DD)', o.proposed_due_date ?? '');
    if (!due) return;
    await patchStatus(o.id, { status: 'approved', approved_due_date: due });
  }
  async function reject(o: Obstacle) {
    const reason = window.prompt('سبب الرفض (اختياري)', '');
    if (reason === null) return;
    await patchStatus(o.id, { status: 'rejected', rejected_reason: reason });
  }
  async function startWork(o: Obstacle)  { await patchStatus(o.id, { status: 'in_progress' }); }
  async function resolve(o: Obstacle)    { await patchStatus(o.id, { status: 'resolved' }); }

  async function deleteItem(id: number) {
    if (!confirm('حذف هذا العائق؟')) return;
    const res = await fetch(`/api/obstacles/${id}`, { method: 'DELETE' });
    if (res.ok) { setItems(prev => prev.filter(o => o.id !== id)); toast({ title: 'تم الحذف' }); }
    else toast({ title: 'فشل الحذف', variant: 'destructive' });
  }

  function exportCSV() {
    const csv = toCSV(items.map(o => ({
      id: o.id,
      project: o.project_name_ar ?? '',
      region: o.region_name_ar ?? '',
      from: o.from_user_name ?? '',
      to: o.to_user_name ?? '',
      statement: o.statement,
      request: o.request ?? '',
      notes: o.notes ?? '',
      status: STATUS_LABEL[o.status] ?? o.status,
      proposed_due: o.proposed_due_date ?? '',
      approved_due: o.approved_due_date ?? '',
      days_remaining: o.days_remaining ?? '',
      is_overdue: o.is_overdue ? 'نعم' : 'لا',
      created_at: new Date(o.created_at).toLocaleString('ar-SA'),
      resolved_at: o.resolved_at ? new Date(o.resolved_at).toLocaleString('ar-SA') : '',
    })), [
      { key: 'id',             label: 'المعرف' },
      { key: 'project',        label: 'المشروع' },
      { key: 'region',         label: 'المنطقة' },
      { key: 'from',           label: 'من' },
      { key: 'to',             label: 'إلى' },
      { key: 'statement',      label: 'البيان' },
      { key: 'request',        label: 'الطلب' },
      { key: 'notes',          label: 'الملاحظة' },
      { key: 'status',         label: 'الحالة' },
      { key: 'proposed_due',   label: 'الاستحقاق المقترح' },
      { key: 'approved_due',   label: 'الاستحقاق المعتمد' },
      { key: 'days_remaining', label: 'الأيام المتبقية' },
      { key: 'is_overdue',     label: 'متأخر' },
      { key: 'created_at',     label: 'تاريخ الإنشاء' },
      { key: 'resolved_at',    label: 'تاريخ الإغلاق' },
    ]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `obstacles-${new Date().toISOString().slice(0,10)}.csv`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: `تم تصدير ${items.length} عائق` });
  }

  // KPI counts
  const pendingApproval = items.filter(o => o.status === 'pending_approval').length;
  const inProgress      = items.filter(o => o.status === 'in_progress' || o.status === 'approved').length;
  const overdue         = items.filter(o => o.is_overdue).length;
  const resolved        = items.filter(o => o.status === 'resolved').length;

  return (
    <>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard label="بانتظار الاعتماد" value={pendingApproval} icon={ListFilter} color="gold" />
        <KpiCard label="قيد التنفيذ"      value={inProgress}      icon={Play}       color="navy" />
        <KpiCard label="متأخرة"            value={overdue}         icon={X}          color="red" />
        <KpiCard label="تم حلها"           value={resolved}        icon={CheckCircle2} color="green" />
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-5">
        <Button size="sm" variant={filter === 'all'   ? 'default' : 'secondary'} onClick={() => setFilter('all')}><ListFilter className="h-4 w-4" />الكل</Button>
        <Button size="sm" variant={filter === 'inbox' ? 'default' : 'secondary'} onClick={() => setFilter('inbox')}><Inbox className="h-4 w-4" />صادرة إليّ</Button>
        <Button size="sm" variant={filter === 'sent'  ? 'default' : 'secondary'} onClick={() => setFilter('sent')}><Send className="h-4 w-4" />أرسلتُها</Button>
        <div className="flex gap-2 mr-auto">
          <Button variant="secondary" onClick={exportCSV} title="تصدير CSV"><Download className="h-4 w-4" />تصدير</Button>
          <Button variant="secondary" onClick={() => window.print()} title="طباعة / حفظ PDF"><Printer className="h-4 w-4" />طباعة</Button>
          <Button onClick={() => { setEditing(null); setModalOpen(true); }}>
            <Plus className="h-4 w-4" /> إضافة عائق جديد
          </Button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-brand-soft text-brand-navy">
              <tr className="text-right">
                <th className="p-3 font-bold">من / إلى</th>
                <th className="p-3 font-bold">البيان</th>
                <th className="p-3 font-bold">الطلب</th>
                <th className="p-3 font-bold">الملاحظة</th>
                <th className="p-3 font-bold">الحالة</th>
                <th className="p-3 font-bold">المدة المعتمدة</th>
                <th className="p-3 font-bold">المنشأ</th>
                <th className="p-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">جارٍ التحميل...</td></tr>}
              {!loading && items.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">لا توجد عوائق</td></tr>}
              {!loading && items.map(o => {
                const isRecipient = o.to_user_id   === currentUserId;
                const isSender    = o.from_user_id === currentUserId;
                const createdAt = new Date(o.created_at).toLocaleString('ar-SA', { dateStyle: 'short', timeStyle: 'short' });
                const dueLabel  = o.approved_due_date
                  ? `${o.approved_due_date} (${o.days_remaining! >= 0 ? `بعد ${o.days_remaining} يوم` : `متأخر ${Math.abs(o.days_remaining!)} يوم`})`
                  : (o.proposed_due_date ? `مقترح: ${o.proposed_due_date}` : '—');
                return (
                  <tr key={o.id} className={`border-b border-slate-100 hover:bg-slate-50 ${o.is_overdue ? 'bg-red-50/60' : ''}`}>
                    <td className="p-3 text-xs">
                      <div><b>من:</b> {o.from_user_name} <Badge variant="secondary">{o.from_user_role}</Badge></div>
                      <div><b>إلى:</b> {o.to_user_name} <Badge variant="secondary">{o.to_user_role}</Badge></div>
                      {o.region_name_ar && <div className="text-muted-foreground">{o.region_name_ar}</div>}
                    </td>
                    <td className="p-3 font-semibold max-w-[260px]">{o.statement}</td>
                    <td className="p-3 text-xs max-w-[200px]">{o.request ?? '—'}</td>
                    <td className="p-3 text-xs max-w-[200px]">{o.notes ?? '—'}</td>
                    <td className="p-3"><ObstacleStatusBadge status={o.status} overdue={o.is_overdue} /></td>
                    <td className="p-3 text-xs whitespace-nowrap">{dueLabel}</td>
                    <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{createdAt}</td>
                    <td className="p-3">
                      <div className="flex gap-1 flex-wrap">
                        {/* Admin approves / rejects pending obstacles */}
                        {isAdmin && o.status === 'pending_approval' && (
                          <>
                            <Button size="icon" variant="ghost" title="اعتماد" onClick={() => approve(o)}><Check className="h-4 w-4 text-brand-green" /></Button>
                            <Button size="icon" variant="ghost" title="رفض"     onClick={() => reject(o)}><X className="h-4 w-4 text-brand-red" /></Button>
                          </>
                        )}
                        {/* Recipient progresses an approved obstacle */}
                        {isRecipient && o.status === 'approved' && (
                          <Button size="icon" variant="ghost" title="بدء التنفيذ" onClick={() => startWork(o)}><Play className="h-4 w-4 text-brand-teal" /></Button>
                        )}
                        {/* Recipient or admin marks resolved */}
                        {(isRecipient || isAdmin) && (o.status === 'in_progress' || o.status === 'approved') && (
                          <Button size="icon" variant="ghost" title="إنهاء" onClick={() => resolve(o)}><CheckCircle2 className="h-4 w-4 text-brand-green" /></Button>
                        )}
                        {/* Sender can edit before approval */}
                        {isSender && o.status === 'pending_approval' && (
                          <Button size="icon" variant="ghost" title="تعديل" onClick={() => { setEditing(o); setModalOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        )}
                        {(isSender || isAdmin) && (
                          <Button size="icon" variant="ghost" title="حذف" onClick={() => deleteItem(o.id)}><Trash2 className="h-4 w-4 text-brand-red" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <ObstacleModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        item={editing}
        currentUserRole={currentUserRole}
        onSaved={saved => {
          setItems(prev => editing ? prev.map(x => x.id === saved.id ? saved : x) : [saved, ...prev]);
        }}
      />
    </>
  );
}
