import Feather from '@expo/vector-icons/Feather';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
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

/** A full screen of the theme's background with the safe area and an optional backdrop. */
export function GuardSurface({ children, center = true }: { children?: ReactNode; center?: boolean }) {
  const { theme, brand } = useGuardLook();
  const insets = useSafeAreaInsets();
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.bg }]}>
      {brand.backdrop ? <View style={StyleSheet.absoluteFill} pointerEvents="none">{brand.backdrop}</View> : null}
      <View style={[styles.fill, center && styles.center, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 12 }]}>{children}</View>
    </View>
  );
}

/** Shown in the app switcher and while the kit is starting, so no amount or screen is ever visible there. */
export function Cover() {
  const { brand } = useGuardLook();
  return <GuardSurface>{brand.logo ?? <LockTile />}</GuardSurface>;
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
  const { controller, strings, brand, kit, theme, components } = useGuardLook();
  const state = useGuardState();
  const waitLine = useWaitLine();
  const bio = state.biometricKind ? strings.biometricName(state.biometricKind) : '';
  const asked = useRef(false);
  const canBio = controller.canUseBiometrics();

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
        {brand.logo ?? <LockTile />}
        <components.Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>{strings.tooManyTitle}</components.Text>
        <components.Text style={[styles.body, { color: theme.muted }]}>{strings.tooManyBody}</components.Text>
        {controller.canReconfirm() ? <TextButton strong label={strings.signInAgain} onPress={() => void controller.forgotPin()} /> : null}
      </GuardSurface>
    );
  }

  return (
    <GuardSurface>
      <PinEntry
        header={brand.logo ?? <LockTile />}
        title={strings.lockTitle}
        subtitle={strings.lockSubtitle}
        length={kit.config.pinLength}
        blocked={waitLine}
        onSubmit={async (pin) => pinMessage(await controller.unlockWithPin(pin), controller, strings)}
        leftKey={canBio ? { label: strings.useBiometrics(bio), onPress: () => void controller.unlockWithBiometrics() } : undefined}
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
  const { controller, strings, kit, brand } = useGuardLook();
  const state = useGuardState();
  const [first, setFirst] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const length = kit.config.pinLength;
  const cancel = state.setupCancellable ? { label: strings.cancel, onPress: () => controller.cancelSetup() } : undefined;
  return (
    <GuardSurface>
      {first === null ? (
        <PinEntry
          key="first"
          header={brand.logo ?? <LockTile />}
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
          header={brand.logo ?? <LockTile />}
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

/** "Unlock with Face ID?" once, right after the first PIN. */
export function BiometricOffer() {
  const { controller, strings, theme, components } = useGuardLook();
  const state = useGuardState();
  const [busy, setBusy] = useState(false);
  if (!state.offerBiometrics || !state.biometricKind || state.covered) return null;
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
  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <GuardSurface>
        <PinEntry
          header={<LockTile />}
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
          header={<LockTile />}
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
});
