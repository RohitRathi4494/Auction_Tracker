import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import ExcelJS from 'exceljs';
import { Player, Team, AuctionLogEntry } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  try {
    // Fetch all data
    const [playersSnap, teamsSnap, logSnap] = await Promise.all([
      adminDb.collection('players').where('status', '==', 'sold').get(),
      adminDb.collection('teams').get(),
      adminDb.collection('auctionLog').orderBy('timestamp', 'asc').get(),
    ]);

    const players = playersSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Player));
    const teams = teamsSnap.docs.map((d) => ({ id: d.id, ...d.data() } as Team));
    const log = logSnap.docs.map((d) => ({ id: d.id, ...d.data() } as AuctionLogEntry));

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SCCL Auction Dashboard';
    workbook.created = new Date();

    // ── Master Auction Log sheet ───────────────────────────────────────────────
    const masterSheet = workbook.addWorksheet('Auction Log');
    masterSheet.columns = [
      { header: 'Player Name', key: 'playerName', width: 25 },
      { header: 'Team', key: 'teamName', width: 20 },
      { header: 'Amount (₹)', key: 'bidAmount', width: 14 },
      { header: 'Action', key: 'action', width: 12 },
      { header: 'Timestamp', key: 'timestamp', width: 22 },
    ];
    masterSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    masterSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
    log.forEach((entry) => masterSheet.addRow(entry));

    // ── Per-team sheets ─────────────────────────────────────────────────────────
    for (const team of teams) {
      const sheet = workbook.addWorksheet(team.name.substring(0, 31)); // Excel tab name limit
      sheet.columns = [
        { header: 'Player Name', key: 'fullName', width: 25 },
        { header: 'Role', key: 'playingAs', width: 22 },
        { header: 'Category', key: 'tier', width: 10 },
        { header: 'Age', key: 'age', width: 8 },
        { header: 'Sold Price (₹)', key: 'soldPrice', width: 14 },
        { header: 'CricHeroes', key: 'cricHeroesUrl', width: 40 },
        { header: 'Flags', key: 'flags', width: 20 },
      ];
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16213e' } };

      const teamPlayers = players.filter((p) => p.soldToTeamId === team.id);
      teamPlayers.forEach((p) => {
        sheet.addRow({
          fullName: p.fullName,
          playingAs: p.playingAs,
          tier: p.tier,
          age: p.age.toFixed(1),
          soldPrice: p.soldPrice ?? 0,
          cricHeroesUrl: p.cricHeroesUrl,
          flags: [p.isOwner && 'Owner', p.isRetained && 'Retained', p.isLegend && 'Legend']
            .filter(Boolean)
            .join(', '),
        });
      });

      // Summary rows
      sheet.addRow({});
      const summaryRow = sheet.addRow({
        fullName: 'TOTAL PURSE SPENT',
        soldPrice: team.totalPurse - team.purseRemaining,
      });
      summaryRow.font = { bold: true };
      sheet.addRow({ fullName: 'PURSE REMAINING', soldPrice: team.purseRemaining });
      sheet.addRow({ fullName: 'SQUAD SIZE', soldPrice: team.squadCount });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="SCCL_Auction_Results_${new Date().toISOString().split('T')[0]}.xlsx"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
