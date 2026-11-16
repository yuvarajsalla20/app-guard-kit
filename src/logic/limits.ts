/** How many wrong PINs are allowed before waits start, the waits, and when to sign in again. */
export interface TryLimits {
  /** Wrong tries before the first wait. Default 5. */
  free: number;
  /** Waits in seconds, one per wrong try after `free`; the last one repeats. Default 30 s, 1 min, 5 min, 15 min. */
  waits: readonly number[];
  /** After this many wrong tries the person must sign in again (the app's `reconfirm`) and set a new PIN. Default 10. */
  reconfirmAfter: number;
}

export const DEFAULT_LIMITS: TryLimits = { free: 5, waits: [30, 60, 300, 900], reconfirmAfter: 10 };

/** Saved between launches. Times are the phone's clock in ms. */
export interface TryState {
  fails: number;
  /** No PIN is checked before this time. */
  waitUntil: number;
  /** When the wait was set: a clock now earlier than this was moved back, so the wait starts over. */
  setAt: number;
}

export const NO_TRIES: TryState = { fails: 0, waitUntil: 0, setAt: 0 };

export const mustReconfirm = (s: TryState, limits: TryLimits) => s.fails >= limits.reconfirmAfter;

/** The state after one more wrong PIN at `now`. */
export function afterWrong(s: TryState, limits: TryLimits, now: number): TryState {
  const fails = s.fails + 1;
  if (fails < limits.free || fails >= limits.reconfirmAfter || limits.waits.length === 0) return { fails, waitUntil: 0, setAt: 0 };
  const wait = limits.waits[Math.min(fails - limits.free, limits.waits.length - 1)];
  return { fails, waitUntil: now + wait * 1000, setAt: now };
}

/**
 * The state as of `now`. A clock that was moved back makes the wait start again from now, so changing the
 * phone's time cannot shorten it. Moving the clock forward can skip a wait, but every wrong try still counts
 * toward `reconfirmAfter`, which always ends in signing in again.
 */
export function settle(s: TryState, now: number): TryState {
  if (s.waitUntil > 0 && now < s.setAt) return { ...s, waitUntil: now + (s.waitUntil - s.setAt), setAt: now };
  return s;
}

/** Seconds left to wait at `now`, 0 when a PIN may be tried. */
export const secondsLeft = (s: TryState, now: number) => (s.waitUntil > now ? Math.ceil((s.waitUntil - now) / 1000) : 0);

/** Tries left before the next wait (or before signing in again, once waits have started). */
export function triesLeft(s: TryState, limits: TryLimits): number {
  if (s.fails < limits.free) return limits.free - s.fails;
  return Math.max(0, limits.reconfirmAfter - s.fails);
}

export function parseTries(raw: string | null | undefined): TryState {
  try {
    const v = JSON.parse(raw ?? '') as Partial<TryState> | null;
    const n = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) && x >= 0 ? x : 0);
    return { fails: Math.floor(n(v?.fails)), waitUntil: n(v?.waitUntil), setAt: n(v?.setAt) };
  } catch {
    return NO_TRIES;
  }
}
