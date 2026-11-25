import type { TryState } from './logic/limits';
import type { GuardConfig, GuardSettings } from './logic/options';
import type { GuardModules, ScreenCaptureLike } from './modules';

/**
 * - `starting`: waiting for sign-in or the Keychain; the cover is shown.
 * - `off`: nobody is signed in, or the lock is turned off; the app shows as normal.
 * - `setup`: signed in with no PIN yet; the PIN setup screen is shown.
 * - `locked`: the lock screen is shown.
 * - `open`: unlocked.
 */
export type Phase = 'starting' | 'off' | 'setup' | 'locked' | 'open';

export type BiometricKind = 'face' | 'fingerprint';

export interface GuardState {
  phase: Phase;
  /** Hidden amounts are showing. Memory only: every launch starts hidden. */
  revealed: boolean;
  /** The app switcher cover is up (the app is not in front). */
  covered: boolean;
  settings: GuardSettings;
  /** Face ID or Touch ID is set up on this phone (whether or not the person turned it on here). */
  biometricKind: BiometricKind | null;
  /** Ask "Unlock with Face ID?" once, right after the first PIN is set. */
  offerBiometrics: boolean;
  /** The setup screen can be closed (turning the lock on in an app where it is optional). */
  setupCancellable: boolean;
  tries: TryState;
  /** Too many wrong PINs: only signing in again (`reconfirm`) gets back in. */
  reconfirmNeeded: boolean;
  /** Face ID was turned off because the phone's faces or fingerprints changed. */
  notice: 'biometricsChanged' | null;
}

export type PinResult = 'ok' | 'wrong' | 'wait' | 'reconfirm' | 'error';
export type BiometricResult = 'ok' | 'cancel' | 'changed' | 'unavailable';

export interface ControllerDeps {
  config: GuardConfig;
  modules: GuardModules;
  /** Signs the person in again (Apple, Google or password). Resolves true when it was really them. */
  reconfirm?: () => Promise<boolean>;
  screenCapture?: ScreenCaptureLike;
  onError?: (where: string, error: unknown) => void;
  /** Wording for the Face ID prompt. */
  biometricPrompt: () => string;
  now?: () => number;
}
