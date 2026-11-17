import { fromHex, pbkdf2Sha256, pbkdf2Sha256Async, toHex, utf8 } from './sha256';

/** Rounds of PBKDF2 for a new PIN. Saved with the hash, so it can be raised later without breaking older PINs. */
export const PIN_ROUNDS = 10_000;

export type PinProblem = 'length' | 'digits' | 'obvious';

/** True for PINs anyone would try first: one digit repeated, a straight run up or down, two digits taking turns, and a few favourites. */
export function isObviousPin(pin: string): boolean {
  if (!/^\d+$/.test(pin)) return false;
  const d = [...pin].map(Number);
  if (d.every((x) => x === d[0])) return true;
  const steps = d.slice(1).map((x, i) => (x - d[i] + 10) % 10);
  if (steps.every((s) => s === 1) || steps.every((s) => s === 9)) return true;
  if (pin.length >= 4 && d.every((x, i) => x === d[i % 2])) return true; // 1212, 121212
  if (pin.length === 6 && pin.slice(0, 3) === pin.slice(3)) return true; // 123123
  return ['1004', '2000', '6969', '1122', '112233', '159753', '147258', '102030'].includes(pin);
}

/** What is wrong with a new PIN, or null when it is fine. */
export function pinProblem(pin: string, length: number, rejectObvious: boolean): PinProblem | null {
  if (!/^\d*$/.test(pin)) return 'digits';
  if (pin.length !== length) return 'length';
  if (rejectObvious && isObviousPin(pin)) return 'obvious';
  return null;
}

/** A saved PIN: `pbkdf2-sha256$<rounds>$<salt hex>$<hash hex>`. The PIN itself is never saved. */
export function hashPin(pin: string, salt: Uint8Array, rounds = PIN_ROUNDS): string {
  return ['pbkdf2-sha256', String(rounds), toHex(salt), toHex(pbkdf2Sha256(utf8(pin), salt, rounds))].join('$');
}

/** Stretches a PIN: PBKDF2-HMAC-SHA-256, 32 bytes. An app may pass a native one (GuardModules.pbkdf2); it must give the same bytes. */
export type DerivePin = (password: Uint8Array, salt: Uint8Array, rounds: number) => Promise<Uint8Array>;

/** The kit's own: plain JavaScript, worked in short slices so the app keeps responding. */
export const derivePinJs: DerivePin = (password, salt, rounds) => pbkdf2Sha256Async(password, salt, rounds);

/** hashPin without blocking the app. */
export async function hashPinAsync(pin: string, salt: Uint8Array, rounds = PIN_ROUNDS, derive: DerivePin = derivePinJs): Promise<string> {
  return ['pbkdf2-sha256', String(rounds), toHex(salt), toHex(await derive(utf8(pin), salt, rounds))].join('$');
}

/** A saved record split into its parts, or null when it is damaged. */
function parseRecord(record: string | null | undefined): { rounds: number; salt: Uint8Array; want: Uint8Array } | null {
  const parts = (record ?? '').split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2-sha256') return null;
  const rounds = Number(parts[1]);
  const salt = fromHex(parts[2]);
  const want = fromHex(parts[3]);
  if (!Number.isInteger(rounds) || rounds < 1 || rounds > 10_000_000 || !salt || salt.length < 8 || !want || want.length !== 32) return null;
  return { rounds, salt, want };
}

/** Compares in constant time. */
function same(got: Uint8Array, want: Uint8Array): boolean {
  if (got.length !== 32) return false;
  let diff = 0;
  for (let i = 0; i < 32; i++) diff |= got[i] ^ want[i];
  return diff === 0;
}

/** Checks a PIN against a saved record in constant time. A damaged record never matches. */
export function checkPin(pin: string, record: string | null | undefined): boolean {
  const r = parseRecord(record);
  return !!r && same(pbkdf2Sha256(utf8(pin), r.salt, r.rounds), r.want);
}

/** checkPin without blocking the app (the lock screen keeps drawing while the PIN is checked). */
export async function checkPinAsync(pin: string, record: string | null | undefined, derive: DerivePin = derivePinJs): Promise<boolean> {
  const r = parseRecord(record);
  return !!r && same(await derive(utf8(pin), r.salt, r.rounds), r.want);
}
