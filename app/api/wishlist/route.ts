import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';
import type { WishlistSnapshot } from '@/types';

export const dynamic = 'force-dynamic';

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

interface WishlistDoc {
  playerIds?: string[];
  items?: Record<string, WishlistSnapshot>;
}

// GET — fetch this user's wishlist (ids + snapshots)
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb.collection('wishlists').doc(session.username).get();
  const data = snap.data() as WishlistDoc | undefined;
  return NextResponse.json({
    success: true,
    playerIds: data?.playerIds ?? [],
    items: data?.items ?? {},
  });
}

// POST — toggle a player in/out of wishlist.
// Optional `snapshot` is stored on add so the entry survives directory changes.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { playerId, snapshot } = (await req.json()) as {
    playerId?: string;
    snapshot?: WishlistSnapshot;
  };
  if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

  const ref = adminDb.collection('wishlists').doc(session.username);
  const snap = await ref.get();
  const existingDoc = (snap.data() as WishlistDoc | undefined) ?? {};
  const existing: string[] = existingDoc.playerIds ?? [];
  const items: Record<string, WishlistSnapshot> = existingDoc.items ?? {};

  let updated: string[];
  if (existing.includes(playerId)) {
    // Remove — drop the id and its snapshot
    updated = existing.filter((id) => id !== playerId);
    delete items[playerId];
  } else {
    // Add — keep a snapshot so the entry is resilient to future removals
    updated = [...existing, playerId];
    if (snapshot && typeof snapshot === 'object') {
      items[playerId] = { ...snapshot, id: playerId };
    }
  }

  await ref.set({ playerIds: updated, items, updatedAt: new Date().toISOString() });
  return NextResponse.json({
    success: true,
    playerIds: updated,
    items,
    wishlisted: updated.includes(playerId),
  });
}
