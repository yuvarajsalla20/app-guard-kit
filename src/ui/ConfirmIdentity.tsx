import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useEffect, useRef } from 'react';
import { useGuardLook, useGuardState } from '../context';
import { PinEntry } from './PinEntry';
import { LockTile, pinMessage, useWaitLine } from './parts';

export interface ConfirmIdentityProps {
  /** Called once Face ID or the PIN confirmed the person. */
  onConfirmed: () => void;
  /** Ask for Face ID once when the page opens (default true), like the lock screen. */
  offerBiometricsOnOpen?: boolean;
}

/**
 * 2.1.0: "Confirm It's You" inside a page of the app, before a serious step (e.g., closing the account): Face ID when it
 * is on, or the PIN. Wrong PINs count toward the same waits and sign-in limit as the lock screen. Render it inside
 * `GuardProvider`; it draws no screen of its own, so it fits in a step page such as app-account-kit's `exitMenu.unlock`.
 */
export function ConfirmIdentity({ onConfirmed, offerBiometricsOnOpen = true }: ConfirmIdentityProps) {
  const { controller, strings, kit, theme } = useGuardLook();
  const state = useGuardState();
  const waitLine = useWaitLine();
  const canBio = controller.canUseBiometrics();
  const bio = canBio && state.biometricKind ? strings.biometricName(state.biometricKind) : null;
  const done = useRef(onConfirmed);
  useEffect(() => {
    done.current = onConfirmed;
  }, [onConfirmed]);
  const asked = useRef(false);

  const tryBiometrics = async () => {
    if ((await controller.confirmWithBiometrics()) === 'ok') done.current();
  };
  useEffect(() => {
    if (asked.current || !offerBiometricsOnOpen || !canBio) return;
    asked.current = true;
    void controller.confirmWithBiometrics().then((r) => r === 'ok' && done.current());
  }, [offerBiometricsOnOpen, canBio, controller]);

  return (
    <PinEntry
      header={<LockTile />}
      title={strings.identityTitle}
      subtitle={strings.identitySubtitle(bio)}
      length={kit.config.pinLength}
      blocked={waitLine}
      onSubmit={async (pin) => {
        const result = await controller.confirmPin(pin);
        if (result === 'ok') onConfirmed();
        return pinMessage(result, controller, strings);
      }}
      leftKey={
        bio
          ? {
              label: strings.useBiometrics(bio),
              onPress: () => void tryBiometrics(),
              icon: <MaterialCommunityIcons name={state.biometricKind === 'fingerprint' ? 'fingerprint' : 'face-recognition'} size={28} color={theme.muted} />,
              caption: bio,
            }
          : undefined
      }
    />
  );
}
