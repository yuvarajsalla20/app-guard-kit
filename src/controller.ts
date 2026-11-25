import { afterWrong, mustReconfirm, NO_TRIES, parseTries, settle, secondsLeft, triesLeft, type TryState } from './logic/limits';
import { defaultSettings, parseSettings, type GuardSettings } from './logic/options';
import { checkPinAsync, derivePinJs, hashPinAsync, pinProblem, type PinProblem } from './logic/pin';
import { toHex } from './logic/sha256';
import { detectBiometrics } from './biometrics';
import type { BiometricResult, ControllerDeps, GuardState, Phase, PinResult } from './controllerTypes';
import { ALL_ITEMS, GuardVault } from './vault';

export type { BiometricKind, BiometricResult, ControllerDeps, GuardState, Phase, PinResult } from './controllerTypes';

/** The whole lock as plain logic, with no React. `GuardProvider` draws it; tests drive it directly. */
export class GuardController {
  private state: GuardState;
  private listeners = new Set<() => void>();
  private userId: string | null | undefined = undefined;
  private generation = 0;
  private awayAt: number | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  /** A system sheet (Face ID, Apple sign-in) is up: iOS reports the app as inactive, which must not cover or lock. */
  private prompting = 0;
  private readonly now: () => number;
  private readonly vault: GuardVault;

  constructor(private readonly deps: ControllerDeps) {
    this.now = deps.now ?? Date.now;
    this.vault = new GuardVault(deps.modules, (where, e) => this.report(where, e));
    this.state = {
      phase: 'starting',
      revealed: false,
      covered: false,
      settings: defaultSettings(deps.config),
      biometricKind: null,
      offerBiometrics: false,
      setupCancellable: false,
      tries: NO_TRIES,
      reconfirmNeeded: false,
      notice: null,
    };
  }

  // ── State ────────────────────────────────────────────────────────────────

  getState = (): GuardState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** The PIN stretcher: the app's native one when given, else the kit's sliced JavaScript one. */
  private get derive() {
    return this.deps.modules.pbkdf2 ?? derivePinJs;
  }

  private set(patch: Partial<GuardState>) {
    // Nothing changes: no new state and no redraw of every amount (app switches send several such patches).
    if ((Object.keys(patch) as (keyof GuardState)[]).every((k) => Object.is(this.state[k], patch[k]))) return;
    const wasRevealed = this.state.revealed;
    this.state = { ...this.state, ...patch };
    if (wasRevealed !== this.state.revealed) this.revealChanged();
    for (const l of [...this.listeners]) l();
  }

  private report(where: string, error: unknown) {
    try {
      this.deps.onError?.(`guard.${where}`, error);
    } catch {
      // a broken reporter must not break the lock
    }
  }

  private get config() {
    return this.deps.config;
  }

  // ── Who is signed in ─────────────────────────────────────────────────────

