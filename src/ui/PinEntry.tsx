import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';
import { useGuardLook } from '../context';

export interface PinEntryProps {
  title: string;
  subtitle?: string;
  length: number;
  /** Called when all digits are in. Resolve an error line to show (the digits clear), or null when done. */
  onSubmit: (pin: string) => Promise<string | null>;
  /**
   * The key left of 0: Cancel, Face ID… Empty when not given. With `icon`, the key shows the icon with `caption`
   * (one short line) under it, and `label` is only what a screen reader says.
   */
  leftKey?: { label: string; onPress: () => void; icon?: ReactNode; caption?: string };
  /** Shown instead of the keypad's error line, such as a wait countdown. Keys are disabled while set. */
  blocked?: string | null;
  /** Under the keypad (Forgot PIN?). */
  footer?: ReactNode;
  /** Above the title (a logo or lock tile). */
  header?: ReactNode;
  /** Changes when the entry should start over (a new step). */
  resetKey?: string | number;
}

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9] as const;

/** Dots, a message line and a round number pad. Nothing here stores or logs the digits. */
export function PinEntry({ title, subtitle, length, onSubmit, leftKey, blocked, footer, header, resetKey }: PinEntryProps) {
  const { theme, strings, components } = useGuardLook();
  const { Text } = components;
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);
  useEffect(() => {
    setDigits('');
    setError(null);
  }, [resetKey]);

  const disabled = busy || !!blocked;

  const press = (d: number) => {
    if (disabled || digits.length >= length) return;
    const next = digits + d;
    setDigits(next);
    setError(null);
    if (next.length === length) {
      setBusy(true);
      onSubmit(next)
        .catch(() => strings.couldNotCheck)
        .then((message) => {
          if (!alive.current) return;
          setBusy(false);
          setDigits('');
          setError(message);
          if (message) AccessibilityInfo.announceForAccessibility?.(message);
        });
    }
  };
  const erase = () => {
    if (!disabled) setDigits((p) => p.slice(0, -1));
  };

  const message = blocked ?? (busy ? strings.checking : error);
  const keyStyle = [styles.key, { backgroundColor: theme.key }];
  const digitText = [styles.digit, { color: theme.text }];

  return (
    <View style={styles.wrap}>
      {header}
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: theme.muted }]}>{subtitle}</Text> : null}
      <View style={styles.dots} accessible accessibilityLabel={strings.pinProgress(digits.length, length)}>
        {Array.from({ length }, (_, i) => (
          <View key={i} style={[styles.dot, { borderColor: theme.text }, i < digits.length && { backgroundColor: theme.text }]} />
        ))}
      </View>
      <Text accessibilityLiveRegion="polite" style={[styles.error, { color: blocked || error ? theme.danger : theme.muted }]}>
        {message ?? ' '}
      </Text>
      <View style={styles.pad}>
        {KEYS.map((d) => (
          <Pressable key={d} onPress={() => press(d)} disabled={disabled} accessibilityRole="button" accessibilityLabel={strings.digit(d)} style={({ pressed }) => [keyStyle, pressed && styles.pressed, disabled && styles.dim]}>
            <Text maxFontSizeMultiplier={1.4} style={digitText}>{d}</Text>
          </Pressable>
        ))}
        {leftKey ? (
          <Pressable onPress={leftKey.onPress} disabled={busy} accessibilityRole="button" accessibilityLabel={leftKey.label} style={styles.key}>
            {leftKey.icon ? (
              <>
                {leftKey.icon}
                {leftKey.caption ? (
                  <Text maxFontSizeMultiplier={1.2} numberOfLines={1} adjustsFontSizeToFit style={[styles.caption, { color: theme.muted }]}>{leftKey.caption}</Text>
                ) : null}
              </>
            ) : (
              <Text maxFontSizeMultiplier={1.4} numberOfLines={2} style={[styles.word, { color: theme.muted }]}>{leftKey.label}</Text>
            )}
          </Pressable>
        ) : (
          <View style={styles.key} />
        )}
        <Pressable onPress={() => press(0)} disabled={disabled} accessibilityRole="button" accessibilityLabel={strings.digit(0)} style={({ pressed }) => [keyStyle, pressed && styles.pressed, disabled && styles.dim]}>
          <Text maxFontSizeMultiplier={1.4} style={digitText}>0</Text>
        </Pressable>
        <Pressable onPress={erase} disabled={disabled || digits.length === 0} accessibilityRole="button" accessibilityLabel={strings.deleteKey} style={styles.key}>
          <Feather name="delete" size={24} color={theme.muted} />
        </Pressable>
      </View>
      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', paddingHorizontal: 24 },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 8 },
  subtitle: { fontSize: 14, textAlign: 'center', marginTop: 6, maxWidth: 300, lineHeight: 20 },
  dots: { flexDirection: 'row', gap: 16, marginTop: 24, marginBottom: 8 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5 },
  error: { minHeight: 20, fontSize: 13, textAlign: 'center', marginBottom: 12, maxWidth: 300 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 3 * 72 + 2 * 18, columnGap: 18, rowGap: 14 },
  key: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center' },
  digit: { fontSize: 26, fontWeight: '500' },
  word: { fontSize: 13, textAlign: 'center' },
  caption: { fontSize: 11, textAlign: 'center', marginTop: 4, maxWidth: 72 },
  pressed: { opacity: 0.6 },
  dim: { opacity: 0.45 },
});
