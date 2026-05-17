import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default:     'bg-brand-navy text-white',
        secondary:   'bg-brand-soft text-foreground',
        destructive: 'bg-red-100 text-red-800',
        success:     'bg-emerald-100 text-emerald-800',
        warning:     'bg-amber-100 text-amber-800',
        info:        'bg-blue-100 text-blue-800',
        outline:     'border text-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
export { Badge, badgeVariants };
