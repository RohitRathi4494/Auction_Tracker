// Firebase Admin SDK — server-side only (API routes)
// Lazy init: credentials are not read at module load time, only when first called
import { App, getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

let _app: App | null = null;
let _db: Firestore | null = null;

function getAdminApp(): App {
  if (_app) return _app;
  if (getApps().length > 0) {
    _app = getApps()[0];
    return _app;
  }

  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!privateKey || privateKey === 'placeholder') {
    throw new Error('FIREBASE_ADMIN_PRIVATE_KEY is not set. Please configure .env.local');
  }

  // Aggressively clean the private key (Vercel copy-paste often adds quotes or escapes newlines)
  let cleanKey = privateKey
    .replace(/\\n/g, '\n') // Fix escaped newlines
    .replace(/(^"|"$)/g, '') // Remove surrounding quotes if accidentally copied
    .replace(/(^'|'$)/g, ''); // Remove surrounding single quotes

  _app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID!,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
      privateKey: cleanKey,
    }),
  });
  return _app;
}

export function getAdminDb(): Firestore {
  if (_db) return _db;
  _db = getFirestore(getAdminApp());
  return _db;
}

// Named export that matches usage in route files
export const adminDb = {
  collection: (name: string) => getAdminDb().collection(name),
  batch: () => getAdminDb().batch(),
} as unknown as Firestore;
