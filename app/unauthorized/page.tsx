import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const runtime = 'edge';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-bg p-6">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center border border-red-200">
        <div className="text-6xl mb-4">🚫</div>
        <h1 className="text-2xl font-bold text-brand-red mb-3">غير مصرح بالوصول</h1>
        <p className="text-muted-foreground mb-6 leading-relaxed">
          ليست لديك صلاحية كافية لعرض هذه الصفحة.<br/>
          تواصل مع مدير النظام إذا كنت بحاجة لصلاحية إضافية.
        </p>
        <Link href="/dashboard">
          <Button>العودة للوحة التحكم</Button>
        </Link>
      </div>
    </div>
  );
}
