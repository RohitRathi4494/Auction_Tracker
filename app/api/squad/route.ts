import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';
import type { SquadCustomPlayer, SquadData } from '@/types';

export const dynamic = 'force-dynamic';

const DEFAULT_PURSE = 200000;

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Key = teamId if assigned, otherwise username
function squadKey(session: { username: string; teamId?: string | null }) {
  return session.teamId || session.username;
}

// Coerce a raw Firestore doc into the full squad shape (with defaults)
function normalize(data: Record<string, unknown> | undefined): SquadData {
  const d = data ?? {};
  return {
    playerIds: Array.isArray(d.playerIds) ? (d.playerIds as string[]) : [],
    purse: typeof d.purse === 'number' ? d.purse : DEFAULT_PURSE,
    prices:
      d.prices && typeof d.prices === 'object'
        ? (d.prices as Record<string, number>)
        : {},
    customPlayers: Array.isArray(d.customPlayers)
      ? (d.customPlayers as SquadCustomPlayer[])
      : [],
  };
}

function validPrice(v: unknown): number | null {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n);
}

// GET — fetch full squad (ids, purse, prices, custom players)
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const snap = await adminDb.collection('squads').doc(squadKey(session)).get();
  const s = normalize(snap.data() as Record<string, unknown> | undefined);
  return NextResponse.json({ success: true, ...s });
}

// POST — mutate squad. Actions:
//   (none) / toggle       { playerId }            -> toggle player in/out (Directory)
//   remove                { playerId }            -> remove player + its price
//   set_price             { playerId, price }     -> set price paid (adds if missing)
//   set_purse             { purse }               -> set total purse
//   add_custom            { name, price }         -> add off-directory player
//   update_custom         { customId, name?, price? }
//   remove_custom         { customId }
export async function POST(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const action: string | undefined = body.action;

  const key = squadKey(session);
  const ref = adminDb.collection('squads').doc(key);
  const snap = await ref.get();
  const s = normalize(snap.data() as Record<string, unknown> | undefined);

  switch (action) {
    case 'set_purse': {
      const purse = validPrice(body.purse);
      if (purse === null) return NextResponse.json({ error: 'Invalid purse' }, { status: 400 });
      s.purse = purse;
      break;
    }

    case 'set_price': {
      const { playerId } = body;
      if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });
      const price = validPrice(body.price);
      if (price === null) return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      if (!s.playerIds.includes(playerId)) s.playerIds.push(playerId);
      s.prices[playerId] = price;
      break;
    }

    case 'add_custom': {
      const name = String(body.name ?? '').trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const price = validPrice(body.price);
      if (price === null) return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
      s.customPlayers.push({ id: `custom-${crypto.randomUUID()}`, name, price });
      break;
    }

    case 'update_custom': {
      const cp = s.customPlayers.find((c) => c.id === body.customId);
      if (!cp) return NextResponse.json({ error: 'custom player not found' }, { status: 404 });
      if (typeof body.name === 'string' && body.name.trim()) cp.name = body.name.trim();
      if (body.price !== undefined) {
        const price = validPrice(body.price);
        if (price === null) return NextResponse.json({ error: 'Invalid price' }, { status: 400 });
        cp.price = price;
      }
      break;
    }

    case 'remove_custom': {
      s.customPlayers = s.customPlayers.filter((c) => c.id !== body.customId);
      break;
    }

    case 'remove': {
      const { playerId } = body;
      if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });
      s.playerIds = s.playerIds.filter((id) => id !== playerId);
      delete s.prices[playerId];
      break;
    }

    default: {
      // toggle — the Directory shield button uses this (no action field)
      const { playerId } = body;
      if (!playerId) return NextResponse.json({ error: 'playerId required' }, { status: 400 });
      if (s.playerIds.includes(playerId)) {
        s.playerIds = s.playerIds.filter((id) => id !== playerId);
        delete s.prices[playerId];
      } else {
        s.playerIds.push(playerId);
      }
    }
  }

  await ref.set({
    ...s,
    key,
    username: session.username,
    teamId: session.teamId ?? null,
    updatedAt: new Date().toISOString(),
  });

  return NextResponse.json({
    success: true,
    playerIds: s.playerIds,
    purse: s.purse,
    prices: s.prices,
    customPlayers: s.customPlayers,
    inSquad: body.playerId ? s.playerIds.includes(body.playerId) : undefined,
  });
}
