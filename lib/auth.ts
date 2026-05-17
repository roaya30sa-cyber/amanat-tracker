// Auth.js v5 (next-auth@beta) — Username/Password authentication backed by D1.
//
// Users are provisioned by the admin via /admin/users. On login we:
//   1) look up the user by username (case-insensitive)
//   2) verify the password against the PBKDF2 hash stored in `users.password_hash`
//   3) reject if account is inactive
// On success the JWT carries id, role, regionId, regionCode, and must_change_password.

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { getDB } from './db';
import { verifyPassword } from './password';
import type { Role } from './types';

declare module 'next-auth' {
  interface Session {
    user: {
      id: number;
      username: string;
      role: Role;
      regionId: number | null;
      regionCode: string | null;
      mustChangePassword: boolean;
      name?: string | null;
      email?: string | null;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    uid?: number;
    username?: string;
    role?: Role;
    regionId?: number | null;
    regionCode?: string | null;
    mustChangePassword?: boolean;
    fullName?: string | null;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: 'username/password',
      credentials: {
        username: { label: 'اسم المستخدم', type: 'text' },
        password: { label: 'كلمة المرور', type: 'password' },
      },
      async authorize(credentials) {
        const username = String(credentials?.username ?? '').trim();
        const password = String(credentials?.password ?? '');
        if (!username || !password) return null;

        try {
          const db = getDB();
          const row = await db
            .prepare(
              `SELECT u.id, u.username, u.password_hash, u.full_name, u.email,
                      u.role, u.region_id, u.must_change_password, u.is_active,
                      r.code AS region_code
                 FROM users u
                 LEFT JOIN regions r ON r.id = u.region_id
                WHERE LOWER(u.username) = LOWER(?)`
            )
            .bind(username)
            .first<{
              id: number; username: string; password_hash: string; full_name: string | null; email: string | null;
              role: Role; region_id: number | null; must_change_password: number; is_active: number;
              region_code: string | null;
            }>();

          if (!row) return null;
          if (!row.is_active) return null;

          const ok = await verifyPassword(password, row.password_hash);
          if (!ok) return null;

          // Touch last_login_at (best-effort — don't fail login if this errors)
          db.prepare(`UPDATE users SET last_login_at = ? WHERE id = ?`).bind(Date.now(), row.id).run().catch(() => {});

          return {
            id: String(row.id),
            name: row.full_name ?? row.username,
            email: row.email ?? null,
            // Custom fields carried into the JWT via the `jwt` callback below
            uid: row.id,
            username: row.username,
            role: row.role,
            regionId: row.region_id,
            regionCode: row.region_code,
            mustChangePassword: !!row.must_change_password,
          } as any;
        } catch (e) {
          console.error('authorize failed', e);
          return null;
        }
      },
    }),
  ],
  session: { strategy: 'jwt', maxAge: 60 * 60 * 8 }, // 8h session
  pages: { signIn: '/login', error: '/login' },
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        const u = user as any;
        token.uid                = u.uid;
        token.username           = u.username;
        token.role               = u.role;
        token.regionId           = u.regionId;
        token.regionCode         = u.regionCode;
        token.mustChangePassword = u.mustChangePassword;
        token.fullName           = u.name;
      }
      // Allow client-triggered session updates (e.g., after a password change clears must_change_password)
      if (trigger === 'update' && session) {
        if (typeof session.mustChangePassword === 'boolean') token.mustChangePassword = session.mustChangePassword;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.uid) {
        session.user = {
          id: token.uid,
          username: token.username ?? '',
          role: (token.role ?? 'viewer') as Role,
          regionId: token.regionId ?? null,
          regionCode: token.regionCode ?? null,
          mustChangePassword: !!token.mustChangePassword,
          name: token.fullName ?? null,
          email: session.user?.email ?? null,
        };
      }
      return session;
    },
  },
  trustHost: true,
});
