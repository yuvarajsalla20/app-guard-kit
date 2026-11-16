import type { ComponentProps, ComponentType, ReactNode } from 'react';
import type { Text as RNText } from 'react-native';

/** Colors of the lock screen, PIN pad and cover. Pass only what differs from the defaults. */
export interface GuardTheme {
  /** The screen behind everything (and the app-switcher cover). */
  bg: string;
  /** The round PIN keys and the lock tile. */
  key: string;
  text: string;
  muted: string;
  accent: string;
  /** The words on an accent button. */
  onAccent: string;
  danger: string;
  border: string;
}

/** A warm, quiet light theme. Apps pass their own. */
export const DEFAULT_THEME: GuardTheme = {
  bg: '#FBF8F3',
  key: '#F3EDE4',
  text: '#2B2219',
  muted: '#7B6E61',
  accent: '#A87A2E',
  onAccent: '#FFFFFF',
  danger: '#B4473C',
  border: '#ECE4D8',
};

export interface GuardBrand {
  /** Drawn on the lock screen and the app-switcher cover. */
  logo?: ReactNode;
  /** Drawn behind the lock screen (a gradient). */
  backdrop?: ReactNode;
}

/** The app's own text component, so the screens use its fonts. */
export interface GuardComponents {
  Text: ComponentType<ComponentProps<typeof RNText>>;
}
