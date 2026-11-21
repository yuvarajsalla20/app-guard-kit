import { createHash, createHmac, pbkdf2Sync } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { KIT_NAME, KIT_VERSION } from '../src/kit';
import { DEFAULT_LIMITS, afterWrong, mustReconfirm, NO_TRIES, parseTries, secondsLeft, settle, triesLeft } from '../src/logic/limits';
import { normalizeConfig, parseSettings, safeKeyPart } from '../src/logic/options';
import { checkPin, checkPinAsync, hashPin, hashPinAsync, isObviousPin, pinProblem } from '../src/logic/pin';
import { hmacSha256, pbkdf2Sha256, pbkdf2Sha256Async, sha256, toHex, utf8 } from '../src/logic/sha256';

describe('kit version', () => {
  it('matches package.json', () => {
    const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
    expect([KIT_NAME, KIT_VERSION]).toEqual([pkg.name, pkg.version]);
  });
});

describe('sha256 / hmac / pbkdf2 match node:crypto', () => {
  const inputs = ['', 'abc', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(200), 'é漢😀'];
  it.each(inputs)('sha256 of %#', (s) => expect(toHex(sha256(utf8(s)))).toBe(createHash('sha256').update(s).digest('hex')));
  it.each(inputs)('hmac of %#', (s) => {
    for (const key of ['k', 'k'.repeat(64), 'k'.repeat(90)]) expect(toHex(hmacSha256(utf8(key), utf8(s)))).toBe(createHmac('sha256', key).update(s).digest('hex'));
  });
  it.each([1, 2, 3, 1000])('pbkdf2 with %i rounds', (rounds) => {
    expect(toHex(pbkdf2Sha256(utf8('2580'), utf8('saltsaltsaltsalt'), rounds))).toBe(pbkdf2Sync('2580', 'saltsaltsaltsalt', rounds, 32, 'sha256').toString('hex'));
  });
});

describe('PIN rules', () => {
  it.each(['0000', '1111', '1234', '4321', '9012', '1212', '0909', '123456', '654321', '123123', '112233', '2000'])('%s is obvious', (pin) =>
    expect(isObviousPin(pin)).toBe(true),
  );
  it.each(['2580', '7391', '4826', '835102'])('%s is fine', (pin) => expect(isObviousPin(pin)).toBe(false));
  it('checks length, digits and obviousness', () => {
    expect(pinProblem('258', 4, true)).toBe('length');
    expect(pinProblem('25a0', 4, true)).toBe('digits');
    expect(pinProblem('1234', 4, true)).toBe('obvious');
    expect(pinProblem('1234', 4, false)).toBeNull();
    expect(pinProblem('2580', 4, true)).toBeNull();
    expect(pinProblem('2580', 6, true)).toBe('length');
  });
});

describe('PIN hash', () => {
  const salt = new Uint8Array(16).fill(7);
  it('never contains the PIN and checks right and wrong', () => {
    const record = hashPin('2580', salt, 50);
    expect(record).not.toContain('2580');
    expect(record.startsWith('pbkdf2-sha256$50$')).toBe(true);
    expect(checkPin('2580', record)).toBe(true);
    expect(checkPin('2581', record)).toBe(false);
  });
  it('a damaged record never matches', () => {
    for (const bad of [null, '', 'x', 'pbkdf2-sha256$0$aa$bb', 'md5$1$00$00', `pbkdf2-sha256$5$${'07'.repeat(16)}$abcd`, `pbkdf2-sha256$5$zz$${'00'.repeat(32)}`]) {
      expect(checkPin('2580', bad)).toBe(false);
    }
  });
});

describe('wrong-try limits', () => {
  it('follows 5 free, then 30 s, 1, 5, 15 min, then sign in again at 10', () => {
    let s = NO_TRIES;
    const waits: number[] = [];
    for (let i = 0; i < 10; i++) {
      s = afterWrong(s, DEFAULT_LIMITS, 0);
      waits.push(secondsLeft(s, 0));
    }
    expect(waits).toEqual([0, 0, 0, 0, 30, 60, 300, 900, 900, 0]);
    expect(mustReconfirm(s, DEFAULT_LIMITS)).toBe(true);
  });
  it('counts tries left', () => {
    expect(triesLeft(NO_TRIES, DEFAULT_LIMITS)).toBe(5);
    expect(triesLeft({ fails: 3, waitUntil: 0, setAt: 0 }, DEFAULT_LIMITS)).toBe(2);
    expect(triesLeft({ fails: 6, waitUntil: 0, setAt: 0 }, DEFAULT_LIMITS)).toBe(4);
  });
  it('a clock moved back restarts the wait instead of making it longer or skipping it', () => {
    const s = afterWrong({ fails: 4, waitUntil: 0, setAt: 0 }, DEFAULT_LIMITS, 100_000);
    const moved = settle(s, 50_000);
    expect(secondsLeft(moved, 50_000)).toBe(30);
    expect(settle(s, 110_000)).toBe(s);
  });
  it('reads damaged saved tries as none', () => {
    expect(parseTries('nope')).toEqual(NO_TRIES);
    expect(parseTries('null')).toEqual(NO_TRIES);
    expect(parseTries('{"fails":3.7,"waitUntil":-5}')).toEqual({ fails: 3, waitUntil: 0, setAt: 0 });
  });
});