  /**
   * Tell the kit who is signed in: `undefined` while sign-in is still loading, `null` when signed out.
   * Signing out (or a different person signing in) wipes the previous person's PIN and settings from this phone.
   */
  setUser = async (userId: string | null | undefined): Promise<void> => {
    if (userId === this.userId) return;
    this.userId = userId;
    const gen = ++this.generation;
    this.clearIdle();
    this.awayAt = null;
    if (userId === undefined) {
      this.set({ phase: 'starting', revealed: false, offerBiometrics: false, notice: null });
      return;
    }
    try {
      const last = await this.vault.lastUser();
      if (gen !== this.generation) return;
      if (last && last !== userId) await this.vault.remove(last, ALL_ITEMS);
      if (userId === null) {
        if (last) await this.vault.forgetUser();
        if (gen !== this.generation) return;
        this.set({ phase: 'off', revealed: false, offerBiometrics: false, reconfirmNeeded: false, tries: NO_TRIES, notice: null, settings: defaultSettings(this.config) });
        return;
      }
      if (last !== userId) await this.vault.rememberUser(userId);
      const [pin, rawSettings, rawTries] = await Promise.all([
        this.vault.read(userId, 'pin'),
        this.vault.read(userId, 'settings'),
        this.vault.read(userId, 'tries'),
      ]);
      const biometricKind = await detectBiometrics(this.deps.modules.biometrics, this.config, (e) => this.report('biometrics', e));
      if (gen !== this.generation) return;
      const settings = parseSettings(rawSettings, this.config);
      const tries = settle(parseTries(rawTries), this.now());
      const reconfirmNeeded = mustReconfirm(tries, this.config.limits);
      let phase: Phase;
      if (!settings.lock) phase = 'off';
      else if (!pin) phase = reconfirmNeeded ? 'locked' : 'setup';
      else phase = 'locked';
      this.set({ phase, settings, tries, reconfirmNeeded, biometricKind, revealed: false, offerBiometrics: false, setupCancellable: false, notice: null });
    } catch (e) {
      if (gen !== this.generation) return;
      this.report('load', e);
      // The Keychain could not be read (very rare). Stay safe: locked when someone is signed in.
      this.set({ phase: userId === null ? 'off' : 'locked', revealed: false });
    }
  };

  /** For Delete account (call it from the app's `eraseData`): removes this person's PIN, Face ID and settings from the Keychain. */
  clear = async (): Promise<void> => {
    const id = this.userId;
    this.clearIdle();
    if (id) await this.vault.remove(id, ALL_ITEMS);
    await this.vault.forgetUser().catch((e) => this.report('wipe', e));
    this.set({ phase: 'off', revealed: false, tries: NO_TRIES, reconfirmNeeded: false, offerBiometrics: false, settings: defaultSettings(this.config) });
  };

  // ── PIN ──────────────────────────────────────────────────────────────────

  /** What is wrong with a new PIN, or null. */
  problemWith = (pin: string): PinProblem | null => pinProblem(pin, this.config.pinLength, this.config.rejectObviousPins);

  /** Saves a first (or new, after Forgot PIN) PIN and opens the app. The screen has already asked for it twice. */
  setPin = async (pin: string): Promise<PinProblem | 'error' | null> => {
    const problem = this.problemWith(pin);
    if (problem) return problem;
    if (!this.userId) return 'error';
    try {
      await this.savePin(pin);
      const settings = { ...this.state.settings, lock: true };
      await this.saveSettings(settings);
      await this.saveTries(NO_TRIES);
      this.set({
        phase: 'open',
        settings,
        tries: NO_TRIES,
        reconfirmNeeded: false,
        setupCancellable: false,
        offerBiometrics: !!this.state.biometricKind && !settings.biometrics,
      });
      return null;
    } catch (e) {
      this.report('setPin', e);
      return 'error';
    }
  };

  private async savePin(pin: string) {
    const salt = this.deps.modules.randomBytes(16);
    await this.vault.write(this.userId, 'pin', await hashPinAsync(pin, salt, undefined, this.derive));
  }

  private async saveSettings(settings: GuardSettings) {
    await this.vault.write(this.userId, 'settings', JSON.stringify(settings));
  }

  private async saveTries(tries: TryState) {
    await this.vault.write(this.userId, 'tries', JSON.stringify(tries));
  }

  /** Tries left before the next wait (or before signing in again). */
  triesLeft = (): number => triesLeft(this.state.tries, this.config.limits);

  /** Checks the PIN without opening anything (the first step of Change PIN). Wrong tries count. */
  confirmPin = (pin: string): Promise<PinResult> => this.verify(pin);

  /** Seconds before another PIN may be tried. */
  waitSeconds = (): number => secondsLeft(this.state.tries, this.now());

