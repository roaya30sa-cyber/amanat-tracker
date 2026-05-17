'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Lock, AlertCircle } from 'lucide-react';

export function LoginForm({ errorParam }: { errorParam?: string }) {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(errorParam ? mapError(errorParam) : null);

  function mapError(err: string): string {
    if (err === 'CredentialsSignin') return 'اسم المستخدم أو كلمة المرور غير صحيحة';
    return 'حدث خطأ — تأكد من بياناتك أو تواصل مع مدير النظام';
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const res = await signIn('credentials', {
        username: username.trim(),
        password,
        redirect: false,
      });
      if (res?.ok) {
        const callbackUrl = params.get('callbackUrl') ?? '/dashboard';
        router.push(callbackUrl);
        router.refresh();
      } else {
        setError(mapError(res?.error ?? ''));
      }
    } catch (e: any) {
      setError('تعذر الاتصال بالخادم');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 text-right">
      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div>
        <Label htmlFor="username">اسم المستخدم</Label>
        <div className="relative mt-1">
          <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="username"
            name="username"
            type="text"
            autoComplete="username"
            dir="ltr"
            required
            disabled={loading}
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="username"
            className="pr-10 text-left"
          />
        </div>
      </div>

      <div>
        <Label htmlFor="password">كلمة المرور</Label>
        <div className="relative mt-1">
          <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            disabled={loading}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="pr-10"
          />
        </div>
      </div>

      <Button type="submit" size="lg" className="w-full h-12 text-base" disabled={loading}>
        {loading ? 'جاري التحقق…' : 'تسجيل الدخول'}
      </Button>
    </form>
  );
}
