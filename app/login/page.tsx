import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from './LoginForm';

export const runtime = 'edge';

export default async function LoginPage({ searchParams }: { searchParams: { error?: string } }) {
  const session = await auth();
  if (session?.user) redirect('/dashboard');

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-brand-navy to-brand-teal p-6">
      <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-md w-full text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="المحاسبون الدوليون HLB"
          className="mx-auto mb-5 h-20 w-auto object-contain"
        />
        <h1 className="text-2xl font-bold text-brand-navy mb-2">أداة متابعة أعمال مشاريع الأمانة</h1>
        <p className="text-muted-foreground text-sm mb-7 leading-relaxed">
          نظام إدارة المشاريع الإقليمية<br/>
          منطقة جازان · المنطقة الشرقية · الحدود الشمالية
        </p>

        <LoginForm errorParam={searchParams.error} />

        <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
          اسم المستخدم وكلمة المرور يحددهما مدير النظام.<br/>
          للحصول على بيانات الدخول، تواصل مع المدير.
        </p>
      </div>
    </div>
  );
}
