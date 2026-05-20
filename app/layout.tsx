import type { Metadata } from 'next';
import { Tajawal } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/toaster';
import { Providers } from '@/components/Providers';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-tajawal',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'HLB — أداة متابعة أعمال مشاريع الأمانة',
  description: 'المحاسبون الدوليون — نظام إدارة المشاريع الإقليمية: منطقة جازان · المنطقة الشرقية · الحدود الشمالية',
  icons: {
    icon: [
      { url: '/logo.png', type: 'image/png' },
    ],
  },
};

export const runtime = 'edge';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={tajawal.variable}>
      <body className="font-sans antialiased min-h-screen bg-brand-bg">
        <Providers>
          {children}
          <Toaster />
        </Providers>
      </body>
    </html>
  );
}
