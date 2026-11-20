import { Text } from 'react-native';
import type React from 'react';
import { act, create, type ReactTestInstance, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GuardProvider } from '../src/GuardProvider';
import { Amount, RevealButton } from '../src/reveal';
import { makeKit } from './fakes';
import { setAppState } from './stubs/react-native';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let tree: ReactTestRenderer | null = null;
afterEach(() => {
  act(() => tree?.unmount());
  tree = null;
});

const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`;

function App() {
  return (
    <>
      <Amount value={245000} format={inr} />
      <RevealButton />
    </>
  );
}

async function render(t: ReturnType<typeof makeKit>, userId: string | null | undefined, brand?: { logo?: React.ReactNode; logoAtTop?: boolean; offerAsPage?: boolean }) {
  await act(async () => {
    tree = create(
      <GuardProvider kit={t.kit} userId={userId} brand={brand}>
        <App />
      </GuardProvider>,
    );
  });
  return tree!;
}

const texts = (root: ReactTestInstance) => root.findAll((n) => (n.type as unknown) === 'Text').map((n) => n.children.join(''));
const button = (root: ReactTestInstance, label: string) => root.find((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === label);

async function typePin(root: ReactTestInstance, pin: string) {
  for (const d of pin) {
    await act(async () => button(root, d).props.onPress());
  }
  await act(async () => {
    await new Promise((r) => setTimeout(r, 5));
  });
}

describe('GuardProvider', () => {
  it('shows only the cover while sign-in is loading, with the app hidden from screen readers', async () => {
    const t = makeKit();
    const r = await render(t, undefined);
    const shell = r.root.findAll((n) => (n.type as unknown) === 'View' && n.props.importantForAccessibility === 'no-hide-descendants');
    expect(shell.length).toBeGreaterThan(0);
    expect(texts(r.root)).not.toContain('Create a PIN');
  });

  it('first PIN: typed twice, a mismatch starts again', async () => {
    const t = makeKit();
    const r = await render(t, 'u1');
    expect(texts(r.root)).toContain('Create a PIN');
    await typePin(r.root, '2580');
    expect(texts(r.root)).toContain('Enter it again');
    await typePin(r.root, '2581');
    expect(texts(r.root)).toContain('Those PINs did not match. Start again.');
    await typePin(r.root, '2580');
    await typePin(r.root, '2580');
    expect(t.c.getState().phase).toBe('open');
    expect(texts(r.root)).toContain('Unlock with Face ID?');
  });

  it('with brand.offerAsPage, the Face ID offer is a page with a switch (on) and Continue, no pop-up', async () => {
    const t = makeKit();
    const r = await render(t, 'u1', { offerAsPage: true });
    await typePin(r.root, '2580');
    await typePin(r.root, '2580');
    expect(r.root.findAll((n) => (n.type as unknown) === 'Modal')).toHaveLength(0);
    expect(texts(r.root)).toContain('Face ID is on. You can change this in Settings > Security.');
    const sw = r.root.find((n) => (n.type as unknown) === 'Switch');
    expect(sw.props.value).toBe(true);
    await act(async () => sw.props.onValueChange(false));
    expect(texts(r.root)).toContain('Face ID is off. You can turn it on in Settings > Security.');
    await act(async () => button(r.root, 'Continue').props.onPress());
    expect(t.c.getState().offerBiometrics).toBe(false);
    expect(t.c.getState().settings.biometrics).toBe(false);
  });

  it('rejects an obvious PIN on the setup screen', async () => {
    const t = makeKit();
    const r = await render(t, 'u1');
    await typePin(r.root, '1234');
    expect(texts(r.root)).toContain('That PIN is too easy to guess. Pick another.');
    expect(texts(r.root)).toContain('Create a PIN');
  });

  it('amounts are masked, the eye asks for the PIN, then they show', async () => {
    const t = makeKit();
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    t.c.dismissOffer();
    const r = await render(t, 'u1');
    expect(texts(r.root)).toContain('•••••');
    expect(texts(r.root).join(' ')).not.toContain('245');
    const masked = r.root.find((n) => (n.type as unknown) === 'Text' && n.props.accessibilityLabel === 'Amount hidden');
    expect(masked).toBeTruthy();
    await act(async () => button(r.root, 'Show amounts').props.onPress());
    expect(texts(r.root)).toContain('Enter PIN to show amounts');
    await typePin(r.root, '9999');
    expect(texts(r.root)).toContain('Wrong PIN. 4 tries left.');
    await typePin(r.root, '2580');
    expect(texts(r.root)).toContain('₹2,45,000');
    await act(async () => button(r.root, 'Hide amounts').props.onPress());
    expect(texts(r.root)).toContain('•••••');
  });

  it('hideAmountsWithoutLock false (1.5.0): amounts show and no eye while the lock is off, and hide once it is on', async () => {
    const t = makeKit({ requirePin: false, hideAmountsWithoutLock: false });
    await t.c.setUser('u1');
    const r = await render(t, 'u1');
    expect(t.c.getState().phase).toBe('off');
    expect(texts(r.root)).toContain('₹2,45,000');
    expect(r.root.findAll((n) => (n.type as unknown) === 'Pressable' && n.props.accessibilityLabel === 'Show amounts')).toHaveLength(0);
    await act(async () => {
      await t.c.setPin('2580');
    });
    await act(async () => t.c.dismissOffer());
    expect(t.c.getState().phase).not.toBe('off');
    expect(texts(r.root)).toContain('•••••');
    expect(texts(r.root).join(' ')).not.toContain('245');
    expect(button(r.root, 'Show amounts')).toBeTruthy();
  });

  it('by default amounts start hidden even with the lock off', async () => {
    const t = makeKit({ requirePin: false });
    await t.c.setUser('u1');
    const r = await render(t, 'u1');
    expect(t.c.getState().phase).toBe('off');
    expect(texts(r.root)).toContain('•••••');
    expect(button(r.root, 'Show amounts')).toBeTruthy();
  });

  it('Amount (1.5.0): an element mask, and the label a screen reader hears while shown', async () => {
    const t = makeKit({ requirePin: false, hideAmountsWithoutLock: false });
    await t.c.setUser('u1');
    await act(async () => {
      tree = create(
        <GuardProvider kit={t.kit} userId="u1">
          <Amount value={10} format={inr} label="₹2,45,000" mask={<Text>₹ ··</Text>} />
        </GuardProvider>,
      );
    });
    const shown = tree!.root.find((n) => (n.type as unknown) === 'Text' && n.props.accessibilityLabel === '₹2,45,000');
    expect(shown.children.join('')).toBe('₹10');
    await act(async () => {
      await t.c.setPin('2580');
    });
    await act(async () => t.c.dismissOffer());
    expect(texts(tree!.root)).toContain('₹ ··');
  });

  it('logoAtTop: the logo is pinned at the top on the lock screen and the show-amounts sheet', async () => {
    const t = makeKit();
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    t.c.dismissOffer();
    t.bio.enrolled = false;
    const logo = <Text testID="app-logo">PAL</Text>;
    const r = await render(t, 'u1', { logo, logoAtTop: true });
    const logos = () => r.root.findAll((n) => n.props.testID === 'app-logo' && (n.type as unknown) === 'Text');
    // Show-amounts sheet: the logo replaces the lock tile, once.
    await act(async () => button(r.root, 'Show amounts').props.onPress());
    expect(texts(r.root)).toContain('Enter PIN to show amounts');
    expect(logos()).toHaveLength(1);
    await act(async () => button(r.root, 'Cancel').props.onPress());
    // Lock screen: the logo once, at the top, not repeated above the title.
    await act(async () => setAppState('background'));
    await act(async () => setAppState('active'));
    expect(texts(r.root)).toContain('Locked');
    expect(logos()).toHaveLength(1);
  });

  it('without logoAtTop the show-amounts sheet keeps its lock tile (1.0 look)', async () => {
    const t = makeKit();
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    t.c.dismissOffer();
    const logo = <Text testID="app-logo">PAL</Text>;
    const r = await render(t, 'u1', { logo });
    await act(async () => button(r.root, 'Show amounts').props.onPress());
    expect(r.root.findAll((n) => n.props.testID === 'app-logo' && (n.type as unknown) === 'Text')).toHaveLength(0);
  });

  it('locks when the app goes to the background and opens with the PIN', async () => {
    const t = makeKit();
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    t.c.dismissOffer();
    t.bio.enrolled = false;
    const r = await render(t, 'u1');
    await act(async () => setAppState('background'));
    await act(async () => setAppState('active'));
    expect(texts(r.root)).toContain('Locked');
    await typePin(r.root, '2580');
    expect(t.c.getState().phase).toBe('open');
    expect(texts(r.root)).not.toContain('Locked');
  });

  it('asks for Face ID straight away on the lock screen', async () => {
    const t = makeKit();
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    await t.c.enableBiometrics();
    t.c.appState('background');
    t.c.appState('active');
    const before = t.bio.prompts;
    const r = await render(t, 'u1');
    expect(t.bio.prompts).toBe(before + 1);
    expect(t.c.getState().phase).toBe('open');
    expect(texts(r.root)).not.toContain('Locked');
  });

  it('too many tries shows Sign in again', async () => {
    const reconfirm = vi.fn(async () => true);
    const t = makeKit({ reconfirm, limits: { free: 1, waits: [], reconfirmAfter: 1 } });
    await t.c.setUser('u1');
    await t.c.setPin('2580');
    t.c.dismissOffer();
    t.c.appState('background');
    t.bio.enrolled = false;
    const r = await render(t, 'u1');
    await typePin(r.root, '1111');
    expect(texts(r.root)).toContain('Too many tries');
    await act(async () => r.root.find((n) => (n.type as unknown) === 'Pressable' && texts(n).includes('Sign in again')).props.onPress());
    expect(reconfirm).toHaveBeenCalledOnce();
    expect(texts(r.root)).toContain('Create a PIN');
  });
});
