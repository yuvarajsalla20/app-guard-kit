import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useGuardLook, useGuardState } from '../context';
import { PinEntry } from './PinEntry';
import { GuardSurface, TextButton, pinMessage, useHeader, useWaitLine } from './parts';

export { BiometricOffer } from './BiometricOffer';
export { Cover, GuardSurface, pinMessage, useWaitLine } from './parts';
export { ChangePinSheet, PinSheet } from './sheets';

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

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  note: { fontSize: 13, textAlign: 'center', maxWidth: 300, marginBottom: 4 },
  footer: { alignItems: 'center', marginTop: 16, gap: 8 },
});
