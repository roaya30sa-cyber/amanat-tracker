'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Send, Search } from 'lucide-react';
import type { ChatConversation, ChatMessage, Role } from '@/lib/types';
import { formatDateTimeAr } from '@/lib/utils';

const ROLE_LABEL: Record<Role, string> = {
  admin: 'مدير النظام',
  regional_manager: 'مدير منطقة',
  viewer: 'مشاهد',
};

const POLL_CONVERSATIONS_MS = 15_000;
const POLL_MESSAGES_MS      = 8_000;

export function ChatView({ currentUserId }: { currentUserId: number }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeUserId, setActiveUserId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const lastMsgTsRef = useRef<number>(0);

  // Load conversations list
  const loadConversations = useCallback(async () => {
    try {
      const r = await fetch('/api/chat/conversations', { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      setConversations(data.items ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    loadConversations();
    const t = setInterval(loadConversations, POLL_CONVERSATIONS_MS);
    return () => clearInterval(t);
  }, [loadConversations]);

  // Load messages for active conversation
  const loadMessages = useCallback(async (incremental: boolean) => {
    if (!activeUserId) return;
    try {
      const since = incremental && lastMsgTsRef.current ? `&since=${lastMsgTsRef.current}` : '';
      const r = await fetch(`/api/chat/messages?with=${activeUserId}${since}`, { cache: 'no-store' });
      if (!r.ok) return;
      const rows: ChatMessage[] = await r.json();
      if (!Array.isArray(rows) || rows.length === 0) return;
      setMessages(prev => {
        const next = incremental
          ? [...prev, ...rows.filter(m => !prev.some(x => x.id === m.id))]
          : rows;
        const lastTs = next.reduce((m, x) => Math.max(m, x.created_at), 0);
        lastMsgTsRef.current = lastTs;
        return next;
      });
      // Mark inbound messages as read
      if (rows.some(m => m.to_user_id === currentUserId)) {
        fetch('/api/chat/read', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ from_user_id: activeUserId }),
        }).then(() => loadConversations()).catch(() => {});
      }
    } catch {}
  }, [activeUserId, currentUserId, loadConversations]);

  // When conversation changes: full reload
  useEffect(() => {
    if (!activeUserId) { setMessages([]); lastMsgTsRef.current = 0; return; }
    setMessages([]); lastMsgTsRef.current = 0;
    loadMessages(false);
  }, [activeUserId, loadMessages]);

  // Poll incrementally for the active conversation
  useEffect(() => {
    if (!activeUserId) return;
    const t = setInterval(() => loadMessages(true), POLL_MESSAGES_MS);
    return () => clearInterval(t);
  }, [activeUserId, loadMessages]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!activeUserId || !draft.trim() || sending) return;
    setSending(true);
    try {
      const r = await fetch('/api/chat/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: activeUserId, body: draft.trim() }),
      });
      if (r.ok) {
        const m: ChatMessage = await r.json();
        setMessages(prev => [...prev, m]);
        lastMsgTsRef.current = Math.max(lastMsgTsRef.current, m.created_at);
        setDraft('');
        loadConversations();
      }
    } finally {
      setSending(false);
    }
  }

  const filtered = conversations.filter(c => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (c.other_username?.toLowerCase().includes(s)
         || c.other_full_name?.toLowerCase().includes(s));
  });
  const activeConv = conversations.find(c => c.other_user_id === activeUserId);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex h-[calc(100vh-200px)] min-h-[500px]">
      {/* Conversations list */}
      <aside className="w-72 border-l border-slate-200 flex flex-col bg-slate-50/50">
        <div className="p-3 border-b border-slate-200">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث عن مستخدم..."
              className="w-full pr-8 pl-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-brand-navy"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">لا يوجد مستخدمون</div>
          )}
          {filtered.map(c => {
            const active = c.other_user_id === activeUserId;
            const displayName = c.other_full_name ?? c.other_username;
            const initial = (displayName ?? '?').charAt(0);
            const preview = c.last_message
              ? (c.last_message_from_me ? 'أنت: ' : '') + c.last_message
              : '— لا توجد رسائل —';
            const when = c.last_message_at
              ? formatDateTimeAr(c.last_message_at)
              : '';
            return (
              <button
                key={c.other_user_id}
                onClick={() => setActiveUserId(c.other_user_id)}
                className={`w-full text-right p-3 border-b border-slate-100 transition-colors ${active ? 'bg-brand-soft' : 'hover:bg-white'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold">
                    {initial}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <div className="font-bold text-sm text-brand-navy truncate">{displayName}</div>
                      <div className="text-[10px] text-muted-foreground shrink-0">{when}</div>
                    </div>
                    <div className="text-[11px] text-muted-foreground truncate">{ROLE_LABEL[c.other_role]}</div>
                    <div className="text-xs text-muted-foreground truncate mt-0.5">{preview}</div>
                  </div>
                  {c.unread_count > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 rounded-full bg-brand-red text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                      {c.unread_count > 99 ? '99+' : c.unread_count}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </aside>

      {/* Message thread */}
      <section className="flex-1 flex flex-col">
        {!activeUserId && (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            اختر مستخدماً من القائمة لبدء محادثة
          </div>
        )}
        {activeUserId && activeConv && (
          <>
            <header className="px-5 py-3 border-b border-slate-200 bg-white flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-navy text-white flex items-center justify-center font-bold">
                {(activeConv.other_full_name ?? activeConv.other_username).charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-brand-navy">{activeConv.other_full_name ?? activeConv.other_username}</div>
                <div className="text-xs text-muted-foreground">{ROLE_LABEL[activeConv.other_role]}</div>
              </div>
            </header>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 bg-slate-50/40 space-y-2.5">
              {messages.length === 0 && (
                <div className="text-center text-sm text-muted-foreground py-10">ابدأ المحادثة برسالة جديدة</div>
              )}
              {messages.map(m => {
                const mine = m.from_user_id === currentUserId;
                const when = formatDateTimeAr(m.created_at);
                return (
                  <div key={m.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                    <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${mine ? 'bg-brand-navy text-white' : 'bg-white border border-slate-200'}`}>
                      <div className="whitespace-pre-wrap break-words">{m.body}</div>
                      <div className={`text-[10px] mt-1 ${mine ? 'text-white/60' : 'text-muted-foreground'}`}>{when}</div>
                    </div>
                  </div>
                );
              })}
            </div>

            <form onSubmit={send} className="px-4 py-3 border-t border-slate-200 bg-white flex items-end gap-2">
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(e); }
                }}
                placeholder="اكتب رسالة... (Enter للإرسال، Shift+Enter لسطر جديد)"
                rows={1}
                className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-xl resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-brand-navy"
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className="h-10 w-10 shrink-0 flex items-center justify-center rounded-full bg-brand-navy text-white hover:bg-brand-navy/90 disabled:opacity-50 transition-colors"
                aria-label="إرسال"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
