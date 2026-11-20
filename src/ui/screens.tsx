import Feather from '@expo/vector-icons/Feather';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGuardLook, useGuardState, useTick } from '../context';
import type { GuardController, PinResult } from '../controller';
import type { PinProblem } from '../logic/pin';
import { formatSeconds, type GuardStrings } from '../strings';
import { PinEntry } from './PinEntry';

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

const LockTile = () => {
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
function useHeader(fallback: 'logo' | 'tile'): ReactNode {
  const { brand } = useGuardLook();
  if (logoOnTop(brand)) return null;
  return fallback === 'logo' ? (brand.logo ?? <LockTile />) : <LockTile />;
}

/** Shown in the app switcher and while the kit is starting, so no amount or screen is ever visible there. */
export function Cover() {
  const { brand } = useGuardLook();
  return <GuardSurface top={false}>{brand.logo ?? <LockTile />}</GuardSurface>;
}

function TextButton({ label, onPress, strong }: { label: string; onPress: () => void; strong?: boolean }) {
  const { theme, components } = useGuardLook();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" hitSlop={8} style={[styles.textButton, strong && { backgroundColor: theme.accent, borderRadius: 999, paddingHorizontal: 24 }]}>
      <components.Text style={[styles.textButtonLabel, { color: strong ? theme.onAccent : theme.accent }]}>{label}</components.Text>
    </Pressable>
  );
}

/** The lock screen: Face ID straight away when it is on, the PIN pad always. */
export function LockScreen() {
  const { controller, strings, kit, theme, components } = useGuardLook();
  const state = useGuardState();
  const waitLine = useWaitLine();
  const bio = state.biometricKind ? strings.biometricName(state.biometricKind) : '';
  const asked = useRef(false);
  const canBio = controller.canUseBiometrics();
  const header = useHeader('logo');

  // Ask for Face ID once each time the lock screen comes up in front.
  useEffect(() => {
    if (state.covered) {
      asked.current = false;
      return;
    }
    if (!asked.current && canBio) {
      asked.current = true;
      void controller.unlockWithBiometrics();
    }
  }, [state.covered, canBio, controller]);

  const forgot = controller.canReconfirm() ? <TextButton label={strings.forgotPin} onPress={() => void controller.forgotPin()} /> : null;

  if (state.reconfirmNeeded) {
    return (
      <GuardSurface>
        {header}
        <components.Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{strings.tooManyTitle}</components.Text>
        <components.Text style={[styles.body, { color: theme.muted }]}>{strings.tooManyBody}</components.Text>
        {controller.canReconfirm() ? <TextButton strong label={strings.signInAgain} onPress={() => void controller.forgotPin()} /> : null}
      </GuardSurface>
    );
  }

  return (
    <GuardSurface>
      <PinEntry
        header={header}
        title={strings.lockTitle}
        subtitle={strings.lockSubtitle}
        length={kit.config.pinLength}
        blocked={waitLine}
        onSubmit={async (pin) => pinMessage(await controller.unlockWithPin(pin), controller, strings)}
        leftKey={
          canBio
            ? {
                label: strings.useBiometrics(bio),
                onPress: () => void controller.unlockWithBiometrics(),
                icon: <MaterialCommunityIcons name={state.biometricKind === 'fingerprint' ? 'fingerprint' : 'face-recognition'} size={28} color={theme.muted} />,
                caption: bio,
              }
            : undefined
        }
        footer={
          <View style={styles.footer}>
            {state.notice === 'biometricsChanged' ? <components.Text style={[styles.note, { color: theme.muted }]}>{strings.biometricsChanged(strings.biometricName(state.biometricKind ?? 'face'))}</components.Text> : null}
            {forgot}
          </View>
        }
      />
    </GuardSurface>
  );
}

