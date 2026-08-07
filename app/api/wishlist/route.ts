import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';
import type { WishlistSnapshot, TargetMeta, TargetStatus } from '@/types';

export const dynamic = 'force-dynamic';

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

interface WishlistDoc {
  playerIds?: string[];
  items?: Record<string, WishlistSnapshot>;
  targets?: Record<string, TargetMeta>;
}

const VALID_STATUSES: TargetStatus[] = ['targeting', 'bought', 'lost'];

// Coerce a raw priority value into a positive integer, or undefined to clear it.
function normalizePriority(v: unknown): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n);
}

// GET — fetch this user's wishlist (ids + snapshots + target meta)
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb.collection('wishlists').doc(session.username).get();
  const data = snap.data() as WishlistDoc | undefined;
  return NextResponse.json({
    success: true,
    playerIds: data?.playerIds ?? [],
    items: data?.items ?? {},
    targets: data?.targets ?? {},
  });
}

// POST — either toggle a player in/out of the wishlist, or (op: 'update_meta')
// set the target priority/status for an already-wishlisted player.
// Optional `snapshot` is stored on add so the entry survives directory changes.
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { playerId, snapshot, op, priority, status } = (await req.json()) as {
    playerId?: string;
    snapshot?: WishlistSnapshot;
    op?: string;
    priority?: number | string | null;
    status?: TargetStatus;
  };
  if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

  const ref = adminDb.collection('wishlists').doc(session.username);
  const snap = await ref.get();
  const existingDoc = (snap.data() as WishlistDoc | undefined) ?? {};
  const existing: string[] = existingDoc.playerIds ?? [];
  const items: Record<string, WishlistSnapshot> = existingDoc.items ?? {};
  const targets: Record<string, TargetMeta> = existingDoc.targets ?? {};

  // ── Update target meta (priority / status) without toggling membership ──────
  if (op === 'update_meta') {
    if (!existing.includes(playerId)) {
      return NextResponse.json({ error: 'player not in wishlist' }, { status: 404 });
    }
    const meta: TargetMeta = { ...targets[playerId] };
    if (priority !== undefined) {
      const p = normalizePriority(priority);
      if (p === undefined) delete meta.priority;
      else meta.priority = p;
    }
    if (status !== undefined) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json({ error: 'invalid status' }, { status: 400 });
      }
      meta.status = status;
    }
    targets[playerId] = meta;

    await ref.set({ playerIds: existing, items, targets, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true, playerIds: existing, items, targets });
  }

  // ── Toggle membership ───────────────────────────────────────────────────────
  let updated: string[];
  if (existing.includes(playerId)) {
    // Remove — drop the id, its snapshot, and any target meta
    updated = existing.filter((id) => id !== playerId);
    delete items[playerId];
    delete targets[playerId];
  } else {
    // Add — keep a snapshot so the entry is resilient to future removals
    updated = [...existing, playerId];
    if (snapshot && typeof snapshot === 'object') {
      items[playerId] = { ...snapshot, id: playerId };
    }
  }

  await ref.set({ playerIds: updated, items, targets, updatedAt: new Date().toISOString() });
  return NextResponse.json({
    success: true,
    playerIds: updated,
    items,
    targets,
    wishlisted: updated.includes(playerId),
  });
}
