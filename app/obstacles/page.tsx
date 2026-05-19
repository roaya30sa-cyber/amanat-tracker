import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { ObstaclesView } from '@/components/obstacles/ObstaclesView';

export const runtime = 'edge';

export default async function ObstaclesPage() {
  const session = (await auth())!;
  return (
    <AppShell title="🚧 العوائق التشغيلية">
      <ObstaclesView
        currentUserId={session.user.id}
        currentUserRole={session.user.role}
      />
    </AppShell>
  );
}
