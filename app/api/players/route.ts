import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const snap = await adminDb.collection('players').orderBy('fullName').get();
    const players = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return NextResponse.json({ success: true, players });
  } catch (error) {
    console.error('Error fetching players:', error);
    return NextResponse.json({ success: false, error: (error as Error).message }, { status: 500 });
  }
}
