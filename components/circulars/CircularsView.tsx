'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Plus, Inbox, Send, Megaphone, AlertTriangle, CheckCircle2, Pencil, Archive, ListFilter } from 'lucide-react';
import type { Circular, Role } from '@/lib/types';
import { CircularCreateModal } from './CircularCreateModal';
import { CircularDetail } from './CircularDetail';
import { KpiCard } from '@/components/dashboard/KpiCard';
import { formatDateTimeAr, formatDateAr } from '@/lib/utils';

interface Props {
  currentUserId: number;
  currentUserRole: Role;
}

export function CircularsView({ currentUserId, currentUserRole }: Props) {
  const { toast } = useToast();
  const isAdmin = currentUserRole === 'admin';
  const [items, setItems] = useState<Circular[]>([]);
  const [tab, setTab] = useState<'inbox' | 'sent' | 'all'>(isAdmin ? 'all' : 'inbox');
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const filter = tab === 'all' ? '' : `?filter=${tab}`;
    try {
      const r = await fetch(`/api/circulars${filter}`, { cache: 'no-store' });
      if (!r.ok) {
        const e = (await r.json().catch(() => ({}))) as { error?: string };
        toast({ title: 'فشل التحميل', description: e.error, variant: 'destructive' });
        setItems([]);
      } else {
        setItems(await r.json());
      }
    } finally {
      setLoading(false);
    }
  }, [tab, toast]);

  useEffect(() => { load(); }, [load]);

  // KPI counts
  const stats = useMemo(() => {
    const myPending = items.filter(c => c.is_my_recipient && !c.my_acknowledged_at).length;
    const myOverdue = items.filter(c => c.is_my_overdue).length;
    const sentPending = items.filter(c => c.created_by === currentUserId
      && (c.acknowledged_count ?? 0) < (c.total_recipients ?? 0)).length;
    const sentComplete = items.filter(c => c.created_by === currentUserId
      && (c.total_recipients ?? 0) > 0 && c.acknowledged_count === c.total_recipients).length;
    return { myPending, myOverdue, sentPending, sentComplete };
  }, [items, currentUserId]);

  function onCircularCreated(c: Circular) {
    setItems(prev => [c, ...prev]);
    setCreateOpen(false);
    toast({ title: 'تم إرسال التعميم', description: `إلى ${c.total_recipients} مستلم` });
  }

  function onCircularChanged(c: Circular) {
    setItems(prev => prev.map(x => x.id === c.id ? { ...x, ...c } : x));
  }

  function onCircularArchived(id: number) {
    setItems(prev => prev.filter(c => c.id !== id));
    setSelectedId(null);
    toast({ title: 'تم أرشفة التعميم' });
  }

  function onAcknowledged(id: number, acknowledgedAt: number) {
    setItems(prev => prev.map(c => c.id === id
      ? { ...c, my_acknowledged_at: acknowledgedAt, acknowledged_count: (c.acknowledged_count ?? 0) + 1, is_my_overdue: false }
      : c));
    toast({ title: '✓ تم تأكيد الاستلام' });
  }

  if (selectedId !== null) {
    return (
      <CircularDetail
        circularId={selectedId}
        currentUserId={currentUserId}
        currentUserRole={currentUserRole}
        onBack={() => setSelectedId(null)}
        onChanged={onCircularChanged}
        onArchived={() => onCircularArchived(selectedId)}
        onAcknowledged={(at) => onAcknowledged(selectedId, at)}
      />
    );
  }

  return (
    <>
      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {isAdmin ? (
          <>
            <KpiCard label="تعاميم بانتظار التأكيد"  value={stats.sentPending}  icon={Megaphone}    color="gold" />
            <KpiCard label="تعاميم مكتملة"            value={stats.sentComplete} icon={CheckCircle2} color="green" />
            <KpiCard label="بانتظار تأكيدي"           value={stats.myPending}    icon={Inbox}        color="navy" />
            <KpiCard label="متأخرة عن التأكيد"        value={stats.myOverdue}    icon={AlertTriangle} color="red" />
          </>
        ) : (
          <>
            <KpiCard label="بانتظار تأكيدي"           value={stats.myPending}    icon={Inbox}        color="navy" />
            <KpiCard label="متأخرة عن التأكيد"        value={stats.myOverdue}    icon={AlertTriangle} color="red" />
            <KpiCard label="إجمالي التعاميم الواردة" value={items.length}        icon={Megaphone}    color="purple" />
            <KpiCard label="تم تأكيدها"               value={items.filter(c => c.my_acknowledged_at).length} icon={CheckCircle2} color="green" />
          </>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <ListFilter className="h-4 w-4 text-muted-foreground" />
            <button onClick={() => setTab('inbox')} className={`px-3 py-1.5 text-sm rounded-lg font-bold ${tab === 'inbox' ? 'bg-brand-navy text-white' : 'text-muted-foreground hover:bg-slate-100'}`}>
              <span className="inline-flex items-center gap-1.5"><Inbox className="h-4 w-4" /> الواردة</span>
            </button>
            {isAdmin && (
              <button onClick={() => setTab('sent')} className={`px-3 py-1.5 text-sm rounded-lg font-bold ${tab === 'sent' ? 'bg-brand-navy text-white' : 'text-muted-foreground hover:bg-slate-100'}`}>
                <span className="inline-flex items-center gap-1.5"><Send className="h-4 w-4" /> المُرسَلة</span>
              </button>
            )}
            <button onClick={() => setTab('all')} className={`px-3 py-1.5 text-sm rounded-lg font-bold ${tab === 'all' ? 'bg-brand-navy text-white' : 'text-muted-foreground hover:bg-slate-100'}`}>
              الكل
            </button>
          </div>
          {isAdmin && (
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> تعميم جديد
            </Button>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-muted-foreground">جاري التحميل...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-3 opacity-30" />
            لا توجد تعاميم
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {items.map(c => {
              const isPending = c.is_my_recipient && !c.my_acknowledged_at;
              const total = c.total_recipients ?? 0;
              const acked = c.acknowledged_count ?? 0;
              const pct = total ? Math.round((acked / total) * 100) : 0;
              return (
                <li key={c.id}>
                  <button
                    onClick={() => setSelectedId(c.id)}
                    className={`w-full text-right p-4 hover:bg-slate-50 transition-colors ${c.is_my_overdue ? 'bg-red-50/40' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-bold text-brand-navy truncate">{c.title}</h3>
                          {c.is_my_overdue && <Badge variant="destructive">متأخر عن التأكيد</Badge>}
                          {isPending && !c.is_my_overdue && <Badge variant="warning">بانتظار تأكيدك</Badge>}
                          {c.my_acknowledged_at && <Badge variant="success">تم التأكيد</Badge>}
                          {c.status === 'archived' && <Badge variant="secondary">مؤرشف</Badge>}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">{c.body}</p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
                          <span>المُرسِل: <b>{c.created_by_name ?? '—'}</b></span>
                          <span>أُرسل: {formatDateTimeAr(c.created_at)}</span>
                          {c.ack_deadline && <span>الموعد النهائي: {formatDateAr(c.ack_deadline)}</span>}
                          {c.project_name_ar && <span>🏢 {c.project_name_ar}</span>}
                        </div>
                      </div>
                      <div className="text-left min-w-[160px]">
                        <div className="text-xs text-muted-foreground mb-1">المؤكدون</div>
                        <div className="font-bold text-sm">{acked} / {total}</div>
                        <div className="w-32 h-2 bg-slate-200 rounded-full mt-1 overflow-hidden">
                          <div
                            className={`h-full ${pct === 100 ? 'bg-brand-green' : 'bg-brand-teal'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {createOpen && (
        <CircularCreateModal
          open={createOpen}
          onOpenChange={setCreateOpen}
          onCreated={onCircularCreated}
        />
      )}
    </>
  );
}
