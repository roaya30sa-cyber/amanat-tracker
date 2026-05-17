// Password hashing using Web Crypto API (works on Cloudflare Workers / edge).
// We use PBKDF2-SHA256 with 100k iterations and a random 16-byte salt.
// Stored format:  pbkdf2$100000$<base64(salt)>$<base64(hash)>

const ITERATIONS = 100_000;
const KEY_LEN_BITS = 256;   // 32 bytes
const SALT_LEN = 16;

function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
function b64ToBuf(b64: string): Uint8Array {
  const s = atob(b64);
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

async function deriveBits(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    baseKey,
    KEY_LEN_BITS
  );
}

export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 6) throw new Error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LEN));
  const bits = await deriveBits(password, salt);
  return `pbkdf2$${ITERATIONS}$${bufToB64(salt.buffer)}$${bufToB64(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (!stored || !password) return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iters = parseInt(parts[1]);
  const salt = b64ToBuf(parts[2]);
  const expected = b64ToBuf(parts[3]);
  // Re-derive with the stored params (don't trust ITERATIONS const — use stored value)
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' },
    baseKey,
    expected.length * 8
  );
  const got = new Uint8Array(bits);
  if (got.length !== expected.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < got.length; i++) diff |= got[i] ^ expected[i];
  return diff === 0;
}
