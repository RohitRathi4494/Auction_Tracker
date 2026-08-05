import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Define route categories
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/api/auth');
  const isAdminRoute =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/import') ||
    pathname.startsWith('/api/export');

  const isOwnerRoute =
    pathname.startsWith('/directory') ||
    pathname.startsWith('/wishlist') ||
    pathname.startsWith('/squad') ||
    pathname.startsWith('/teams') ||
    pathname.startsWith('/api/players') ||
    pathname.startsWith('/api/teams') ||
    pathname.startsWith('/api/wishlist') ||
    pathname.startsWith('/api/squad') ||
    pathname.startsWith('/api/scrape');

  // Root redirect → directory for all logged-in users
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/directory', req.url));
  }

  // Old auction routes → redirect to directory
  if (pathname.startsWith('/auction') || pathname.startsWith('/api/auction')) {
    return NextResponse.redirect(new URL('/directory', req.url));
  }

  // If the route doesn't match our protected list, just let it pass (static assets etc.)
  if (!isAdminRoute && !isOwnerRoute && !isPublicRoute) {
    return NextResponse.next();
  }

  // 2. Extract and verify session token
  const token = req.cookies.get('session')?.value;
  let session = null;
  if (token) {
    session = await verifySessionToken(token);
  }

  // 3. Handle Public Routes (Login page)
  if (isPublicRoute) {
    // Redirect away from login if already logged in
    if (session && pathname === '/login') {
      return NextResponse.redirect(new URL('/directory', req.url));
    }
    return NextResponse.next();
  }

  // 4. Handle Unauthenticated Requests
  if (!session) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 5. Handle Authorization (Role Checks — admin-only routes)
  if (isAdminRoute && session.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/directory', req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
