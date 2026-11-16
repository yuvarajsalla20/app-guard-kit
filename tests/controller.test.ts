import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeKit } from './fakes';

afterEach(() => vi.useRealTimers());

/** A kit with user u1 who already set PIN 2580, starting locked. */
async function lockedKit(options = {}) {
  const t = makeKit(options);
  await t.c.setUser('u1');
  expect(t.c.getState().phase).toBe('setup');
  expect(await t.c.setPin('2580')).toBeNull();
  t.c.dismissOffer();
  // A cold start: a new controller over the same Keychain.
  const again = makeKit(options);
  for (const [k, v] of t.items) again.items.set(k, v);
  await again.c.setUser('u1');
  return again;
}

describe('first PIN', () => {
  it('starts in starting, asks for a PIN after sign-in, refuses obvious ones, then opens and offers Face ID', async () => {
    const { c } = makeKit();
    expect(c.getState().phase).toBe('starting');
    await c.setUser('u1');
    expect(c.getState().phase).toBe('setup');
    expect(await c.setPin('1234')).toBe('obvious');
    expect(await c.setPin('25')).toBe('length');
    expect(await c.setPin('2580')).toBeNull();
    expect(c.getState()).toMatchObject({ phase: 'open', revealed: false, offerBiometrics: true, biometricKind: 'face' });
  });

  it('saves only a salted hash, in "this device only" Keychain items', async () => {
    const { c, items } = makeKit();
    await c.setUser('u1');
    await c.setPin('2580');
    const all = [...items.values()];
    expect(all.some((i) => i.value.includes('2580'))).toBe(false);
    expect(items.get('appguard.u1.pin')!.value).toMatch(/^pbkdf2-sha256\$10000\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(all.every((i) => i.options?.keychainAccessible === 5)).toBe(true);
  });

  it('no Face ID offer when the phone has none', async () => {
    const t = makeKit();
    t.bio.enrolled = false;
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    expect(t.c.getState()).toMatchObject({ offerBiometrics: false, biometricKind: null });
  });
});

describe('lock screen', () => {
  it('a cold start is locked with amounts hidden', async () => {
    const { c } = await lockedKit();
    expect(c.getState()).toMatchObject({ phase: 'locked', revealed: false });
  });

  it('the right PIN opens; a wrong one says how many tries are left', async () => {
    const { c } = await lockedKit();
    expect(await c.unlockWithPin('1111')).toBe('wrong');
    expect(c.triesLeft()).toBe(4);
    expect(await c.unlockWithPin('2580')).toBe('ok');
    expect(c.getState().phase).toBe('open');
    expect(c.triesLeft()).toBe(5);
  });

  it('waits after 5 wrong, survives a restart, and needs sign-in after 10; nothing is erased', async () => {
    const t = await lockedKit();
    for (let i = 0; i < 5; i++) await t.c.unlockWithPin('0000');
    expect(t.c.waitSeconds()).toBe(30);
    expect(await t.c.unlockWithPin('2580')).toBe('wait');

    // Restart during the wait: still waiting.
    const again = makeKit();
    for (const [k, v] of t.items) again.items.set(k, v);
    again.clock.set(t.clock.now());
    await again.c.setUser('u1');
    expect(again.c.waitSeconds()).toBe(30);

    let waited = 0;
    for (const wait of [30, 60, 300, 900, 900]) {
      again.clock.advance(wait * 1000);
      waited++;
      if (waited < 5) expect(await again.c.unlockWithPin('0000')).toBe('wrong');
    }
    expect(await again.c.unlockWithPin('0000')).toBe('reconfirm');
    expect(again.c.getState()).toMatchObject({ phase: 'locked', reconfirmNeeded: true });
    expect(await again.c.unlockWithPin('2580')).toBe('reconfirm');
    expect(again.items.has('appguard.u1.pin')).toBe(true);
  });

  it('a missing saved PIN can only be fixed by signing in again', async () => {
    const t = await lockedKit();
    t.items.delete('appguard.u1.pin');
    expect(await t.c.unlockWithPin('2580')).toBe('reconfirm');
    expect(t.c.getState().reconfirmNeeded).toBe(true);
  });
});

describe('Forgot PIN', () => {
  it('signs in again, clears the PIN and Face ID, and asks for a new PIN', async () => {
    const reconfirm = vi.fn(async () => true);
    const t = await lockedKit({ reconfirm });
    expect(await t.c.forgotPin()).toBe(true);
    expect(reconfirm).toHaveBeenCalledOnce();
    expect(t.c.getState()).toMatchObject({ phase: 'setup', setupCancellable: false, reconfirmNeeded: false });
    expect(t.items.has('appguard.u1.pin')).toBe(false);
    expect(await t.c.setPin('7391')).toBeNull();
    expect(t.c.getState().phase).toBe('open');
  });

  it('cancelling or failing the sign-in changes nothing', async () => {
    const t = await lockedKit({ reconfirm: async () => false });
    expect(await t.c.forgotPin()).toBe(false);
    expect(t.c.getState().phase).toBe('locked');
    const t2 = await lockedKit({ reconfirm: async () => { throw new Error('network'); } });
    expect(await t2.c.forgotPin()).toBe(false);
    expect(t2.errors).toContain('guard.reconfirm');
  });

  it('is not offered without reconfirm', async () => {
    const t = await lockedKit();
    expect(t.c.canReconfirm()).toBe(false);
    expect(await t.c.forgotPin()).toBe(false);
  });
});

describe('Face ID', () => {
  async function withFaceId() {
    const t = makeKit();
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    expect(await t.c.enableBiometrics()).toBe(true);
    const item = t.items.get('appguard.u1.bio')!;
    expect(item.options).toMatchObject({ requireAuthentication: true, keychainAccessible: 6 });
    t.c.appState('background');
    t.c.appState('active');
    expect(t.c.getState().phase).toBe('locked');
    return t;
  }

  it('unlocks', async () => {
    const t = await withFaceId();
    expect(await t.c.unlockWithBiometrics()).toBe('ok');
    expect(t.c.getState().phase).toBe('open');
  });

  it('cancel keeps the PIN pad', async () => {
    const t = await withFaceId();
    t.bio.face = 'cancel';
    expect(await t.c.unlockWithBiometrics()).toBe('cancel');
    expect(t.c.getState()).toMatchObject({ phase: 'locked', notice: null });
    expect(t.errors).toEqual([]);
  });

  it('a new face on the phone turns Face ID off until the PIN', async () => {
    const t = await withFaceId();
    t.bio.face = 'changed';
    expect(await t.c.unlockWithBiometrics()).toBe('changed');
    expect(t.c.getState()).toMatchObject({ phase: 'locked', notice: 'biometricsChanged' });
    expect(t.c.getState().settings.biometrics).toBe(false);
    expect(t.items.has('appguard.u1.bio')).toBe(false);
    expect(await t.c.unlockWithPin('2580')).toBe('ok');
  });

  it('does not reveal amounts unless the app allows it', async () => {
    const t = await withFaceId();
    await t.c.unlockWithBiometrics();
    expect(await t.c.revealWithBiometrics()).toBe('unavailable');
  });

  it('can reveal amounts with pin-or-biometric', async () => {
    const t = makeKit({ revealWith: 'pin-or-biometric' });
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    await t.c.enableBiometrics();
    expect(await t.c.revealWithBiometrics()).toBe('ok');
    expect(t.c.getState().revealed).toBe(true);
  });

  it('the Face ID sheet (app inactive) does not cover or lock', async () => {
    const t = await withFaceId();
    let resolve!: () => void;
    const gate = new Promise<void>((r) => (resolve = r));
    const get = t.modules.store.getItemAsync;
    t.modules.store.getItemAsync = async (k, o) => {
      await gate;
      return get(k, o);
    };
    const pending = t.c.unlockWithBiometrics();
    t.c.appState('inactive');
    expect(t.c.getState().covered).toBe(false);
    resolve();
    expect(await pending).toBe('ok');
  });

  it('really leaving during a Face ID sheet still locks', async () => {
    const t = makeKit();
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    let resolve!: () => void;
    const gate = new Promise<void>((r) => (resolve = r));
    const set = t.modules.store.setItemAsync;
    t.modules.store.setItemAsync = async (k, v, o) => {
      await gate;
      return set(k, v, o);
    };
    const pending = t.c.enableBiometrics();
    t.c.appState('background');
    expect(t.c.getState()).toMatchObject({ phase: 'locked', covered: true });
    resolve();
    await pending;
  });
});

describe('leaving and coming back', () => {
  async function openKit(options = {}) {
    const t = await lockedKit(options);
    await t.c.unlockWithPin('2580');
    return t;
  }

  it('the app switcher covers the screen and hides amounts, without locking', async () => {
    const t = await openKit();
    await t.c.revealWithPin('2580');
    t.c.appState('inactive');
    expect(t.c.getState()).toMatchObject({ covered: true, revealed: false, phase: 'open' });
    t.c.appState('active');
    expect(t.c.getState()).toMatchObject({ covered: false, phase: 'open' });
  });

  it('locks at once on return with grace 0', async () => {
    const t = await openKit();
    t.c.appState('background');
    expect(t.c.getState().phase).toBe('locked');
  });

  it('with a grace time, a short trip stays open and a long one locks', async () => {
    const t = await openKit();
    await t.c.setGraceSeconds(30);
    t.c.appState('background');
    t.clock.advance(10_000);
    t.c.appState('active');
    expect(t.c.getState().phase).toBe('open');
    t.c.appState('background');
    t.clock.advance(31_000);
    t.c.appState('active');
    expect(t.c.getState().phase).toBe('locked');
  });

  it('a clock moved back while away locks', async () => {
    const t = await openKit();
    await t.c.setGraceSeconds(300);
    t.c.appState('background');
    t.clock.advance(-60_000);
    t.c.appState('active');
    expect(t.c.getState().phase).toBe('locked');
  });
});

describe('hidden amounts', () => {
  it('reveal needs the PIN, wrong ones count, and the eye hides at once', async () => {
    const t = await lockedKit();
    expect(await t.c.revealWithPin('2580')).toBe('error'); // locked: nothing to reveal
    await t.c.unlockWithPin('2580');
    expect(await t.c.revealWithPin('9999')).toBe('wrong');
    expect(t.c.triesLeft()).toBe(4);
    expect(await t.c.revealWithPin('2580')).toBe('ok');
    expect(t.c.getState().revealed).toBe(true);
    t.c.hide();
    expect(t.c.getState().revealed).toBe(false);
  });

  it('hides after the idle time, and a touch restarts it', async () => {
    const t = await lockedKit();
    await t.c.unlockWithPin('2580');
    vi.useFakeTimers();
    const revealed = t.c.revealWithPin('2580');
    await vi.advanceTimersByTimeAsync(0);
    expect(await revealed).toBe('ok');
    vi.advanceTimersByTime(50_000);
    t.c.touch();
    vi.advanceTimersByTime(50_000);
    expect(t.c.getState().revealed).toBe(true);
    vi.advanceTimersByTime(10_000);
    expect(t.c.getState().revealed).toBe(false);
  });

  it('too many wrong tries while revealing locks the app', async () => {
    const t = await lockedKit({ limits: { free: 2, waits: [], reconfirmAfter: 2 } });
    await t.c.unlockWithPin('2580');
    await t.c.revealWithPin('1111');
    expect(await t.c.revealWithPin('1111')).toBe('reconfirm');
    expect(t.c.getState()).toMatchObject({ phase: 'locked', reconfirmNeeded: true });
  });

  it('blocks screenshots while shown when asked to', async () => {
    const screenCapture = { preventScreenCaptureAsync: vi.fn(async () => {}), allowScreenCaptureAsync: vi.fn(async () => {}) };
    const t = await lockedKit({ blockScreenshotsWhenRevealed: true, screenCapture });
    await t.c.unlockWithPin('2580');
    await t.c.revealWithPin('2580');
    expect(screenCapture.preventScreenCaptureAsync).toHaveBeenCalledOnce();
    t.c.hide();
    expect(screenCapture.allowScreenCaptureAsync).toHaveBeenCalledOnce();
  });
});

describe('who is signed in', () => {
  it('sign-out wipes the PIN; signing back in asks for a new one', async () => {
    const t = await lockedKit();
    await t.c.setUser(null);
    expect(t.c.getState().phase).toBe('off');
    expect([...t.items.keys()]).toEqual([]);
    await t.c.setUser('u1');
    expect(t.c.getState().phase).toBe('setup');
  });

  it("another person signing in wipes the previous person's data", async () => {
    const t = await lockedKit();
    await t.c.setUser('u2');
    expect(t.items.has('appguard.u1.pin')).toBe(false);
    expect(t.c.getState().phase).toBe('setup');
  });

  it('clear() (Delete account) wipes everything', async () => {
    const t = await lockedKit();
    await t.c.clear();
    expect([...t.items.keys()]).toEqual([]);
    expect(t.c.getState().phase).toBe('off');
  });
});

describe('change PIN and optional lock', () => {
  it('changes the PIN after the current one', async () => {
    const t = await lockedKit();
    await t.c.unlockWithPin('2580');
    expect(await t.c.changePin('1111', '7391')).toBe('wrong');
    expect(await t.c.changePin('2580', '1234')).toBe('obvious');
    expect(await t.c.changePin('2580', '7391')).toBe('ok');
    t.c.appState('background');
    t.c.appState('active');
    expect(await t.c.unlockWithPin('2580')).toBe('wrong');
    expect(await t.c.unlockWithPin('7391')).toBe('ok');
  });

  it('requirePin apps cannot turn the lock off', async () => {
    const t = await lockedKit();
    await t.c.unlockWithPin('2580');
    expect(await t.c.turnOffLock('2580')).toBe('error');
  });

  it('optional lock: starts off, eye shows amounts without a PIN, can be turned on and off again', async () => {
    const t = makeKit({ requirePin: false });
    await t.c.setUser('u1');
    expect(t.c.getState().phase).toBe('off');
    expect(t.c.revealWithoutPin()).toBe(true);
    t.c.hide();
    t.c.turnOnLock();
    expect(t.c.getState()).toMatchObject({ phase: 'setup', setupCancellable: true });
    t.c.cancelSetup();
    expect(t.c.getState().phase).toBe('off');
    t.c.turnOnLock();
    await t.c.setPin('2580');
    expect(t.c.revealWithoutPin()).toBe(false);
    expect(await t.c.turnOffLock('1111')).toBe('wrong');
    expect(await t.c.turnOffLock('2580')).toBe('ok');
    expect(t.c.getState().phase).toBe('off');
    expect(t.items.has('appguard.u1.pin')).toBe(false);
  });
});
