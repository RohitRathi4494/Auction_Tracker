import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { signSessionToken } from '@/lib/auth';
import { verifyPassword } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
    }

    const adminPassword = process.env.ADMIN_PASSWORD;

    // ─── 1. Admin Login (Superuser) ──────────────────────────────────────────
    if (username.toLowerCase() === 'admin') {
      if (!adminPassword || password !== adminPassword) {
        return NextResponse.json({ error: 'Invalid admin credentials' }, { status: 401 });
      }

      // Generate JWT for Admin
      const token = await signSessionToken({
        username: 'admin',
        role: 'admin',
        teamId: null,
      });

      const response = NextResponse.json({ success: true, role: 'admin' });
      response.cookies.set('session', token, {
        httpOnly: true,
        maxAge: 60 * 60 * 24 * 7, // 7 days
        sameSite: 'lax',
        path: '/',
      });
      return response;
    }

    // ─── 2. Team Owner Login ─────────────────────────────────────────────────
    const userSnap = await adminDb.collection('users').doc(username.toLowerCase()).get();

    if (!userSnap.exists) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const userData = userSnap.data() as any;

    // Verify Password Hash
    if (!verifyPassword(password, userData.passwordHash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    // Generate JWT for Team Owner
    const token = await signSessionToken({
      username: userData.username,
      role: userData.role,
      teamId: userData.teamId || null,
    });

    const response = NextResponse.json({ success: true, role: userData.role, teamId: userData.teamId });
    response.cookies.set('session', token, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: 'lax',
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.cookies.delete('session');
  // Clean up legacy token if exists
  response.cookies.delete('admin_token');
  return response;
}