  /**
   * Checks a PIN. Every wrong one counts toward the waits and the sign-in limit, wherever it was typed.
   * Too many wrong tries locks the app and asks the person to sign in again.
   */
  private async verify(pin: string): Promise<PinResult> {
    const now = this.now();
    const tries = settle(this.state.tries, now);
    if (this.state.reconfirmNeeded || mustReconfirm(tries, this.config.limits)) return 'reconfirm';
    if (secondsLeft(tries, now) > 0) return 'wait';
    let record: string | null;
    try {
      record = await this.vault.read(this.userId, 'pin');
    } catch (e) {
      this.report('readPin', e);
      return 'error';
    }
    if (!record) {
      // The saved PIN is gone, so nothing can be checked: only signing in again can open the app.
      this.set({ reconfirmNeeded: true, phase: this.state.phase === 'off' ? 'off' : 'locked', revealed: false });
      return 'reconfirm';
    }
    await new Promise((r) => setTimeout(r, 0)); // let the screen show it is checking before the hashing work
    if (await checkPinAsync(pin, record, this.derive)) {
      if (tries.fails > 0) await this.saveTries(NO_TRIES).catch((e) => this.report('saveTries', e));
      this.set({ tries: NO_TRIES });
      return 'ok';
    }
    const next = afterWrong(tries, this.config.limits, this.now());
    await this.saveTries(next).catch((e) => this.report('saveTries', e));
    if (mustReconfirm(next, this.config.limits)) {
      this.clearIdle();
      this.set({ tries: next, reconfirmNeeded: true, phase: 'locked', revealed: false });
      return 'reconfirm';
    }
    this.set({ tries: next });
    return 'wrong';
  }

  /** The lock screen's PIN. */
  unlockWithPin = async (pin: string): Promise<PinResult> => {
    if (this.state.phase !== 'locked') return 'error';
    const result = await this.verify(pin);
    if (result === 'ok') this.set({ phase: 'open', notice: null });
    return result;
  };

  /** Changes the PIN after checking the current one. */
  changePin = async (current: string, next: string): Promise<PinResult | PinProblem> => {
    const problem = this.problemWith(next);
    if (problem) return problem;
    const result = await this.verify(current);
    if (result !== 'ok') return result;
    try {
      await this.savePin(next);
      return 'ok';
    } catch (e) {
      this.report('changePin', e);
      return 'error';
    }
  };

  // ── Face ID / Touch ID ───────────────────────────────────────────────────

  /** True when Face ID can open the lock right now. */
  canUseBiometrics = (): boolean => {
    const s = this.state;
    return !!s.biometricKind && s.settings.biometrics && !s.reconfirmNeeded;
  };

  /**
   * Face ID reads a secret that iOS keeps behind Face ID for "the faces enrolled now". If someone adds a face,
   * iOS deletes it, the read finds nothing, and the kit turns Face ID off until the PIN is entered.
   */
  private async biometricCheck(): Promise<BiometricResult> {
    if (!this.canUseBiometrics()) return 'unavailable';
    this.prompting++;
    try {
      const value = await this.vault.readBio(this.userId, this.deps.biometricPrompt());
      if (value) return 'ok';
      const settings = { ...this.state.settings, biometrics: false };
      await this.saveSettings(settings).catch((e) => this.report('saveSettings', e));
      await this.vault.dropBio(this.userId);
      this.set({ settings, notice: 'biometricsChanged' });
      return 'changed';
    } catch {
      // Cancelled, failed, locked out or timed out: the PIN is always there instead. Not an error to report.
      return 'cancel';
    } finally {
      this.prompting--;
    }
  }

  /**
   * 2.1.0: asks for Face ID to confirm a step (e.g., closing the account) without changing the lock. Reads the same
   * secret as the lock screen, so a newly added face cannot pass.
   */
  confirmWithBiometrics = (): Promise<BiometricResult> => this.biometricCheck();

  unlockWithBiometrics = async (): Promise<BiometricResult> => {
    if (this.state.phase !== 'locked') return 'unavailable';
    const result = await this.biometricCheck();
    if (result === 'ok' && this.state.phase === 'locked') {
      if (this.state.tries.fails > 0) await this.saveTries(NO_TRIES).catch((e) => this.report('saveTries', e));
      this.set({ phase: 'open', tries: NO_TRIES, notice: null });
    }
    return result;
  };

