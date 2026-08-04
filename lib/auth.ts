import { SignJWT, jwtVerify } from 'jose';
import { SessionPayload } from '@/types';

// The secret used to sign the JWT. We use JWT_SECRET if available, 
// otherwise we fallback to ADMIN_PASSWORD (which the user already set).
const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET || process.env.ADMIN_PASSWORD || 'default_fallback_secret_for_auction';
  return new TextEncoder().encode(secret);
};

// ─── JWT Functions (Edge Compatible) ──────────────────────────────────────────

export async function signSessionToken(payload: Omit<SessionPayload, 'exp'>): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + 60 * 60 * 24 * 7; // 7 days

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setExpirationTime(exp)
    .setIssuedAt(iat)
    .setNotBefore(iat)
    .sign(getJwtSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecretKey());
    return payload as unknown as SessionPayload;
  } catch (error) {
    // Token is invalid or expired
    return null;
  }
}
