import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { scrapePlayerStats } from '@/lib/scraper';

export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ playerId: string }> },
) {
  const { playerId } = await params;

  try {
    const ref = adminDb.collection('players').doc(playerId);
    const snap = await ref.get();

    if (!snap.exists) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    const player = snap.data()!;
    const stats = await scrapePlayerStats(player.cricHeroesUrl);

    // Persist scraped stats back to Firestore
    await ref.update({
      ...('battingAvg' in stats && stats.battingAvg !== undefined ? { battingAvg: stats.battingAvg } : {}),
      ...('strikeRate' in stats && stats.strikeRate !== undefined ? { strikeRate: stats.strikeRate } : {}),
      ...('careerWickets' in stats && stats.careerWickets !== undefined ? { careerWickets: stats.careerWickets } : {}),
      ...('economy' in stats && stats.economy !== undefined ? { economy: stats.economy } : {}),
      statsScrapedAt: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, stats, playerId });
  } catch (err) {
    console.error('Scrape error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
