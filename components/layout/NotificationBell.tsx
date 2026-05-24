'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, Check } from 'lucide-react';
import type { Notification as AppNotification } from '@/lib/types';
import { formatDateTimeAr } from '@/lib/utils';

const POLL_MS = 30_000;

const KIND_LABEL: Record<string, string> = {
  obstacle_new:         '🆕',
  obstacle_approved:    '✅',
  obstacle_rejected:    '❌',
  obstacle_in_progress: '▶️',
  obstacle_resolved:    '🎉',
  obstacle_overdue:     '⏰',
  // Circulars
  circular_new:        '📢',
  circular_updated:    '✏️',
  circular_reminder:   '⏰',
  circular_overdue:    '🔴',
  circular_all_acked:  '✅',
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/notifications?limit=30', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      setItems(data.items ?? []);
      setUnread(data.unread_count ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  async function markRead(id: number) {
    await fetch(`/api/notifications/${id}/read`, { method: 'POST' });
    setItems(prev => prev.map(n => n.id === id ? { ...n, is_read: 1 } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }
  async function markAllRead() {
    await fetch('/api/notifications/read-all', { method: 'POST' });
    setItems(prev => prev.map(n => ({ ...n, is_read: 1 as const })));
    setUnread(0);
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="relative p-2 rounded-full hover:bg-slate-100 transition-colors"
        aria-label="التنبيهات"
      >
        <Bell className="h-5 w-5 text-brand-navy" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 mt-2 w-96 max-w-[90vw] bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <h3 className="font-bold text-sm text-brand-navy">التنبيهات</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs text-brand-teal hover:underline flex items-center gap-1">
                <Check className="h-3 w-3" /> تحديد الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && (
              <div className="p-6 text-center text-sm text-muted-foreground">لا توجد تنبيهات</div>
            )}
            {items.map(n => {
              const when = formatDateTimeAr(n.created_at);
              const href = n.circular_id ? '/circulars' : '/obstacles';
              return (
                <Link
                  key={n.id}
                  href={href}
                  onClick={() => { if (!n.is_read) markRead(n.id); setOpen(false); }}
                  className={`block px-4 py-3 border-b border-slate-100 hover:bg-slate-50 transition-colors ${n.is_read ? 'opacity-70' : 'bg-brand-soft/30'}`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-lg leading-none mt-0.5">{KIND_LABEL[n.kind] ?? '🔔'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-sm text-brand-navy">{n.title}</div>
                      {n.body && <div className="text-xs text-muted-foreground truncate">{n.body}</div>}
                      <div className="text-[10px] text-muted-foreground mt-1">{when}</div>
                    </div>
                    {!n.is_read && <span className="w-2 h-2 rounded-full bg-brand-teal shrink-0 mt-1.5" aria-label="غير مقروء" />}
                  </div>
                </Link>
              );
            })}
          </div>
          <div className="p-2 border-t border-slate-100 bg-slate-50">
            <Link href="/obstacles" onClick={() => setOpen(false)} className="block text-center text-xs text-brand-teal hover:underline py-1">
              فتح صفحة العوائق التشغيلية
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
