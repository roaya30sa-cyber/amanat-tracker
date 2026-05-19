import { Badge } from '@/components/ui/badge';
import type { ObstacleStatus } from '@/lib/types';

const LABELS: Record<ObstacleStatus, string> = {
  pending_approval: 'بانتظار الاعتماد',
  approved:         'معتمد',
  in_progress:      'قيد التنفيذ',
  resolved:         'تم الحل',
  rejected:         'مرفوض',
};

const VARIANTS: Record<ObstacleStatus, 'warning' | 'info' | 'secondary' | 'success' | 'destructive'> = {
  pending_approval: 'warning',
  approved:         'info',
  in_progress:      'secondary',
  resolved:         'success',
  rejected:         'destructive',
};

export function ObstacleStatusBadge({ status, overdue }: { status: ObstacleStatus; overdue?: boolean }) {
  if (overdue) return <Badge variant="destructive">⚠ متأخر</Badge>;
  return <Badge variant={VARIANTS[status]}>{LABELS[status]}</Badge>;
}
