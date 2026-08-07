import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';
import type { Player, SquadCustomPlayer } from '@/types';

export const dynamic = 'force-dynamic';

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// Key = teamId if assigned, otherwise username (matches /api/squad)
function squadKey(session: { username: string; teamId?: string | null }) {
  return session.teamId || session.username;
}

// GET — download the current squad (directory picks + custom players) as Excel,
// with the price paid for each and a purse summary.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const key = squadKey(session);
    const sqSnap = await adminDb.collection('squads').doc(key).get();
    const sq = sqSnap.data() as
      | {
          playerIds?: string[];
          purse?: number;
          prices?: Record<string, number>;
          customPlayers?: SquadCustomPlayer[];
        }
      | undefined;

    const playerIds = sq?.playerIds ?? [];
    const purse = typeof sq?.purse === 'number' ? sq.purse : 200000;
    const prices = sq?.prices ?? {};
    const customPlayers = sq?.customPlayers ?? [];

    // Fetch each directory player's live doc in parallel
    const liveDocs = await Promise.all(
      playerIds.map((id) => adminDb.collection('players').doc(id).get())
    );
    const liveById = new Map<string, Player>();
    liveDocs.forEach((d) => {
      if (d.exists) liveById.set(d.id, { id: d.id, ...(d.data() as object) } as Player);
    });

    const priceOf = (p: Player) => prices[p.id] ?? p.soldPrice ?? p.basePrice;

    const directoryRows = playerIds.map((id) => {
      const p = liveById.get(id);
      if (!p) {
        // Player no longer in directory — export what we can
        return {
          fullName: '(removed player)',
          type: 'Directory',
          playingAs: '', tier: '', ageBracket: '', age: '',
          price: prices[id] ?? '',
          status: '', inDirectory: 'No', cricHeroesUrl: '',
        };
      }
      return {
        fullName: p.fullName,
        type: 'Directory',
        playingAs: p.playingAs ?? '',
        tier: p.tier ?? '',
        ageBracket: p.ageBracket === 'under_35' ? 'U35' : p.ageBracket === 'above_35' ? '35+' : '',
        age: typeof p.age === 'number' ? Number(p.age.toFixed(1)) : '',
        price: priceOf(p),
        status: p.status ?? '',
        inDirectory: 'Yes',
        cricHeroesUrl: p.cricHeroesUrl ?? '',
      };
    });

    const customRows = customPlayers.map((c) => ({
      fullName: c.name,
      type: 'Manual',
      playingAs: '',
      tier: c.category ?? '',
      ageBracket: typeof c.age === 'number' ? (c.age < 35 ? 'U35' : '35+') : '',
      age: typeof c.age === 'number' ? Number(c.age.toFixed(1)) : '',
      price: c.price,
      status: '', inDirectory: 'No', cricHeroesUrl: '',
    }));

    const rows = [...directoryRows, ...customRows];
    const spent = rows.reduce((sum, r) => sum + (typeof r.price === 'number' ? r.price : 0), 0);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SCCL Auction Dashboard';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Squad');
    sheet.columns = [
      { header: 'Player Name', key: 'fullName', width: 25 },
      { header: 'Type', key: 'type', width: 11 },
      { header: 'Role', key: 'playingAs', width: 22 },
      { header: 'Category', key: 'tier', width: 10 },
      { header: 'Age Group', key: 'ageBracket', width: 10 },
      { header: 'Age', key: 'age', width: 8 },
      { header: 'Price Paid (₹)', key: 'price', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'In Directory', key: 'inDirectory', width: 12 },
      { header: 'CricHeroes', key: 'cricHeroesUrl', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF16213e' } };
    rows.forEach((r) => sheet.addRow(r));

    // Purse summary footer
    sheet.addRow({});
    const totalRow = sheet.addRow({ fullName: 'SQUAD SIZE', price: rows.length });
    totalRow.font = { bold: true };
    sheet.addRow({ fullName: 'TOTAL PURSE', price: purse });
    sheet.addRow({ fullName: 'TOTAL SPENT', price: spent });
    sheet.addRow({ fullName: 'PURSE REMAINING', price: purse - spent });

    const buffer = await workbook.xlsx.writeBuffer();
    const safeKey = key.replace(/[^a-z0-9_-]/gi, '_');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Squad_${safeKey}_${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Squad export error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
