// SHA-256, HMAC-SHA-256 and PBKDF2-HMAC-SHA-256 in plain JavaScript, so a PIN can be stretched
// without a native module per round. Checked against node:crypto in the tests.

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
const IV = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19];

const W = new Uint32Array(64);

/** Runs one 64-byte block (as 16 big-endian words) into the state `h`. */
function compress(h: Uint32Array, words: Uint32Array): void {
  for (let i = 0; i < 16; i++) W[i] = words[i];
  for (let i = 16; i < 64; i++) {
    const a = W[i - 15], b = W[i - 2];
    const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
    const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
    W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
  }
  let a = h[0], b = h[1], c = h[2], d = h[3], e = h[4], f = h[5], g = h[6], k = h[7];
  for (let i = 0; i < 64; i++) {
    const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
    const t1 = (k + S1 + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
    const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
    const t2 = (S0 + ((a & b) ^ (a & c) ^ (b & c))) | 0;
    k = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
  }
  h[0] = (h[0] + a) | 0; h[1] = (h[1] + b) | 0; h[2] = (h[2] + c) | 0; h[3] = (h[3] + d) | 0;
  h[4] = (h[4] + e) | 0; h[5] = (h[5] + f) | 0; h[6] = (h[6] + g) | 0; h[7] = (h[7] + k) | 0;
}

const toWords = (bytes: Uint8Array, at: number, out: Uint32Array) => {
  for (let i = 0; i < 16; i++) {
    const j = at + i * 4;
    out[i] = (bytes[j] << 24) | (bytes[j + 1] << 16) | (bytes[j + 2] << 8) | bytes[j + 3];
  }
};

const toBytes = (h: Uint32Array): Uint8Array => {
  const out = new Uint8Array(32);
  for (let i = 0; i < 8; i++) {
    out[i * 4] = h[i] >>> 24; out[i * 4 + 1] = h[i] >>> 16; out[i * 4 + 2] = h[i] >>> 8; out[i * 4 + 3] = h[i];
  }
  return out;
};

/** Hashes `data` starting from state `start` that already absorbed `before` bytes. */
function finish(start: ArrayLike<number>, before: number, data: Uint8Array): Uint8Array {
  const h = new Uint32Array(start);
  const total = before + data.length;
  const padded = new Uint8Array(Math.ceil((data.length + 9) / 64) * 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const bits = total * 8;
  const end = padded.length;
  padded[end - 5] = Math.floor(bits / 2 ** 32) & 0xff;
  padded[end - 4] = bits >>> 24; padded[end - 3] = bits >>> 16; padded[end - 2] = bits >>> 8; padded[end - 1] = bits;
  const words = new Uint32Array(16);
  for (let at = 0; at < padded.length; at += 64) {
    toWords(padded, at, words);
    compress(h, words);
  }
  return toBytes(h);
}

export const sha256 = (data: Uint8Array): Uint8Array => finish(IV, 0, data);

/** The state after the 64-byte HMAC pad block, so each PBKDF2 round skips it. */
const padState = (key: Uint8Array, pad: number): Uint32Array => {
  const block = new Uint8Array(64);
  for (let i = 0; i < 64; i++) block[i] = (key[i] ?? 0) ^ pad;
  const h = new Uint32Array(IV);
  const words = new Uint32Array(16);
  toWords(block, 0, words);
  compress(h, words);
  return h;
};

const hmacKey = (key: Uint8Array) => (key.length > 64 ? sha256(key) : key);

export const hmacSha256 = (key: Uint8Array, data: Uint8Array): Uint8Array => {
  const k = hmacKey(key);
  return finish(padState(k, 0x5c), 64, finish(padState(k, 0x36), 64, data));
};

/** PBKDF2-HMAC-SHA-256 for one 32-byte block, which is all a PIN check needs. */
export function pbkdf2Sha256(password: Uint8Array, salt: Uint8Array, iterations: number): Uint8Array {
  const k = hmacKey(password);
  const inner = padState(k, 0x36);
  const outer = padState(k, 0x5c);
  const first = new Uint8Array(salt.length + 4);
  first.set(salt);
  first[salt.length + 3] = 1;
  let u = finish(outer, 64, finish(inner, 64, first));
  const out = u.slice();
  // Every later round hashes exactly 32 bytes, so the padded block is built once and reused.
  const block = new Uint8Array(64);
  block[32] = 0x80;
  block[62] = 0x03; // (64 + 32) * 8 = 768 bits = 0x0300
  const words = new Uint32Array(16);
  const h = new Uint32Array(8);
  for (let n = 1; n < iterations; n++) {
    block.set(u);
    toWords(block, 0, words);
    h.set(inner);
    compress(h, words);
    block.set(toBytes(h));
    toWords(block, 0, words);
    h.set(outer);
    compress(h, words);
    u = toBytes(h);
    for (let i = 0; i < 32; i++) out[i] ^= u[i];
  }
  return out;
}

export const utf8 = (text: string): Uint8Array => {
  const out: number[] = [];
  for (const ch of text) {
    let c = ch.codePointAt(0)!;
    if (c < 0x80) out.push(c);
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return new Uint8Array(out);
};

export const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const fromHex = (hex: string): Uint8Array | null => {
  if (!/^(?:[0-9a-f]{2})*$/i.test(hex)) return null;
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
};
