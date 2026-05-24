import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { CircularsView } from '@/components/circulars/CircularsView';

export const runtime = 'edge';

export default async function CircularsPage() {
  const session = (await auth())!;
  return (
    <AppShell title="📢 التعاميم">
      <CircularsView
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </AppShell>
  );
}
