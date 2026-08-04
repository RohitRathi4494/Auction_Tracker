import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';

export const dynamic = 'force-dynamic';

// POST /api/auction/action
// body: { action, playerId?, teamId?, amount?, tiebreakerBids? }
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { action } = body;

  const stateRef = adminDb.collection('auction').doc('state');

  try {
    switch (action) {
      // ── Draw next player ──────────────────────────────────────────────────
      case 'draw': {
        const { playerId } = body;
        const playerRef = adminDb.collection('players').doc(playerId);
        const playerSnap = await playerRef.get();
        if (!playerSnap.exists) return NextResponse.json({ error: 'Player not found' }, { status: 404 });

        await Promise.all([
          playerRef.update({ status: 'in_auction' }),
          stateRef.set({
            currentPlayerId: playerId,
            currentBid: playerSnap.data()!.basePrice,
            currentBidTeamId: null,
            phase: 'bidding',
            tiebreakerTeams: [],
            updatedAt: new Date().toISOString(),
          }),
        ]);
        return NextResponse.json({ success: true });
      }

      // ── Place a bid ───────────────────────────────────────────────────────
      case 'bid': {
        const { teamId, amount, playerId } = body;
        await stateRef.update({
          currentBid: amount,
          currentBidTeamId: teamId,
          phase: 'bidding',
          updatedAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true });
      }

      // ── Mark Sold ─────────────────────────────────────────────────────────
      case 'sold': {
        const { playerId, teamId, amount } = body;
        const [playerSnap, teamSnap] = await Promise.all([
          adminDb.collection('players').doc(playerId).get(),
          adminDb.collection('teams').doc(teamId).get(),
        ]);

        if (!playerSnap.exists || !teamSnap.exists) {
          return NextResponse.json({ error: 'Player or team not found' }, { status: 404 });
        }

        const player = playerSnap.data()!;
        const team = teamSnap.data()!;
        const playerAge = player.age as number;

        // Write log entry
        const logRef = adminDb.collection('auctionLog').doc();
        const batch = adminDb.batch();

        // Update player
        batch.update(adminDb.collection('players').doc(playerId), {
          status: 'sold',
          soldToTeamId: teamId,
          soldToTeamName: team.name,
          soldPrice: amount,
        });

        // Update team stats
        const ageInRange = playerAge >= 30 && playerAge < 35;
        batch.update(adminDb.collection('teams').doc(teamId), {
          purseRemaining: FieldValue.increment(-amount),
          squadCount: FieldValue.increment(1),
          categoryACount: player.tier === 'A' ? FieldValue.increment(1) : FieldValue.increment(0),
          age3035Count: ageInRange ? FieldValue.increment(1) : FieldValue.increment(0),
        });

        // Log
        batch.set(logRef, {
          playerId,
          teamId,
          playerName: player.fullName,
          teamName: team.name,
          bidAmount: amount,
          action: 'sold',
          timestamp: new Date().toISOString(),
        });

        // Reset auction state
        batch.set(stateRef, {
          currentPlayerId: null,
          currentBid: 0,
          currentBidTeamId: null,
          phase: 'idle',
          tiebreakerTeams: [],
          updatedAt: new Date().toISOString(),
        });

        await batch.commit();
        return NextResponse.json({ success: true });
      }

      // ── Mark Unsold ───────────────────────────────────────────────────────
      case 'unsold': {
        const { playerId } = body;
        const batch = adminDb.batch();
        const logRef = adminDb.collection('auctionLog').doc();
        const playerSnap = await adminDb.collection('players').doc(playerId).get();
        const player = playerSnap.data()!;

        batch.update(adminDb.collection('players').doc(playerId), { status: 'unsold' });
        batch.set(logRef, {
          playerId,
          teamId: null,
          playerName: player.fullName,
          teamName: null,
          bidAmount: 0,
          action: 'unsold',
          timestamp: new Date().toISOString(),
        });
        batch.set(stateRef, {
          currentPlayerId: null,
          currentBid: 0,
          currentBidTeamId: null,
          phase: 'idle',
          tiebreakerTeams: [],
          updatedAt: new Date().toISOString(),
        });
        await batch.commit();
        return NextResponse.json({ success: true });
      }

      // ── Trigger tiebreaker ────────────────────────────────────────────────
      case 'tiebreaker': {
        const { team1Id, team2Id } = body;
        await stateRef.update({
          phase: 'tiebreaker',
          tiebreakerTeams: [team1Id, team2Id],
          updatedAt: new Date().toISOString(),
        });
        return NextResponse.json({ success: true });
      }

      // ── Undo last sold ────────────────────────────────────────────────────
      case 'undo': {
        const { playerId, teamId, amount } = body;
        const [playerSnap, teamSnap] = await Promise.all([
          adminDb.collection('players').doc(playerId).get(),
          adminDb.collection('teams').doc(teamId).get(),
        ]);
        const player = playerSnap.data()!;
        const team = teamSnap.data()!;
        const playerAge = player.age as number;
        const ageInRange = playerAge >= 30 && playerAge < 35;

        const batch = adminDb.batch();
        batch.update(adminDb.collection('players').doc(playerId), {
          status: 'available',
          soldToTeamId: FieldValue.delete(),
          soldToTeamName: FieldValue.delete(),
          soldPrice: FieldValue.delete(),
        });
        batch.update(adminDb.collection('teams').doc(teamId), {
          purseRemaining: FieldValue.increment(amount),
          squadCount: FieldValue.increment(-1),
          categoryACount: player.tier === 'A' ? FieldValue.increment(-1) : FieldValue.increment(0),
          age3035Count: ageInRange ? FieldValue.increment(-1) : FieldValue.increment(0),
        });

        const logRef = adminDb.collection('auctionLog').doc();
        batch.set(logRef, {
          playerId,
          teamId,
          playerName: player.fullName,
          teamName: team.name,
          bidAmount: amount,
          action: 'undo',
          timestamp: new Date().toISOString(),
        });

        await batch.commit();
        return NextResponse.json({ success: true });
      }

      // ── Update team purse (admin setup) ───────────────────────────────────
      case 'update_purse': {
        const { teamId, purse } = body;
        await adminDb.collection('teams').doc(teamId).update({
          totalPurse: purse,
          purseRemaining: purse,
        });
        return NextResponse.json({ success: true });
      }

      // ── Update player flags (legend, owner, retained) ─────────────────────
      case 'update_flags': {
        const { playerId, flags } = body;
        await adminDb.collection('players').doc(playerId).update(flags);
        return NextResponse.json({ success: true });
      }

      // ── Manually override stats ───────────────────────────────────────────
      case 'override_stats': {
        const { playerId, stats } = body;
        await adminDb.collection('players').doc(playerId).update({
          statsOverride: stats,
          battingAvg: stats.battingAvg,
          strikeRate: stats.strikeRate,
          careerWickets: stats.careerWickets,
          economy: stats.economy,
        });
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (err) {
    console.error('Auction action error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
