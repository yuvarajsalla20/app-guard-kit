import { createElement, forwardRef } from 'react';

// A tiny stand-in for react-native so the real screens can be rendered in tests: every component is a plain named element.
const host = (name: string) => forwardRef<unknown, Record<string, unknown>>((props, ref) => createElement(name, { ...props, ref }, props.children as never));

export const View = host('View');
export const Text = host('Text');
export const Pressable = host('Pressable');
export const Switch = host('Switch');
export const Modal = (props: { visible?: boolean; children?: unknown }) => (props.visible ? createElement('Modal', props as never, props.children as never) : null);
export const StyleSheet = { create: <T,>(styles: T): T => styles, absoluteFill: { position: 'absolute' }, hairlineWidth: 1 };
export const announced: string[] = [];
export const AccessibilityInfo = { announceForAccessibility: (text: string) => void announced.push(text) };
type Listener = (state: string) => void;
export const appStateListeners = new Set<Listener>();
export const AppState = {
  addEventListener: (_: string, l: Listener) => {
    appStateListeners.add(l);
    return { remove: () => appStateListeners.delete(l) };
  },
};
export const setAppState = (s: string) => appStateListeners.forEach((l) => l(s));
