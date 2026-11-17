import { getRandomBytes } from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

/** The Keychain calls the kit makes (expo-secure-store's shape). */
export interface KeyStore {
  getItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<string | null>;
  setItemAsync(key: string, value: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
  deleteItemAsync(key: string, options?: SecureStore.SecureStoreOptions): Promise<void>;
}

/** What the phone can do for Face ID / Touch ID (expo-local-authentication's shape). */
export interface BiometricInfo {
  hasHardwareAsync(): Promise<boolean>;
  isEnrolledAsync(): Promise<boolean>;
  supportedAuthenticationTypesAsync(): Promise<LocalAuthentication.AuthenticationType[]>;
}

/** expo-screen-capture's two calls, passed in by apps that block screenshots while amounts show. */
export interface ScreenCaptureLike {
  preventScreenCaptureAsync(key?: string): Promise<void>;
  allowScreenCaptureAsync(key?: string): Promise<void>;
}

export interface GuardModules {
  store: KeyStore;
  biometrics: BiometricInfo;
  randomBytes: (count: number) => Uint8Array;
  /** Normal items: readable only while the phone is unlocked, never copied to a backup or a new phone. */
  accessible: SecureStore.KeychainAccessibilityConstant;
  /** The Face ID item: as above, and deleted by iOS if the phone's passcode is removed. */
  biometricAccessible: SecureStore.KeychainAccessibilityConstant;
  /**
   * Optional: a native PBKDF2-HMAC-SHA-256 (32 bytes) for faster PIN checks, e.g. from react-native-quick-crypto.
   * It must give exactly the same bytes as the kit's own; saved PINs keep working either way. Left out, the kit uses
   * its plain-JavaScript one, worked in short slices so the app keeps responding.
   */
  pbkdf2?: (password: Uint8Array, salt: Uint8Array, rounds: number) => Promise<Uint8Array>;
}

export const expoModules = (): GuardModules => ({
  store: SecureStore,
  biometrics: LocalAuthentication,
  randomBytes: getRandomBytes,
  accessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  biometricAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
});

export const FACE = LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION;
export const FINGERPRINT = LocalAuthentication.AuthenticationType.FINGERPRINT;
