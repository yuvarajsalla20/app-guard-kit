import Feather from '@expo/vector-icons/Feather';
import type { ReactNode } from 'react';
import { Pressable, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { useGuardLook, useGuardState } from './context';
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
  const { revealed } = useGuardState();
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
  /** What to show while hidden. Default `•••••`. */
  mask?: string;
  numberOfLines?: number;
}

/** A money amount that shows as ••••• until the eye and PIN reveal it. Every amount in the app should go through this. */
export function Amount({ value, format, style, hiddenStyle, mask = MASK, numberOfLines }: AmountProps) {
  const look = useGuardLook();
  const state = useGuardState();
  const Text = look.components.Text;
  if (!state.revealed) {
    return (
      <Text style={[style, hiddenStyle]} numberOfLines={numberOfLines} accessibilityLabel={look.strings.hiddenAmount}>
        {mask}
      </Text>
    );
  }
  return (
    <Text style={style} numberOfLines={numberOfLines}>
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
  const { theme, strings } = useGuardLook();
  const { revealed, toggle } = useReveal();
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
