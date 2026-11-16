import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { Text as RNText } from 'react-native';
import type { GuardController, GuardState } from './controller';
import type { GuardKit } from './createGuardKit';
import type { GuardStrings } from './strings';
import { DEFAULT_THEME, type GuardBrand, type GuardComponents, type GuardTheme } from './theme';

export interface GuardLook {
  kit: GuardKit;
  controller: GuardController;
  strings: GuardStrings;
  theme: GuardTheme;
  brand: GuardBrand;
  components: GuardComponents;
  /** Opens the PIN sheet that shows amounts (or shows them at once when the lock is off). */
  askReveal: () => void;
}

export const GuardContext = createContext<GuardLook | null>(null);

export const DEFAULT_COMPONENTS: GuardComponents = { Text: RNText };

export function useGuardLook(): GuardLook {
  const look = useContext(GuardContext);
  if (!look) throw new Error('app-guard-kit: wrap the app in <GuardProvider>.');
  return look;
}

/** The lock's current state; re-renders when it changes. */
export function useGuardState(): GuardState {
  const { controller } = useGuardLook();
  return useSyncExternalStore(controller.subscribe, controller.getState, controller.getState);
}

/** Re-renders once a second while `active`, for countdowns. */
export function useTick(active: boolean): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  return tick;
}

export const mergeTheme = (theme?: Partial<GuardTheme>): GuardTheme => ({ ...DEFAULT_THEME, ...theme });
