import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardLook, useGuardState, useTick } from '../context';
import type { GuardController, PinResult } from '../controller';
import type { PinProblem } from '../logic/pin';
import { formatSeconds, type GuardStrings } from '../strings';

/** The words for a PIN check that did not open anything. */
export function pinMessage(result: PinResult | PinProblem, controller: GuardController, strings: GuardStrings): string | null {
  switch (result) {
    case 'ok':
      return null;
    case 'wrong': {
      const wait = controller.waitSeconds();
      return wait > 0 ? strings.waitFor(formatSeconds(wait)) : strings.wrongPin(controller.triesLeft());
    }
    case 'wait':
      return strings.waitFor(formatSeconds(controller.waitSeconds()));
    case 'reconfirm':
      return strings.pinGone;
    case 'obvious':
      return strings.obvious;
    case 'length':
    case 'digits':
    case 'error':
    default:
      return strings.couldNotCheck;
  }
}

/** The wait line while a wrong-PIN wait is running, updated every second. */
export function useWaitLine(): string | null {
  const { controller, strings } = useGuardLook();
  const state = useGuardState();
  const waiting = state.tries.waitUntil > 0;
  useTick(waiting);
  const left = waiting ? controller.waitSeconds() : 0;
  return left > 0 ? strings.waitFor(formatSeconds(left)) : null;
}

export const LockTile = () => {
  const { theme } = useGuardLook();
  return (
    <View style={[styles.tile, { backgroundColor: theme.key }]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Feather name="lock" size={22} color={theme.accent} />
    </View>
  );
};

/** True when the app asked for its logo pinned at the top of the guard screens (`brand.logoAtTop`). */
const logoOnTop = (brand: { logo?: ReactNode; logoAtTop?: boolean }) => !!brand.logoAtTop && brand.logo != null;

/**
 * A full screen of the theme's background with the safe area and an optional backdrop.
 * With `brand.logoAtTop`, the logo is drawn at the top, centred, and the content is centred in the space below
 * (`top={false}` leaves it out, for the cover, which shows the logo in the middle itself). With
 * `brand.contentUnderLogo` too, the content starts just under the logo instead.
 */
export function GuardSurface({ children, center = true, top = true }: { children?: ReactNode; center?: boolean; top?: boolean }) {
  const { theme, brand } = useGuardLook();
  const insets = useSafeAreaInsets();
  const pinned = top && logoOnTop(brand);
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>
      {brand.backdrop ? <View style={StyleSheet.absoluteFill} pointerEvents="none">{brand.backdrop}</View> : null}
      <View style={[styles.fill, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>
        {pinned ? <View style={styles.top}>{brand.logo}</View> : null}
        <View style={[styles.fill, styles.inner, center && styles.center, pinned && brand.contentUnderLogo && styles.underLogo]}>{children}</View>
      </View>
    </View>
  );
}

/** What goes above a PIN pad's title: nothing when the logo is pinned at the top, else the logo (or `fallback`). */
export function useHeader(fallback: 'logo' | 'tile'): ReactNode {
  const { brand } = useGuardLook();
  if (logoOnTop(brand)) return null;
  return fallback === 'logo' ? (brand.logo ?? <LockTile />) : <LockTile />;
}

/** Shown in the app switcher and while the kit is starting, so no amount or screen is ever visible there. */
export function Cover() {
  const { brand } = useGuardLook();
  return <GuardSurface top={false}>{brand.logo ?? <LockTile />}</GuardSurface>;
}

export function TextButton({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  const { theme, components } = useGuardLook();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={[styles.textButton, strong && { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 24 }]}>
      <components.Text style={[styles.textButtonLabel, { color: strong ? theme.onAccent : theme.accent }]}>{label}</components.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingHorizontal: 16 },
  center: { alignItems: 'center', justifyContent: 'center' },
  // brand.contentUnderLogo: start just under the pinned logo instead of centring in the space left.
  underLogo: { justifyContent: 'flex-start', paddingTop: 16 },
  inner: { paddingHorizontal: 0 },
  top: { alignItems: 'center', paddingTop: 8 },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  textButton: { paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  textButtonLabel: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
});
