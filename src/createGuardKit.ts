import { GuardController } from './controller';
import { normalizeConfig, type GuardConfig } from './logic/options';
import { expoModules, type GuardModules, type ScreenCaptureLike } from './modules';
import { DEFAULT_STRINGS, type GuardStrings } from './strings';

export interface GuardKitOptions extends Partial<GuardConfig> {
  /**
   * Forgot PIN and too many wrong tries: sign the person in again (Apple, Google or password) and resolve
   * true when it was really them, false when they cancelled. Without it, "Forgot PIN?" is not shown.
   */
  reconfirm?: () => Promise<boolean>;
  /** `import * as ScreenCapture from 'expo-screen-capture'`, only with `blockScreenshotsWhenRevealed`. */
  screenCapture?: ScreenCaptureLike;
  /** Quiet failures, for crash reporting (app-core-kit's `reportError`). Never given a PIN, a count or an amount. */
  onError?: (where: string, error: unknown) => void;
  /** Wording. Pass only what differs. */
  strings?: Partial<GuardStrings>;
  /** For tests: stand-ins for the Keychain, Face ID and random bytes. */
  modules?: Partial<GuardModules>;
  /** For tests: the clock. */
  now?: () => number;
}

export interface GuardKit {
  readonly config: GuardConfig;
  readonly strings: GuardStrings;
  /** The lock itself. Screens use the hooks instead; this is for wiring and tests. */
  readonly controller: GuardController;
  /** Delete account: wipe this person's PIN, Face ID and settings from the phone. Call it from the app's `eraseData`. */
  clear(): Promise<void>;
  /** Hide amounts now (before a share sheet or a screenshot of a report, say). */
  hide(): void;
}

/** One per app. Pass the kit to `GuardProvider`. */
export function createGuardKit(options: GuardKitOptions = {}): GuardKit {
  const { reconfirm, screenCapture, onError, strings: wording, modules, now, ...config } = options;
  const normalized = normalizeConfig(config);
  const strings: GuardStrings = { ...DEFAULT_STRINGS, ...wording };
  const controller: GuardController = new GuardController({
    config: normalized,
    modules: { ...expoModules(), ...modules },
    reconfirm,
    screenCapture,
    onError,
    now,
    biometricPrompt: (): string => strings.biometricPrompt(strings.biometricName(controller.getState().biometricKind ?? 'face')),
  });
  return {
    config: normalized,
    strings,
    controller,
    clear: () => controller.clear(),
    hide: () => controller.hide(),
  };
}
