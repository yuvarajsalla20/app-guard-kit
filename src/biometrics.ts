import type { BiometricKind } from './controllerTypes';
import type { GuardConfig } from './logic/options';
import { FACE, FINGERPRINT, type GuardModules } from './modules';

/** 2.1.0: which of Face ID or Touch ID this phone has set up, or null. A failure is reported and counts as none. */
export async function detectBiometrics(b: GuardModules['biometrics'], config: GuardConfig, report: (error: unknown) => void): Promise<BiometricKind | null> {
  if (!config.biometrics) return null;
  try {
    if (!(await b.hasHardwareAsync()) || !(await b.isEnrolledAsync())) return null;
    const types = await b.supportedAuthenticationTypesAsync();
    if (config.preferFingerprint && types.includes(FINGERPRINT)) return 'fingerprint';
    if (types.includes(FACE)) return 'face';
    if (types.includes(FINGERPRINT)) return 'fingerprint';
    return null;
  } catch (e) {
    report(e);
    return null;
  }
}
