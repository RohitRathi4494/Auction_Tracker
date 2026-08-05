import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';
import { verifyPassword, hashPassword } from '@/lib/crypto';

export const dynamic = 'force-dynamic';

// POST — user changes their own password (requires current password)
export async function POST(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const session = await verifySessionToken(token);
  if (!session) return NextResponse.json({ error: 'Invalid session' }, { status: 401 });

  const { currentPassword, newPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Current and new password are required' }, { status: 400 });
  }

  if (newPassword.length < 6) {
    return NextResponse.json({ error: 'New password must be at least 6 characters' }, { status: 400 });
  }

  // Admin uses env password — not stored in Firestore
  if (session.username === 'admin') {
    return NextResponse.json({ error: 'Admin password cannot be changed here. Update ADMIN_PASSWORD env variable.' }, { status: 400 });
  }

  const userSnap = await adminDb.collection('users').doc(session.username).get();
  if (!userSnap.exists) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const userData = userSnap.data() as { passwordHash: string };

  if (!verifyPassword(currentPassword, userData.passwordHash)) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const newHash = hashPassword(newPassword);
  await adminDb.collection('users').doc(session.username).update({ passwordHash: newHash });

  return NextResponse.json({ success: true, message: 'Password changed successfully' });
}
