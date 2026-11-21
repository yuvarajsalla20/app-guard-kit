import { pbkdf2Sha256 } from '../src/logic/sha256';
import { createGuardKit, type GuardKitOptions } from '../src/createGuardKit';
import type { GuardModules } from '../src/modules';

export interface Item {
  value: string;
  options?: Record<string, unknown>;
}

/** A fake Keychain and Face ID. `face` decides what the next Face ID prompt does. */
export function fakeModules() {
  const items = new Map<string, Item>();
  const calls: string[] = [];
  const bio = { hardware: true, enrolled: true, kind: 2, kinds: null as number[] | null, face: 'ok' as 'ok' | 'cancel' | 'changed', prompts: 0 };
  const modules: GuardModules = {
    accessible: 5,
    biometricAccessible: 6,
    randomBytes: (n) => new Uint8Array(n).map((_, i) => (i * 37 + 11) & 255),
    // A "native" PBKDF2 that answers at once, so the flows below need no timer ticks (the sliced JS one is tested in logic.test.ts).
    pbkdf2: async (password, salt, rounds) => pbkdf2Sha256(password, salt, rounds),
    biometrics: {
      hasHardwareAsync: async () => bio.hardware,
      isEnrolledAsync: async () => bio.enrolled,
      supportedAuthenticationTypesAsync: async () => bio.kinds ?? [bio.kind],
    },
    store: {
      getItemAsync: async (key, options) => {
        calls.push(`get ${key}`);
        const item = items.get(key);
        if (options?.requireAuthentication) {
          bio.prompts++;
          if (bio.face === 'cancel') throw new Error('User canceled the operation.');
          if (bio.face === 'changed') return null;
        }
        return item?.value ?? null;
      },
      setItemAsync: async (key, value, options) => {
        calls.push(`set ${key}`);
        items.set(key, { value, options: options as Record<string, unknown> });
      },
      deleteItemAsync: async (key) => {
        calls.push(`delete ${key}`);
        items.delete(key);
      },
    },
  };
  return { modules, items, calls, bio };
}

export function makeKit(options: GuardKitOptions = {}) {
  const fake = fakeModules();
  let time = 1_000_000;
  const clock = { now: () => time, advance: (ms: number) => void (time += ms), set: (t: number) => void (time = t) };
  const errors: string[] = [];
  const kit = createGuardKit({ modules: fake.modules, now: clock.now, onError: (w) => errors.push(w), ...options });
  return { kit, c: kit.controller, ...fake, clock, errors };
}