  /** Turns Face ID on. Asks for Face ID once, so it is known to work. */
  enableBiometrics = async (): Promise<boolean> => {
    if (!this.state.biometricKind || !this.userId) return false;
    const token = toHex(this.deps.modules.randomBytes(16));
    this.prompting++;
    try {
      await this.vault.dropBio(this.userId);
      const prompt = this.deps.biometricPrompt();
      await this.vault.writeBio(this.userId, token, prompt);
      const back = await this.vault.readBio(this.userId, prompt);
      if (back !== token) throw new Error('Face ID check did not match');
      const settings = { ...this.state.settings, biometrics: true };
      await this.saveSettings(settings);
      this.set({ settings, offerBiometrics: false, notice: null });
      return true;
    } catch {
      await this.vault.dropBio(this.userId);
      this.set({ offerBiometrics: false });
      return false;
    } finally {
      this.prompting--;
    }
  };

  disableBiometrics = async (): Promise<void> => {
    const settings = { ...this.state.settings, biometrics: false };
    await this.vault.remove(this.userId, ['bio']);
    await this.saveSettings(settings).catch((e) => this.report('saveSettings', e));
    this.set({ settings, offerBiometrics: false });
  };

  /** "Not now" on the Face ID offer. */
  dismissOffer = (): void => this.set({ offerBiometrics: false });

  dismissNotice = (): void => this.set({ notice: null });

  // ── Forgot PIN ───────────────────────────────────────────────────────────

  canReconfirm = (): boolean => !!this.deps.reconfirm;

  /** Forgot PIN, or too many wrong tries: sign in again, then set a new PIN. Resolves false when cancelled. */
  forgotPin = async (): Promise<boolean> => {
    const reconfirm = this.deps.reconfirm;
    if (!reconfirm || !this.userId) return false;
    const gen = this.generation;
    this.prompting++;
    let ok = false;
    try {
      ok = (await reconfirm()) === true;
    } catch (e) {
      this.report('reconfirm', e);
    } finally {
      this.prompting--;
    }
    if (!ok || gen !== this.generation) return false;
    this.clearIdle();
    await this.vault.remove(this.userId, ['pin', 'tries', 'bio']);
    const settings = { ...this.state.settings, biometrics: false, lock: true };
    await this.saveSettings(settings).catch((e) => this.report('saveSettings', e));
    this.set({ phase: 'setup', setupCancellable: false, settings, tries: NO_TRIES, reconfirmNeeded: false, revealed: false, notice: null });
    return true;
  };

  // ── Settings ─────────────────────────────────────────────────────────────

  private async update(patch: Partial<GuardSettings>) {
    const settings = { ...this.state.settings, ...patch };
    this.set({ settings });
    await this.saveSettings(settings).catch((e) => this.report('saveSettings', e));
  }

  setGraceSeconds = (seconds: number) => this.update({ graceSeconds: Math.max(0, Math.round(seconds)) });

  setIdleHideSeconds = async (seconds: number) => {
    await this.update({ idleHideSeconds: Math.max(5, Math.round(seconds)) });
    if (this.state.revealed) this.armIdle();
  };

  /** Apps where the lock is optional: shows the PIN setup, with a way back. */
  turnOnLock = (): void => {
    if (this.state.phase !== 'off' || !this.userId) return;
    this.set({ phase: 'setup', setupCancellable: true });
  };

  /** Closes a setup that `turnOnLock` opened. */
  cancelSetup = (): void => {
    if (this.state.phase === 'setup' && this.state.setupCancellable) this.set({ phase: 'off', setupCancellable: false });
  };

