// Centralised access-control helpers — every API route + server action funnels through these.

import { auth } from './auth';
import { NextResponse } from 'next/server';
import type { Session } from 'next-auth';

export type AuthorizedSession = NonNullable<Awaited<ReturnType<typeof auth>>> & {
  user: NonNullable<Session['user']>;
};

/** Returns the session or throws an unauthorised response. */
export async function requireSession(): Promise<AuthorizedSession> {
  const session = await auth();
  if (!session?.user) {
    throw NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  return session as AuthorizedSession;
}

/** Returns the session or throws if user isn't admin. */
export async function requireAdmin(): Promise<AuthorizedSession> {
  const session = await requireSession();
  if (session.user.role !== 'admin') {
    throw NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
  return session;
}

/**
 * Region scope filter. Admins => null (no filter). Others => their region_id.
 * Use in SQL like:  `WHERE 1=1 ${scope ? 'AND region_id = ?' : ''}` and bind scope when present.
 */
export function regionScope(session: AuthorizedSession): number | null {
  if (session.user.role === 'admin') return null;
  return session.user.regionId ?? -1;   // -1 ensures non-admin without region sees nothing
}

/**
 * Enforce that the given region_id is allowed for this user.
 * Throws a 403 response if not.
 */
export function assertRegionAccess(session: AuthorizedSession, regionId: number): void {
  if (session.user.role === 'admin') return;
  if (session.user.regionId !== regionId) {
    throw NextResponse.json({ error: 'forbidden: region mismatch' }, { status: 403 });
  }
}

/** Helper used inside route handlers: catches the thrown NextResponse and returns it. */
export function handleAccess<T>(fn: () => Promise<T>): Promise<T | Response> {
  return fn().catch((e: unknown) => {
    if (e instanceof Response) return e;
    console.error(e);
    return NextResponse.json({ error: 'internal error' }, { status: 500 });
  });
}