/** Create a PIN: typed twice. After Forgot PIN too. */
export function SetupScreen() {
  const { controller, strings, kit } = useGuardLook();
  const state = useGuardState();
  const header = useHeader('logo');
  const [first, setFirst] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const length = kit.config.pinLength;
  const cancel = state.setupCancellable ? { label: strings.cancel, onPress: () => controller.cancelSetup() } : undefined;
  return (
    <GuardSurface>
      {first === null ? (
        <PinEntry
          key="first"
          header={header}
          title={strings.setupTitle}
          subtitle={notice ?? strings.setupSubtitle(length)}
          length={length}
          leftKey={cancel}
          onSubmit={async (pin) => {
            const problem = controller.problemWith(pin);
            if (problem) return pinMessage(problem, controller, strings);
            setNotice(null);
            setFirst(pin);
            return null;
          }}
        />
      ) : (
        <PinEntry
          key="second"
          header={header}
          title={strings.confirmTitle}
          subtitle={strings.confirmSubtitle}
          length={length}
          leftKey={{ label: strings.back, onPress: () => setFirst(null) }}
          onSubmit={async (pin) => {
            if (pin !== first) {
              setFirst(null);
              setNotice(strings.mismatch);
              return null;
            }
            const result = await controller.setPin(pin);
            if (result === null) return null;
            setFirst(null);
            setNotice(result === 'error' ? strings.couldNotSave : pinMessage(result, controller, strings));
            return null;
          }}
        />
      )}
    </GuardSurface>
  );
}

/** "Unlock with Face ID?" once, right after the first PIN: a pop-up card, or a full screen with `brand.offerAsPage`. */
export function BiometricOffer() {
  const { controller, strings, theme, components, brand } = useGuardLook();
  const state = useGuardState();
  const [busy, setBusy] = useState(false);
  if (!state.offerBiometrics || !state.biometricKind || state.covered) return null;
  if (brand.offerAsPage) return <BiometricOfferPage />;
  const bio = strings.biometricName(state.biometricKind);
  const { Text } = components;
  return (
    <Modal transparent animationType="fade" visible onRequestClose={controller.dismissOffer}>
      <View style={styles.scrim}>
        <View style={[styles.card, { backgroundColor: theme.bg, borderColor: theme.border }]} accessibilityViewIsModal>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{strings.offerTitle(bio)}</Text>
          <Text style={[styles.body, { color: theme.muted }]}>{strings.offerBody(bio)}</Text>
          <Pressable
            disabled={busy}
            accessibilityRole="button"
            onPress={async () => {
              setBusy(true);
              await controller.enableBiometrics();
              setBusy(false);
            }}
            style={[styles.primary, { backgroundColor: theme.accent }, busy && { opacity: 0.6 }]}
          >
            <Text style={[styles.primaryLabel, { color: theme.onAccent }]}>{strings.offerYes(bio)}</Text>
          </Pressable>
          <TextButton label={strings.offerNo} onPress={controller.dismissOffer} />
        </View>
      </View>
    </Modal>
  );
}

/** The offer as a guard screen of its own (no pop-up): a switch, on by default, and Continue. */
function BiometricOfferPage() {
  const { controller, strings, theme, components } = useGuardLook();
  const state = useGuardState();
  const [on, setOn] = useState(true);
  const [busy, setBusy] = useState(false);
  const header = useHeader('tile');
  const bio = strings.biometricName(state.biometricKind ?? 'face');
  const { Text } = components;
  const go = async () => {
    if (!on) return controller.dismissOffer();
    setBusy(true);
    await controller.enableBiometrics();
    setBusy(false);
  };
  return (
    <GuardSurface>
      {header}
      <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{strings.offerTitle(bio)}</Text>
      <Text style={[styles.body, { color: theme.muted }]}>{strings.offerBody(bio)}</Text>
      <View style={[styles.switchRow, { backgroundColor: theme.key, borderColor: theme.border }]}>
        <Text style={[styles.switchLabel, { color: theme.text }]}>{strings.offerSwitch(bio)}</Text>
        <Switch value={on} onValueChange={setOn} trackColor={{ true: theme.accent }} accessibilityLabel={strings.offerSwitch(bio)} />
      </View>
      <Text style={[styles.note, { color: theme.muted, marginTop: 10 }]}>{on ? strings.offerOnNote(bio) : strings.offerOffNote(bio)}</Text>
      <Pressable disabled={busy} accessibilityRole="button" accessibilityLabel={strings.offerContinue} onPress={() => void go()} style={[styles.primary, styles.pageButton, { backgroundColor: theme.accent }, busy && { opacity: 0.6 }]}>
        <Text style={[styles.primaryLabel, { color: theme.onAccent }]}>{strings.offerContinue}</Text>
      </Pressable>
    </GuardSurface>
  );
}