  /** Apps where the lock is optional: turning it off needs the PIN. Never allowed with `requirePin`. */
  turnOffLock = async (pin: string): Promise<PinResult> => {
    if (this.config.requirePin) return 'error';
    const result = await this.verify(pin);
    if (result !== 'ok') return result;
    await this.vault.remove(this.userId, ['pin', 'bio']);
    await this.update({ lock: false, biometrics: false });
    this.set({ phase: 'off' });
    return 'ok';
  };

  // ── Hidden amounts ───────────────────────────────────────────────────────

  /** Face ID may reveal amounts too (`revealWith: 'pin-or-biometric'`). */
  canRevealWithBiometrics = (): boolean => this.config.revealWith === 'pin-or-biometric' && this.canUseBiometrics();

  revealWithPin = async (pin: string): Promise<PinResult> => {
    if (!this.canReveal()) return 'error';
    const result = await this.verify(pin);
    if (result === 'ok') this.set({ revealed: true });
    return result;
  };

  revealWithBiometrics = async (): Promise<BiometricResult> => {
    if (!this.canReveal() || !this.canRevealWithBiometrics()) return 'unavailable';
    const result = await this.biometricCheck();
    if (result === 'ok' && this.canReveal()) this.set({ revealed: true });
    return result;
  };

  /** Amounts can be revealed with the PIN only while the app is open and in front. */
  private canReveal() {
    return this.state.phase === 'open' && !this.state.covered;
  }

  /** With the lock turned off (apps where it is optional) there is no PIN to ask, so the eye simply shows the amounts. */
  revealWithoutPin = (): boolean => {
    if (this.state.phase !== 'off' || this.state.covered || !this.userId) return false;
    this.set({ revealed: true });
    return true;
  };

  /** True when the eye needs a PIN (the lock is on). */
  needsPinToReveal = (): boolean => this.state.phase !== 'off';

  hide = (): void => {
    if (this.state.revealed) this.set({ revealed: false });
  };

  /** Any touch on the screen: restarts the idle timer while amounts show. */
  touch = (): void => {
    if (this.state.revealed) this.armIdle();
  };

  private armIdle() {
    this.clearIdle();
    this.idleTimer = setTimeout(() => {
      this.idleTimer = null;
      this.hide();
    }, this.state.settings.idleHideSeconds * 1000);
  }

  private clearIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
  }

  private revealChanged() {
    const shown = this.state.revealed;
    if (shown) this.armIdle();
    else this.clearIdle();
    const capture = this.deps.screenCapture;
    if (capture && this.config.blockScreenshotsWhenRevealed) {
      (shown ? capture.preventScreenCaptureAsync('app-guard-kit') : capture.allowScreenCaptureAsync('app-guard-kit')).catch((e) => this.report('screenCapture', e));
    }
  }

  // ── App in front or not ──────────────────────────────────────────────────

  /** React Native's AppState: 'active', 'inactive' (app switcher, a system sheet) or 'background'. */
  appState = (next: string): void => {
    if (next === 'active') {
      const away = this.awayAt;
      this.awayAt = null;
      const s = this.state;
      let phase = s.phase;
      if (away !== null && s.phase === 'open' && s.settings.lock) {
        const gone = this.now() - away;
        if (gone < 0 || gone >= s.settings.graceSeconds * 1000) phase = 'locked';
      }
      // A wait that ran out while away, or a clock moved back, is settled on return.
      this.set({ covered: false, phase, tries: settle(s.tries, this.now()) });
      return;
    }
    if (next === 'inactive') {
      if (this.prompting > 0) return; // the Face ID or sign-in sheet makes the app inactive: not really leaving
      this.set({ covered: true, revealed: false });
      return;
    }
    if (next === 'background') {
      if (this.awayAt === null) this.awayAt = this.now();
      const lockNow = this.state.phase === 'open' && this.state.settings.lock && this.state.settings.graceSeconds === 0;
      this.set({ covered: true, revealed: false, phase: lockNow ? 'locked' : this.state.phase });
    }
  };

  /** Stops timers (the provider calls this when it unmounts). */
  dispose = (): void => {
    this.clearIdle();
    this.listeners.clear();
  };
}
