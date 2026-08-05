import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { adminDb } from '@/lib/firebase/admin';
import { mapRowToPlayer, mapRowToTeam } from '@/lib/import';
import { clearPlayersCache } from '@/app/api/init/route';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const playersFile = formData.get('playersFile') as File | null;
    const teamsFile = formData.get('teamsFile') as File | null;

    const results = { playersImported: 0, teamsImported: 0, errors: [] as string[] };

    // ── Import Players ────────────────────────────────────────────────────────
    if (playersFile) {
      const buf = await playersFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });

      // Find the registrations sheet (could be first sheet or named)
      const sheetName =
        wb.SheetNames.find((n) => n.toLowerCase().includes('registr')) ?? wb.SheetNames[0];
      const ws = wb.Sheets[sheetName];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws);

      let currentBatch = adminDb.batch();
      let batchCount = 0;
      let count = 0;

      for (const row of rows) {
        if (!row.fullName) continue;
        try {
          const player = mapRowToPlayer(row, count);
          // Use phone+name as deterministic doc ID to allow re-import (idempotent)
          const docId = `${String(row.phone).replace(/\D/g, '')}_${player.fullName.replace(/\s+/g, '_').toLowerCase()}`;
          const ref = adminDb.collection('players').doc(docId);
          currentBatch.set(ref, player, { merge: true });
          count++;
          batchCount++;
          // Firestore batch limit is 500 — commit and start a fresh batch
          if (batchCount >= 499) {
            await currentBatch.commit();
            currentBatch = adminDb.batch();
            batchCount = 0;
          }
        } catch (e) {
          results.errors.push(`Row ${count}: ${(e as Error).message}`);
        }
      }

      // Commit any remaining writes
      if (batchCount > 0) {
        await currentBatch.commit();
      }
      results.playersImported = count;
    }

    // ── Import Teams ──────────────────────────────────────────────────────────
    if (teamsFile) {
      const buf = await teamsFile.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const teamSheet = wb.Sheets['Team Owners'] ?? wb.Sheets[wb.SheetNames[0]];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(teamSheet);

      const batch = adminDb.batch();
      let count = 0;

      for (const row of rows) {
        if (!row['Team Name']) continue;
        const team = mapRowToTeam(row);
        const docId = team.name.replace(/\s+/g, '_').toLowerCase();
        const ref = adminDb.collection('teams').doc(docId);
        batch.set(ref, team, { merge: true });
        count++;
      }

      // Init auction state doc if missing
      const stateRef = adminDb.collection('auction').doc('state');
      const stateSnap = await stateRef.get();
      if (!stateSnap.exists) {
        batch.set(stateRef, {
          currentPlayerId: null,
          currentBid: 0,
          currentBidTeamId: null,
          phase: 'idle',
          tiebreakerTeams: [],
          updatedAt: new Date().toISOString(),
        });
      }

      await batch.commit();
      results.teamsImported = count;
    }

    clearPlayersCache();
    return NextResponse.json({ success: true, ...results });
  } catch (err) {
    console.error('Import error:', err);
    return NextResponse.json({ success: false, error: (err as Error).message }, { status: 500 });
  }
}
