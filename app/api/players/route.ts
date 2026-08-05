import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

// Server-side memory cache
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPlayers: any[] | null = null;
let cacheTime = 0;
const CACHE_TTL_MS = 45 * 1000;

export async function GET() {
  try {
    const now = Date.now();
    if (cachedPlayers && now - cacheTime < CACHE_TTL_MS) {
      const res = NextResponse.json({ success: true, players: cachedPlayers });
      res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=60');
      return res;
    }

    const snap = await adminDb.collection('players').orderBy('fullName').get();
    cachedPlayers = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    cacheTime = now;

    const res = NextResponse.json({ success: true, players: cachedPlayers });
    res.headers.set('Cache-Control', 'private, max-age=15, stale-while-revalidate=60');
    return res;
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
