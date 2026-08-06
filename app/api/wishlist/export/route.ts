import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { adminDb } from '@/lib/firebase/admin';
import { verifySessionToken } from '@/lib/auth';
import type { Player, WishlistSnapshot } from '@/types';

export const dynamic = 'force-dynamic';

async function getSession(req: NextRequest) {
  const token = req.cookies.get('session')?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// GET — download the current user's wishlist as an Excel file.
// Uses live player data when available, falling back to the stored snapshot
// so players removed from the directory are still exported.
export async function GET(req: NextRequest) {
  const session = await getSession(req);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const wlSnap = await adminDb.collection('wishlists').doc(session.username).get();
    const wl = wlSnap.data() as
      | { playerIds?: string[]; items?: Record<string, WishlistSnapshot> }
      | undefined;
    const playerIds = wl?.playerIds ?? [];
    const items = wl?.items ?? {};

    // Fetch each wishlisted player's live doc in parallel
    const liveDocs = await Promise.all(
      playerIds.map((id) => adminDb.collection('players').doc(id).get())
    );
    const liveById = new Map<string, Player>();
    liveDocs.forEach((d) => {
      if (d.exists) liveById.set(d.id, { id: d.id, ...(d.data() as object) } as Player);
    });

    // Merge live data over snapshot for each entry
    const rows = playerIds.map((id) => {
      const live = liveById.get(id);
      const snap = items[id];
      const src = (live ?? snap ?? { id }) as Partial<Player> & { id: string };
      return {
        fullName: src.fullName ?? '(unknown)',
        phone: src.phone ?? '',
        playingAs: src.playingAs ?? '',
        tier: src.tier ?? '',
        ageBracket:
          src.ageBracket === 'under_35' ? 'U35' : src.ageBracket === 'above_35' ? '35+' : '',
        age: typeof src.age === 'number' ? Number(src.age.toFixed(1)) : '',
        basePrice: typeof src.basePrice === 'number' ? src.basePrice : '',
        status: live?.status ?? snap?.status ?? '',
        soldPrice: live?.soldPrice ?? '',
        soldTo: live?.soldToTeamName ?? '',
        inDirectory: live ? 'Yes' : 'No',
        cricHeroesUrl: src.cricHeroesUrl ?? '',
      };
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SCCL Auction Dashboard';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Wishlist');
    sheet.columns = [
      { header: 'Player Name', key: 'fullName', width: 25 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Role', key: 'playingAs', width: 22 },
      { header: 'Category', key: 'tier', width: 10 },
      { header: 'Age Group', key: 'ageBracket', width: 10 },
      { header: 'Age', key: 'age', width: 8 },
      { header: 'Base Price (₹)', key: 'basePrice', width: 14 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Sold Price (₹)', key: 'soldPrice', width: 14 },
      { header: 'Sold To', key: 'soldTo', width: 20 },
      { header: 'In Directory', key: 'inDirectory', width: 12 },
      { header: 'CricHeroes', key: 'cricHeroesUrl', width: 40 },
    ];
    sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1a1a2e' } };
    rows.forEach((r) => sheet.addRow(r));

    // Summary footer
    sheet.addRow({});
    const totalRow = sheet.addRow({ fullName: 'TOTAL WISHLISTED', basePrice: rows.length });
    totalRow.font = { bold: true };

    const buffer = await workbook.xlsx.writeBuffer();
    const safeUser = session.username.replace(/[^a-z0-9_-]/gi, '_');
    const date = new Date().toISOString().split('T')[0];

    return new NextResponse(buffer, {
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="Wishlist_${safeUser}_${date}.xlsx"`,
      },
    });
  } catch (err) {
    console.error('Wishlist export error:', err);
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
