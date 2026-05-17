import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface KpiCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: 'navy' | 'green' | 'gold' | 'red' | 'teal' | 'purple';
}

const COLOR_MAP: Record<KpiCardProps['color'], { bar: string; text: string; bg: string }> = {
  navy:   { bar: 'before:bg-brand-navy',   text: 'text-brand-navy',   bg: 'bg-blue-50/40' },
  green:  { bar: 'before:bg-brand-green',  text: 'text-brand-green',  bg: 'bg-emerald-50/40' },
  gold:   { bar: 'before:bg-brand-gold',   text: 'text-brand-gold',   bg: 'bg-amber-50/40' },
  red:    { bar: 'before:bg-brand-red',    text: 'text-brand-red',    bg: 'bg-red-50/40' },
  teal:   { bar: 'before:bg-brand-teal',   text: 'text-brand-teal',   bg: 'bg-teal-50/40' },
  purple: { bar: 'before:bg-brand-purple', text: 'text-brand-purple', bg: 'bg-purple-50/40' },
};

export function KpiCard({ label, value, icon: Icon, color }: KpiCardProps) {
  const c = COLOR_MAP[color];
  return (
    <div className={cn(
      'relative overflow-hidden bg-white rounded-2xl p-5 border border-slate-200 shadow-sm',
      'before:content-[""] before:absolute before:top-0 before:right-0 before:w-1 before:h-full',
      c.bar
    )}>
      <Icon className={cn('absolute top-4 left-4 h-7 w-7 opacity-20', c.text)} />
      <div className="text-sm text-muted-foreground font-medium mb-2">{label}</div>
      <div className={cn('text-3xl lg:text-4xl font-extrabold leading-none', c.text)}>{value}</div>
    </div>
  );
}
