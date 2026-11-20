import Feather from '@expo/vector-icons/Feather';
import { useCallback, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useAmountsHidden, useGuardLook, useGuardRevealed, useGuardState } from './context';
import { formatSeconds } from './strings';
import { PinSheet, pinMessage } from './ui/screens';

/** The same mask for every amount, so its length gives nothing away. */
export const MASK = '•••••';

export interface Reveal {
  /** Amounts are showing. */
  revealed: boolean;
  /** Asks for the PIN, then shows every amount on every screen. */
  reveal: () => void;
  hide: () => void;
  /** The eye: hides when shown, asks for the PIN when hidden. */
  toggle: () => void;
}

/** Whether amounts show, and the calls to show or hide them. */
export function useReveal(): Reveal {
  const look = useGuardLook();
  const revealed = useGuardRevealed();
  const reveal = look.askReveal;
  const hide = look.controller.hide;
  return { revealed, reveal, hide, toggle: revealed ? hide : reveal };
}

export interface AmountProps {
  value: number;
  /** Turns the number into text, such as `formatInr`. */
  format: (value: number) => string;
  style?: StyleProp<TextStyle>;
  /** Style added while hidden (a lighter color, say). */
  hiddenStyle?: StyleProp<TextStyle>;
  /** What to show while hidden. Default `•••••`. 1.5.0: may be an element, such as the currency sign and smaller dots. */
  mask?: ReactNode;
  numberOfLines?: number;
  /** 1.5.0: shrink the text to fit on its line. */
  adjustsFontSizeToFit?: boolean;
  /** 1.5.0: what a screen reader hears while shown. Default the shown text. Useful when `value` is animating: pass the final amount. */
  label?: string;
}

/** A money amount that shows as ••••• until the eye and PIN reveal it. Every amount in the app should go through this. */
export function Amount({ value, format, style, hiddenStyle, mask = MASK, numberOfLines, adjustsFontSizeToFit, label }: AmountProps) {
  const look = useGuardLook();
  const hidden = useAmountsHidden();
  const Text = look.components.Text;
  if (hidden) {
    return (
      <Text style={[style, hiddenStyle]} numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit} accessibilityLabel={look.strings.hiddenAmount}>
        {mask}
      </Text>
    );
  }
  return (
    <Text style={style} numberOfLines={numberOfLines} adjustsFontSizeToFit={adjustsFontSizeToFit} accessibilityLabel={label}>
      {format(value)}
    </Text>
  );
}

export interface RevealButtonProps {
  /** Icon size. Default 18. */
  size?: number;
  color?: string;
  style?: StyleProp<ViewStyle>;
  /** Draw your own eye: given whether amounts show. */
  children?: (revealed: boolean) => ReactNode;
}

/** The 👁 button: asks for the PIN and shows all amounts, or hides them straight away. */
export function RevealButton({ size = 18, color, style, children }: RevealButtonProps) {
  const { theme, strings, kit } = useGuardLook();
  const { revealed, toggle } = useReveal();
  const lockOff = useLockOff();
  // 1.5.0: with hideAmountsWithoutLock false there is nothing to show or hide while the lock is off.
  if (lockOff && !kit.config.hideAmountsWithoutLock) return null;
  return (
    <Pressable
      onPress={toggle}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={revealed ? strings.hideAmounts : strings.showAmounts}
      style={({ pressed }) => [{ width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.key }, style, pressed && { opacity: 0.6 }]}
    >
      {children ? children(revealed) : <Feather name={revealed ? 'eye-off' : 'eye'} size={size} color={color ?? theme.text} />}
    </Pressable>
  );
}

/** Whether the lock is off; re-renders only when that flips. */
function useLockOff(): boolean {
  const { controller } = useGuardLook();
  const off = useCallback(() => controller.getState().phase === 'off', [controller]);
  return useSyncExternalStore(controller.subscribe, off, off);
}

/** The PIN sheet the eye opens. `GuardProvider` draws it. */
export function RevealSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { controller, strings, theme, components } = useGuardLook();
  const state = useGuardState();
  const bio = state.biometricKind ? strings.biometricName(state.biometricKind) : '';
  const withBio = controller.canRevealWithBiometrics();
  return (
    <PinSheet
      visible={visible}
      title={strings.revealTitle}
      subtitle={strings.revealSubtitle(formatSeconds(state.settings.idleHideSeconds))}
      onClose={onClose}
      onSubmit={async (pin) => {
        const result = await controller.revealWithPin(pin);
        if (result === 'ok') onClose();
        return pinMessage(result, controller, strings);
      }}
      extraKey={
        withBio ? (
          <Pressable
            accessibilityRole="button"
            onPress={async () => {
              if ((await controller.revealWithBiometrics()) === 'ok') onClose();
            }}
            style={{ padding: 12 }}
          >
            <components.Text style={{ color: theme.accent, fontSize: 15, fontWeight: '600' }}>{strings.useBiometrics(bio)}</components.Text>
          </Pressable>
        ) : null
      }
    />
  );
}
