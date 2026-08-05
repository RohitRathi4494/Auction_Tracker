import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// In-memory cache for players across warm serverless invocations
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPlayers: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 45 * 1000; // 45 seconds TTL

export function clearPlayersCache() {
  cachedPlayers = null;
  cacheTime = 0;
}

export async function GET(req: NextRequest) {
  try {
    const token = req.cookies.get('session')?.value;
    let session = null;
    if (token) {
      session = await verifySessionToken(token);
    }

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const username = session.username;
    const teamKey = session.teamId || session.username;

    const now = Date.now();

    // 1. Fetch Players (from memory cache or Firestore)
    const playersPromise = (async () => {
      if (cachedPlayers && now - cacheTime < CACHE_TTL_MS) {
        return cachedPlayers;
      }
      const snap = await adminDb.collection('players').orderBy('fullName').get();
      const docs = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      cachedPlayers = docs;
      cacheTime = now;
      return docs;
    })();

    // 2. Fetch Wishlist (for this user)
    const wishlistPromise = (async () => {
      const snap = await adminDb.collection('wishlists').doc(username).get();
      return (snap.data() as { playerIds?: string[] } | undefined)?.playerIds ?? [];
    })();

    // 3. Fetch Squad (for this team/user)
    const squadPromise = (async () => {
      const snap = await adminDb.collection('squads').doc(teamKey).get();
      return (snap.data() as { playerIds?: string[] } | undefined)?.playerIds ?? [];
    })();

    // Run all 3 queries in parallel on the server
    const [players, wishlist, squad] = await Promise.all([
      playersPromise,
      wishlistPromise,
      squadPromise,
    ]);

    const res = NextResponse.json({
      success: true,
      players,
      wishlist,
      squad,
      user: {
        username: session.username,
        role: session.role,
        teamId: session.teamId ?? null,
      },
    });

    // Add private cache header
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=60');
    return res;
  } catch (error) {
    console.error('Init API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