describe('options', () => {
  it('fills defaults matching the decided choices', () => {
    const c = normalizeConfig();
    expect(c).toMatchObject({ requirePin: true, pinLength: 4, rejectObviousPins: true, graceSeconds: 0, idleHideSeconds: 60, revealWith: 'pin', blockScreenshotsWhenRevealed: false });
    expect(c.limits).toEqual({ free: 5, waits: [30, 60, 300, 900], reconfirmAfter: 10 });
  });
  it('keeps numbers sane', () => {
    const c = normalizeConfig({ pinLength: 5 as never, idleHideSeconds: 0, graceSeconds: -4, limits: { free: 8, waits: [], reconfirmAfter: 3 } });
    expect([c.pinLength, c.idleHideSeconds, c.graceSeconds]).toEqual([4, 5, 0]);
    expect(c.limits.reconfirmAfter).toBe(8);
  });
  it('a requirePin app cannot load the lock as off', () => {
    expect(parseSettings('{"lock":false}', normalizeConfig()).lock).toBe(true);
    expect(parseSettings('{"lock":false}', normalizeConfig({ requirePin: false })).lock).toBe(false);
  });
  it('makes Keychain-safe keys without collisions', () => {
    expect(safeKeyPart('abcXYZ_09-')).toBe('abcXYZ_09-');
    expect(safeKeyPart('a/b')).toMatch(/^h\.[0-9a-f]{64}$/);
    expect(safeKeyPart('a/b')).not.toBe(safeKeyPart('a_b'));
  });
});

describe('sliced PBKDF2 and async PIN checks', () => {
  it.each([1, 2, 499, 500, 501, 1234])('pbkdf2Sha256Async with %i rounds matches node:crypto', async (rounds) => {
    const pauses: number[] = [];
    const got = await pbkdf2Sha256Async(utf8('2580'), utf8('saltsaltsaltsalt'), rounds, async () => void pauses.push(1));
    expect(toHex(got)).toBe(pbkdf2Sync('2580', 'saltsaltsaltsalt', rounds, 32, 'sha256').toString('hex'));
    expect(pauses.length).toBe(Math.max(0, Math.ceil((rounds - 1) / 500) - 1));
  });
  it('hashPinAsync and checkPinAsync agree with the sync versions (old PINs keep working)', async () => {
    const salt = new Uint8Array(16).fill(7);
    const record = hashPin('2580', salt, 50);
    expect(await hashPinAsync('2580', salt, 50)).toBe(record);
    expect(await checkPinAsync('2580', record)).toBe(true);
    expect(await checkPinAsync('2581', record)).toBe(false);
    expect(await checkPinAsync('2580', 'damaged')).toBe(false);
    expect(checkPin('2580', await hashPinAsync('2580', salt, 50))).toBe(true);
  });
});

describe('2.0.0 words', () => {
  it('names the biometric the way each platform does', async () => {
    const { Platform } = await import('react-native');
    const { DEFAULT_STRINGS } = await import('../src/strings');
    expect(DEFAULT_STRINGS.biometricName('face')).toBe('Face ID');
    expect(DEFAULT_STRINGS.biometricName('fingerprint')).toBe('Touch ID');
    (Platform as { OS: string }).OS = 'android';
    expect(DEFAULT_STRINGS.biometricName('face')).toBe('Face Unlock');
    expect(DEFAULT_STRINGS.biometricName('fingerprint')).toBe('Fingerprint');
    (Platform as { OS: string }).OS = 'ios';
  });

  it('shows the Security page in two titled cards by default', async () => {
    const { DEFAULT_STRINGS } = await import('../src/strings');
    expect([DEFAULT_STRINGS.lockGroup, DEFAULT_STRINGS.privacyGroup]).toEqual(['App Lock', 'Privacy']);
  });
});
