import crypto from 'crypto';

// ─── Password Hashing (Node.js Only) ──────────────────────────────────────────
// Note: Do not import or call these functions inside Edge proxy/middleware

export function hashPassword(password: string): string {
  // Generate a random salt
  const salt = crypto.randomBytes(16).toString('hex');
  // Hash the password with the salt using scrypt
  const derivedKey = crypto.scryptSync(password, salt, 64);
  // Return the salt and the hash joined by a colon
  return `${salt}:${derivedKey.toString('hex')}`;
}

export function verifyPassword(password: string, hash: string): boolean {
  try {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return false;
    // Hash the given password with the stored salt
    const derivedKey = crypto.scryptSync(password, salt, 64);
    // Compare the derived key with the stored key safely
    return crypto.timingSafeEqual(Buffer.from(key, 'hex'), derivedKey);
  } catch (e) {
    return false;
  }
}