/** A PIN pad in a sheet over the app: to show amounts or to turn the lock off. */
export function PinSheet({ visible, title, subtitle, onSubmit, onClose, extraKey }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onSubmit: (pin: string) => Promise<string | null>;
  onClose: () => void;
  extraKey?: ReactNode;
}) {
  const { kit, strings } = useGuardLook();
  const waitLine = useWaitLine();
  const header = useHeader('tile');
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GuardSurface>
        <PinEntry
          header={header}
          title={title}
          subtitle={subtitle}
          length={kit.config.pinLength}
          blocked={waitLine}
          onSubmit={onSubmit}
          leftKey={{ label: strings.cancel, onPress: onClose }}
          footer={extraKey}
        />
      </GuardSurface>
    </Modal>
  );
}

/** Change PIN: current, new, new again. */
export function ChangePinSheet({ visible, onClose, onDone }: { visible: boolean; onClose: () => void; onDone?: () => void }) {
  const { controller, strings, kit } = useGuardLook();
  const waitLine = useWaitLine();
  const header = useHeader('tile');
  const [step, setStep] = useState<'current' | 'new' | 'again'>('current');
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (visible) {
      setStep('current');
      setCurrent('');
      setNext('');
      setNotice(null);
    }
  }, [visible]);
  const title = step === 'current' ? strings.currentPin : step === 'new' ? strings.newPin : strings.confirmNewPin;
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GuardSurface>
        <PinEntry
          resetKey={step}
          header={header}
          title={strings.changeTitle}
          subtitle={notice ?? title}
          length={kit.config.pinLength}
          blocked={step === 'current' ? waitLine : null}
          leftKey={{ label: strings.cancel, onPress: onClose }}
          onSubmit={async (pin) => {
            if (step === 'current') {
              // Checked again when saving; this early check gives the right message at once and counts wrong tries.
              const result = await controller.confirmPin(pin);
              if (result !== 'ok') return pinMessage(result, controller, strings);
              setCurrent(pin);
              setNotice(null);
              setStep('new');
              return null;
            }
            if (step === 'new') {
              const problem = controller.problemWith(pin);
              if (problem) return pinMessage(problem, controller, strings);
              setNext(pin);
              setStep('again');
              return null;
            }
            if (pin !== next) {
              setNotice(strings.mismatch);
              setStep('new');
              return null;
            }
            const result = await controller.changePin(current, pin);
            if (result !== 'ok') return pinMessage(result, controller, strings);
            onDone?.();
            onClose();
            return null;
          }}
        />
      </GuardSurface>
    </Modal>
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
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  note: { fontSize: 13, textAlign: 'center', maxWidth: 300, marginBottom: 4 },
  footer: { alignItems: 'center', marginTop: 16, gap: 8 },
  textButton: { paddingVertical: 10, paddingHorizontal: 12, marginTop: 8 },
  textButtonLabel: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: 16 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center', marginBottom: 16 },
  primary: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryLabel: { fontSize: 16, fontWeight: '600' },
  switchRow: { alignSelf: 'center', width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12, marginTop: 24 },
  switchLabel: { fontSize: 16, fontWeight: '500' },
  // A compact pill in the middle of the page, not a full-width bar.
  pageButton: { alignSelf: 'center', minWidth: 180, paddingHorizontal: 40, borderRadius: 999 },
});
