// Protects every page except /login, /api/auth/*, and static assets.
// Also enforces:
//   - Unauthenticated visitor → redirect to /login
//   - User with must_change_password=1 → redirect to /account/password
//   - Non-admin trying to access /admin/* → redirect to /dashboard

import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth((req) => {
  const { pathname } = req.nextUrl;

  const isPublic =
    pathname.startsWith('/login') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname === '/favicon.ico';

  if (isPublic) return NextResponse.next();

  if (!req.auth) {
    const url = new URL('/login', req.url);
    url.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(url);
  }

  // Force password change before accessing anything except the change-password page itself + its API
  if (
    req.auth.user.mustChangePassword &&
    !pathname.startsWith('/account/password') &&
    !pathname.startsWith('/api/account/password')
  ) {
    return NextResponse.redirect(new URL('/account/password', req.url));
  }

  // Admin-only paths
  if (pathname.startsWith('/admin') && req.auth.user.role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', req.url));
  }
  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
