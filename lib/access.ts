// Centralised access-control helpers — every API route + server action funnels through these.

import { auth } from './auth';
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { Session } from 'next-auth';

export type AuthorizedSession = NonNullable<Awaited<ReturnType<typeof auth>>> & {
  user: NonNullable<Session['user']>;
};

export const PROJECT_COOKIE = 'amanat_active_project';

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

/**
 * Project scope filter.
 * - Admins read the `amanat_active_project` cookie. Empty cookie / "all" => no scope (sees every project).
 * - Region managers / viewers are pinned to their assigned project_id (or -1 if unset → sees nothing).
 *
 * Use in SQL like: `WHERE 1=1 ${scope !== null ? 'AND project_id = ?' : ''}` and bind scope when present.
 */
export function projectScope(session: AuthorizedSession): number | null {
  if (session.user.role === 'admin') {
    const cookieValue = cookies().get(PROJECT_COOKIE)?.value;
    if (!cookieValue || cookieValue === 'all') return null;
    const parsed = parseInt(cookieValue, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  return session.user.projectId ?? -1;
}

/**
 * Returns the project_id the user is writing under.
 * - For non-admins this is their pinned project (required).
 * - For admins this falls back to the active-project cookie. If they're in "all projects" mode and
 *   try to create something, callers must pass an explicit project_id in the body.
 */
export function writeProjectId(session: AuthorizedSession, bodyProjectId?: number | null): number {
  if (session.user.role !== 'admin') {
    if (!session.user.projectId) {
      throw NextResponse.json({ error: 'no project assigned to user' }, { status: 403 });
    }
    return session.user.projectId;
  }
  // Admin path
  if (bodyProjectId && Number.isFinite(bodyProjectId) && bodyProjectId > 0) return bodyProjectId;
  const scope = projectScope(session);
  if (scope) return scope;
  throw NextResponse.json({ error: 'project_id required when admin is in "all projects" mode' }, { status: 400 });
}

/**
 * Enforce that the given project_id is allowed for this user.
 * Admins can touch any project; others must match their pinned project.
 */
export function assertProjectAccess(session: AuthorizedSession, projectId: number): void {
  if (session.user.role === 'admin') return;
  if (session.user.projectId !== projectId) {
    throw NextResponse.json({ error: 'forbidden: project mismatch' }, { status: 403 });
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

/**
 * Composes a SQL WHERE clause from optional region + project scopes.
 * Returns the clause (starting with WHERE if any conditions exist) plus the bind values in order.
 * Pass the column-qualifier prefix (e.g. 't' for `t.region_id`).
 */
export function buildScopeClause(opts: {
  regionScope?: number | null;
  projectScope?: number | null;
  qRegionId?: string | null;   // raw query-string override for admins
  qProjectId?: string | null;
  prefix?: string;             // SQL table alias, e.g. 't'
}): { where: string; binds: any[] } {
  const p = opts.prefix ? `${opts.prefix}.` : '';
  const conds: string[] = [];
  const binds: any[] = [];

  // Region
  if (opts.regionScope !== undefined && opts.regionScope !== null) {
    conds.push(`${p}region_id = ?`);
    binds.push(opts.regionScope);
  } else if (opts.qRegionId) {
    const v = parseInt(opts.qRegionId, 10);
    if (Number.isFinite(v) && v > 0) { conds.push(`${p}region_id = ?`); binds.push(v); }
  }

  // Project
  if (opts.projectScope !== undefined && opts.projectScope !== null) {
    conds.push(`${p}project_id = ?`);
    binds.push(opts.projectScope);
  } else if (opts.qProjectId) {
    const v = parseInt(opts.qProjectId, 10);
    if (Number.isFinite(v) && v > 0) { conds.push(`${p}project_id = ?`); binds.push(v); }
  }

  return {
    where: conds.length ? 'WHERE ' + conds.join(' AND ') : '',
    binds,
  };
}
