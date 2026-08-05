import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// GET — fetch this user's wishlist
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb.collection('wishlists').doc(session.username).get();
  const data = snap.data() as { playerIds?: string[] } | undefined;
  return NextResponse.json({ success: true, playerIds: data?.playerIds ?? [] });
}

// POST — toggle a player in/out of wishlist
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { playerId } = await req.json();
  if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

  const ref = adminDb.collection('wishlists').doc(session.username);
  const snap = await ref.get();
  const existing: string[] = (snap.data() as { playerIds?: string[] } | undefined)?.playerIds ?? [];

  let updated: string[];
  if (existing.includes(playerId)) {
    updated = existing.filter((id) => id !== playerId);
  } else {
    updated = [...existing, playerId];
  }

  await ref.set({ playerIds: updated, updatedAt: new Date().toISOString() });
  return NextResponse.json({ success: true, playerIds: updated, wishlisted: updated.includes(playerId) });
}
