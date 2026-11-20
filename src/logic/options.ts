import { DEFAULT_LIMITS, type TryLimits } from './limits';
import { sha256, toHex, utf8 } from './sha256';

export type RevealWith = 'pin' | 'pin-or-biometric';

/** The choices an app makes once, in `createGuardKit`. Every one has a default. */
export interface GuardConfig {
  /** The lock cannot be turned off, and a PIN is set up right after sign-in. Default true. */
  requirePin: boolean;
  /** 4 or 6 digits. Default 4. */
  pinLength: 4 | 6;
  /** Refuse PINs like 1234, 0000 or 1212. Default true. */
  rejectObviousPins: boolean;
  /** Offer Face ID / Touch ID as the quick way in. Default true. */
  biometrics: boolean;
  /** How long the app may be away before it locks again, in seconds. Default 0 (every time). The person can change it in Settings. */
  graceSeconds: number;
  /** Choices for "Lock after" in Settings, in seconds. */
  graceChoices: readonly number[];
  /** Hide amounts after this many seconds with no touch. Default 60. The person can change it in Settings. */
  idleHideSeconds: number;
  /** Choices for "Hide amounts after" in Settings, in seconds. */
  idleChoices: readonly number[];
  /** What may reveal hidden amounts. Default 'pin'. */
  revealWith: RevealWith;
  /** Wrong-PIN waits and when to sign in again. */
  limits: TryLimits;
  /** Block screenshots and screen recording while amounts are shown. Needs `screenCapture`. Default false. */
  blockScreenshotsWhenRevealed: boolean;
  /**
   * 1.5.0. With the lock off, amounts still start hidden and the eye shows them without a PIN. Default true.
   * False: amounts hide only while the lock is on, and the eye is not drawn while it is off (for apps where the lock is optional).
   */
  hideAmountsWithoutLock: boolean;
}

export const DEFAULT_CONFIG: GuardConfig = {
  requirePin: true,
  pinLength: 4,
  rejectObviousPins: true,
  biometrics: true,
  graceSeconds: 0,
  graceChoices: [0, 30, 60, 300],
  idleHideSeconds: 60,
  idleChoices: [30, 60, 120, 300],
  revealWith: 'pin',
  limits: DEFAULT_LIMITS,
  blockScreenshotsWhenRevealed: false,
  hideAmountsWithoutLock: true,
};

const whole = (n: unknown, fallback: number, min: number, max: number) =>
  typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;

/** Fills in defaults and keeps numbers in sane ranges, so a typo cannot turn the lock off. */
export function normalizeConfig(input: Partial<GuardConfig> = {}): GuardConfig {
  const c = { ...DEFAULT_CONFIG, ...input };
  const limitsIn = { ...DEFAULT_LIMITS, ...input.limits };
  const free = whole(limitsIn.free, DEFAULT_LIMITS.free, 1, 20);
  const limits: TryLimits = {
    free,
    waits: (limitsIn.waits ?? DEFAULT_LIMITS.waits).map((w) => whole(w, 30, 1, 86_400)),
    reconfirmAfter: Math.max(free, whole(limitsIn.reconfirmAfter, DEFAULT_LIMITS.reconfirmAfter, 1, 50)),
  };
  const list = (xs: readonly number[] | undefined, fallback: readonly number[], max: number) => {
    const clean = [...new Set((xs ?? []).map((x) => whole(x, -1, 0, max)).filter((x) => x >= 0))].sort((a, b) => a - b);
    return clean.length ? clean : fallback;
  };
  return {
    requirePin: c.requirePin !== false,
    pinLength: c.pinLength === 6 ? 6 : 4,
    rejectObviousPins: c.rejectObviousPins !== false,
    biometrics: c.biometrics !== false,
    graceSeconds: whole(c.graceSeconds, 0, 0, 3600),
    graceChoices: list(c.graceChoices, DEFAULT_CONFIG.graceChoices, 3600),
    idleHideSeconds: whole(c.idleHideSeconds, 60, 5, 3600),
    idleChoices: list(c.idleChoices, DEFAULT_CONFIG.idleChoices, 3600).filter((x) => x >= 5),
    revealWith: c.revealWith === 'pin-or-biometric' ? 'pin-or-biometric' : 'pin',
    limits,
    blockScreenshotsWhenRevealed: c.blockScreenshotsWhenRevealed === true,
    hideAmountsWithoutLock: c.hideAmountsWithoutLock !== false,
  };
}

/** What the person changed in Settings, saved on the phone. */
export interface GuardSettings {
  /** The lock is on (always true when `requirePin`). */
  lock: boolean;
  biometrics: boolean;
  graceSeconds: number;
  idleHideSeconds: number;
}

export const defaultSettings = (c: GuardConfig): GuardSettings => ({
  lock: c.requirePin,
  biometrics: false,
  graceSeconds: c.graceSeconds,
  idleHideSeconds: c.idleHideSeconds,
});

export function parseSettings(raw: string | null | undefined, c: GuardConfig): GuardSettings {
  const base = defaultSettings(c);
  try {
    const v = JSON.parse(raw ?? '') as Partial<GuardSettings> | null;
    if (!v || typeof v !== 'object') return base;
    return {
      lock: c.requirePin || v.lock === true,
      biometrics: c.biometrics && v.biometrics === true,
      graceSeconds: whole(v.graceSeconds, base.graceSeconds, 0, 3600),
      idleHideSeconds: whole(v.idleHideSeconds, base.idleHideSeconds, 5, 3600),
    };
  } catch {
    return base;
  }
}

/** Keychain keys may hold only letters, digits, `.`, `-` and `_`. Other ids (and very long ones) become a hash, so two ids never share a key. */
export const safeKeyPart = (id: string) => (/^[A-Za-z0-9_-]{1,128}$/.test(id) ? id : `h.${toHex(sha256(utf8(id)))}`);
