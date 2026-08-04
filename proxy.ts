import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifySessionToken } from './lib/auth';

export default async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Define route categories
  const isPublicRoute = pathname === '/login' || pathname.startsWith('/api/auth');
  const isAdminRoute = 
    pathname.startsWith('/auction') || 
    pathname.startsWith('/admin') || 
    pathname.startsWith('/api/admin') ||
    pathname.startsWith('/api/auction') ||
    pathname.startsWith('/api/import') ||
    pathname.startsWith('/api/export');
  
  // Note: /api/scrape can be considered internal/admin but let's allow any logged in user if needed, 
  // or just treat it as admin only. Since directory uses it, let's treat it as Owner+.
  const isOwnerRoute = 
    pathname.startsWith('/directory') || 
    pathname.startsWith('/teams') || 
    pathname.startsWith('/api/scrape');

  // Root redirect
  if (pathname === '/') {
    return NextResponse.redirect(new URL('/directory', req.url));
  }

  // If the route doesn't match our protected list, just let it pass (e.g. static assets)
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
      if (session.role === 'admin') {
        return NextResponse.redirect(new URL('/auction', req.url));
      }
      return NextResponse.redirect(new URL('/directory', req.url));
    }
    return NextResponse.next();
  }

  // 4. Handle Unauthenticated Requests
  if (!session) {
    // If it's an API request, return 401
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    // If it's a page request, redirect to login
    return NextResponse.redirect(new URL('/login', req.url));
  }

  // 5. Handle Authorization (Role Checks)
  if (isAdminRoute && session.role !== 'admin') {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.redirect(new URL('/directory', req.url)); // Send owners to directory
  }

  // If we reach here, user is authorized
  return NextResponse.next();
}

export const config = {
  // Apply middleware to all routes except static files, Next.js internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
