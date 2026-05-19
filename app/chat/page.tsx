import { AppShell } from '@/components/layout/AppShell';
import { auth } from '@/lib/auth';
import { ChatView } from '@/components/chat/ChatView';

export const runtime = 'edge';

export default async function ChatPage() {
  const session = (await auth())!;
  return (
    <AppShell title="💬 المحادثات">
      <ChatView currentUserId={session.user.id} />
    </AppShell>
  );
}
