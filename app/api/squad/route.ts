import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Key = teamId if assigned, otherwise username
function squadKey(session: { username: string; teamId?: string | null }) {
  return session.teamId || session.username;
}

// GET — fetch squad
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb.collection('squads').doc(squadKey(session)).get();
  const data = snap.data() as { playerIds?: string[] } | undefined;
  return NextResponse.json({ success: true, playerIds: data?.playerIds ?? [] });
}

// POST — toggle player in/out of squad
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { playerId, action } = await req.json();
  if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });

  const key = squadKey(session);
  const ref = adminDb.collection('squads').doc(key);
  const snap = await ref.get();
  const existing: string[] = (snap.data() as { playerIds?: string[] } | undefined)?.playerIds ?? [];

  let updated: string[];
  if (action === 'remove' || existing.includes(playerId)) {
    updated = existing.filter((id) => id !== playerId);
  } else {
    updated = [...existing, playerId];
  }

  await ref.set({
    playerIds: updated,
    key,
    username: session.username,
    teamId: session.teamId ?? null,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    playerIds: updated,
    inSquad: updated.includes(playerId),
  });
}
