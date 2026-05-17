import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { ChangePasswordForm } from './ChangePasswordForm';

export const runtime = 'edge';

export default async function ChangePasswordPage() {
  const session = await auth();
  if (!session?.user) redirect('/login');

  return (
    <AppShell title="🔑 تغيير كلمة المرور">
      <div className="max-w-xl">
        {session.user.mustChangePassword && (
          <div className="mb-5 p-4 bg-amber-50 border-r-4 border-amber-400 rounded-lg">
            <p className="font-bold text-amber-900">يجب عليك تغيير كلمة المرور قبل المتابعة</p>
            <p className="text-sm text-amber-800 mt-1">هذه أول مرة تسجل دخولك، أو قام مدير النظام بإعادة تعيين كلمتك.</p>
          </div>
        )}
        <ChangePasswordForm username={session.user.username} />
      </div>
    </AppShell>
  );
}
