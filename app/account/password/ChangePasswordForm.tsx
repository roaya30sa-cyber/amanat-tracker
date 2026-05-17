'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';

export function ChangePasswordForm({ username }: { username: string }) {
  const router = useRouter();
  const { update } = useSession();
  const { toast } = useToast();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (next.length < 8) { toast({ title: 'كلمة المرور قصيرة', description: '8 أحرف على الأقل', variant: 'destructive' }); return; }
    if (next !== confirm) { toast({ title: 'كلمتا المرور غير متطابقتين', variant: 'destructive' }); return; }
    setSaving(true);
    const res = await fetch('/api/account/password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: current, new_password: next }),
    });
    setSaving(false);
    if (res.ok) {
      toast({ title: 'تم تغيير كلمة المرور بنجاح' });
      await update({ mustChangePassword: false });
      setCurrent(''); setNext(''); setConfirm('');
      router.push('/dashboard');
      router.refresh();
    } else {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      toast({ title: 'فشل التغيير', description: err.error ?? 'تأكد من كلمة المرور الحالية', variant: 'destructive' });
    }
  }

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6">
      <p className="text-sm text-muted-foreground mb-5">
        المستخدم: <span dir="ltr" className="font-mono font-bold text-brand-navy">{username}</span>
      </p>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="cur">كلمة المرور الحالية</Label>
          <Input id="cur" type="password" required className="mt-1" value={current} onChange={e => setCurrent(e.target.value)} autoComplete="current-password" />
        </div>
        <div>
          <Label htmlFor="new">كلمة المرور الجديدة</Label>
          <Input id="new" type="password" required minLength={8} className="mt-1" value={next} onChange={e => setNext(e.target.value)} autoComplete="new-password" />
          <p className="text-xs text-muted-foreground mt-1">8 أحرف على الأقل، يُفضّل خلط الحروف والأرقام والرموز</p>
        </div>
        <div>
          <Label htmlFor="conf">تأكيد كلمة المرور الجديدة</Label>
          <Input id="conf" type="password" required minLength={8} className="mt-1" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
        </div>
        <Button type="submit" disabled={saving}>{saving ? 'جاري الحفظ…' : 'حفظ كلمة المرور الجديدة'}</Button>
      </form>
    </div>
  );
}
