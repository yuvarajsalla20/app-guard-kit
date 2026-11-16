import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { DEFAULT_COMPONENTS, GuardContext, mergeTheme, useGuardState, type GuardLook } from './context';
import type { GuardKit } from './createGuardKit';
import type { GuardBrand, GuardComponents, GuardTheme } from './theme';
import { RevealSheet } from './reveal';
import { BiometricOffer, Cover, LockScreen, SetupScreen } from './ui/screens';

export interface GuardProviderProps {
  kit: GuardKit;
  /** From the auth kit: the signed-in person's id, `null` when signed out, `undefined` while sign-in is still loading. */
  userId: string | null | undefined;
  theme?: Partial<GuardTheme>;
  brand?: GuardBrand;
  components?: Partial<GuardComponents>;
  children?: ReactNode;
}

/**
 * Wrap the app (inside SafeAreaProvider). Draws the lock screen, the PIN setup and the app-switcher cover
 * over the app, starts every launch locked with amounts hidden, and watches touches for the idle timer.
 */
export function GuardProvider({ kit, userId, theme, brand, components, children }: GuardProviderProps) {
  const controller = kit.controller;
  const [revealOpen, setRevealOpen] = useState(false);
  const askReveal = useCallback(() => {
    if (controller.revealWithoutPin()) return;
    if (controller.getState().phase === 'open') setRevealOpen(true);
  }, [controller]);
  const look = useMemo<GuardLook>(
    () => ({
      kit,
      controller,
      strings: kit.strings,
      theme: mergeTheme(theme),
      brand: brand ?? {},
      components: { ...DEFAULT_COMPONENTS, ...components },
      askReveal,
    }),
    [kit, controller, theme, brand, components, askReveal],
  );

  useEffect(() => {
    void controller.setUser(userId);
  }, [controller, userId]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', controller.appState);
    return () => sub.remove();
  }, [controller]);

  useEffect(() => () => controller.hide(), [controller]);

  return (
    <GuardContext.Provider value={look}>
      <Layers onTouch={controller.touch} revealOpen={revealOpen} closeReveal={() => setRevealOpen(false)}>
        {children}
      </Layers>
    </GuardContext.Provider>
  );
}

function Layers({ children, onTouch, revealOpen, closeReveal }: { children?: ReactNode; onTouch: () => void; revealOpen: boolean; closeReveal: () => void }) {
  const state = useGuardState();
  const blocking = state.phase === 'starting' || state.phase === 'locked' || state.phase === 'setup';
  const hidden = blocking || state.covered;
  useEffect(() => {
    if (state.phase !== 'open' || state.covered) closeReveal();
  }, [state.phase, state.covered, closeReveal]);
  return (
    <View style={styles.fill}>
      {/* The app stays mounted under the lock (so its place is kept), but screen readers cannot reach it. */}
      <View
        style={styles.fill}
        onStartShouldSetResponderCapture={() => {
          onTouch();
          return false;
        }}
        accessibilityElementsHidden={hidden}
        importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      >
        {children}
      </View>
      {state.phase === 'locked' ? <LockScreen /> : null}
      {state.phase === 'setup' ? <SetupScreen /> : null}
      {state.phase === 'starting' || state.covered ? <Cover /> : null}
      <BiometricOffer />
      <RevealSheet visible={revealOpen && state.phase === 'open' && !state.covered} onClose={closeReveal} />
    </View>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
