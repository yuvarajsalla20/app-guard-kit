import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useGuardLook, useGuardState } from '../context';
import { GuardSurface, TextButton, useHeader } from './parts';

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

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginTop: 12 },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  note: { fontSize: 13, textAlign: 'center', maxWidth: 300, marginBottom: 4 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end', padding: 16 },
  card: { borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, padding: 24, alignItems: 'center', marginBottom: 16 },
  primary: { alignSelf: 'stretch', borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  primaryLabel: { fontSize: 16, fontWeight: '600' },
  switchRow: { alignSelf: 'center', width: '100%', maxWidth: 360, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12, marginTop: 24 },
  switchLabel: { fontSize: 16, fontWeight: '500' },
  // A compact pill in the middle of the page, not a full-width bar.
  pageButton: { alignSelf: 'center', minWidth: 180, paddingHorizontal: 40, borderRadius: 999 },
});
