import { PickerRow, SettingRow, SettingsGroup, type ExtraPage, type IconName } from 'app-account-kit';
import { useState } from 'react';
import { View } from 'react-native';
import { useGuardLook, useGuardState } from './context';
import { durationLabel } from './strings';
import { ChangePinSheet, PinSheet, pinMessage } from './ui/screens';

export interface SecurityPageProps {
  /** Icon tile colors, one per row kind. Default: the theme's accent. */
  tint?: string;
}

/**
 * The Security page for app-settings-kit (built from app-account-kit's rows, so it matches the rest of Settings):
 * Face ID, Change PIN, Lock after, Hide amounts after, and App lock where the lock is optional.
 * Put it inside `GuardProvider` (Settings already is, when the provider wraps the app).
 */
export function SecurityPage({ tint }: SecurityPageProps) {
  const { controller, strings, kit, theme, components } = useGuardLook();
  const state = useGuardState();
  const [changing, setChanging] = useState(false);
  const [turningOff, setTurningOff] = useState(false);
  const color = tint ?? theme.accent;
  const lockOn = state.settings.lock && state.phase !== 'off';
  const bio = state.biometricKind ? strings.biometricName(state.biometricKind) : null;
  const bioIcon: IconName = state.biometricKind === 'fingerprint' ? 'unlock' : 'smile';
  const choices = (xs: readonly number[]) => xs.map((s) => ({ value: s, label: durationLabel(s, strings) }));

  return (
    <View style={{ gap: 16 }}>
      <SettingsGroup>
        {!kit.config.requirePin ? (
          <SettingRow
            icon="lock"
            tint={color}
            label={strings.lockRow}
            toggle={{ value: lockOn, onChange: (on) => (on ? controller.turnOnLock() : setTurningOff(true)) }}
          />
        ) : null}
        {lockOn && bio ? (
          <SettingRow
            icon={bioIcon}
            tint={color}
            label={strings.biometricsRow(bio)}
            toggle={{ value: state.settings.biometrics, onChange: (on) => void (on ? controller.enableBiometrics() : controller.disableBiometrics()) }}
          />
        ) : null}
        {lockOn ? <SettingRow icon="key" tint={color} label={strings.changePinRow} onPress={() => setChanging(true)} /> : null}
        {lockOn ? (
          <PickerRow
            icon="clock"
            tint={color}
            label={strings.lockAfterRow}
            options={choices(withCurrent(kit.config.graceChoices, state.settings.graceSeconds))}
            value={state.settings.graceSeconds}
            onChange={(s) => void controller.setGraceSeconds(s)}
          />
        ) : null}
        <PickerRow
          icon="eye-off"
          tint={color}
          label={strings.hideAfterRow}
          options={choices(withCurrent(kit.config.idleChoices, state.settings.idleHideSeconds))}
          value={state.settings.idleHideSeconds}
          onChange={(s) => void controller.setIdleHideSeconds(s)}
          last
        />
      </SettingsGroup>
      <components.Text style={{ color: theme.muted, fontSize: 13, paddingHorizontal: 4 }}>{strings.securityFooter}</components.Text>
      <ChangePinSheet visible={changing} onClose={() => setChanging(false)} />
      <PinSheet
        visible={turningOff}
        title={strings.lockOffConfirm}
        onClose={() => setTurningOff(false)}
        onSubmit={async (pin) => {
          const result = await controller.turnOffLock(pin);
          if (result === 'ok') setTurningOff(false);
          return pinMessage(result, controller, strings);
        }}
      />
    </View>
  );
}

/** Keeps a saved value in the list even if the app later drops it as a choice. */
const withCurrent = (xs: readonly number[], current: number) => (xs.includes(current) ? xs : [...xs, current].sort((a, b) => a - b));

/** The Security page as an app-settings-kit `extraPages` entry. */
export function securityPage(options: { label?: string; icon?: IconName; tint?: string; under?: ExtraPage['under'] } = {}): ExtraPage {
  return {
    id: 'security',
    label: options.label ?? 'Security',
    icon: options.icon ?? 'lock',
    tint: options.tint,
    under: options.under,
    content: <SecurityPage tint={options.tint} />,
  };
}
