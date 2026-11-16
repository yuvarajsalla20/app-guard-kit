// Stand-ins for expo-secure-store, expo-local-authentication and expo-crypto.
import { randomBytes } from 'node:crypto';

export const WHEN_UNLOCKED_THIS_DEVICE_ONLY = 5;
export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 6;
export const getRandomBytes = (n: number) => new Uint8Array(randomBytes(n));
export enum AuthenticationType { FINGERPRINT = 1, FACIAL_RECOGNITION = 2, IRIS = 3 }
const fail = async (): Promise<never> => {
  throw new Error('use the test modules');
};
export const getItemAsync = fail;
export const setItemAsync = fail;
export const deleteItemAsync = fail;
export const hasHardwareAsync = fail;
export const isEnrolledAsync = fail;
export const supportedAuthenticationTypesAsync = fail;
export type SecureStoreOptions = Record<string, unknown>;
export type KeychainAccessibilityConstant = number;
