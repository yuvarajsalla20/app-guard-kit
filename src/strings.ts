import { Platform } from 'react-native';
import type { BiometricKind } from './controller';

/** Every word the kit shows, so an app can reword or translate it. `bio` is "Face ID" or "Touch ID". */
export interface GuardStrings {
  biometricName: (kind: BiometricKind) => string;
  // Lock screen
  lockTitle: string;
  lockSubtitle: string;
  useBiometrics: (bio: string) => string;
  biometricPrompt: (bio: string) => string;
  forgotPin: string;
  /** 2.1.0: ConfirmIdentity, the check before a serious step (e.g., closing the account). `bio` is null without Face ID. */
  identityTitle: string;
  identitySubtitle: (bio: string | null) => string;
  // PIN entry
  enterPin: string;
  wrongPin: (triesLeft: number) => string;
  waitFor: (time: string) => string;
  checking: string;
  couldNotCheck: string;
  tooManyTitle: string;
  tooManyBody: string;
  signInAgain: string;
  pinGone: string;
  // Setup
  setupTitle: string;
  setupSubtitle: (length: number) => string;
  confirmTitle: string;
  confirmSubtitle: string;
  mismatch: string;
  obvious: string;
  couldNotSave: string;
  cancel: string;
  back: string;
  // Face ID offer
  offerTitle: (bio: string) => string;
  offerBody: (bio: string) => string;
  offerYes: (bio: string) => string;
  offerNo: string;
  /** The page form of the offer (brand.offerAsPage): the switch label, the line under it (on / off) and the button. */
  offerSwitch: (bio: string) => string;
  offerOnNote: (bio: string) => string;
  offerOffNote: (bio: string) => string;
  offerContinue: string;
  biometricsChanged: (bio: string) => string;
  // Hidden amounts
  revealTitle: string;
  revealSubtitle: (idle: string) => string;
  hiddenAmount: string;
  showAmounts: string;
  hideAmounts: string;
  // Change PIN
  changeTitle: string;
  currentPin: string;
  newPin: string;
  confirmNewPin: string;
  pinChanged: string;
  // Security page
  securityTitle: string;
  securityFooter: string;
  biometricsRow: (bio: string) => string;
  changePinRow: string;
  lockAfterRow: string;
  hideAfterRow: string;
  lockRow: string;
  /** 1.6.0: optional grey headings on the Security page. 2.0.0: on by default (App Lock, Privacy): the lock rows (App Lock, Face ID, Change PIN, Lock After) and Hide Amounts After sit in two titled cards. Set both to '' for one card with no heading. */
  lockGroup: string;
  privacyGroup: string;
  lockOffConfirm: string;
  immediately: string;
  seconds: (n: number) => string;
  minutes: (n: number) => string;
  deleteKey: string;
  digit: (n: number) => string;
  pinProgress: (entered: number, length: number) => string;
}

const time = (s: number) => (s < 60 ? `${s} s` : s % 60 === 0 ? `${s / 60} min` : `${Math.floor(s / 60)} min ${s % 60} s`);

export const DEFAULT_STRINGS: GuardStrings = {
  // Face ID and Touch ID are Apple's names. Android says Face Unlock or Fingerprint.
  biometricName: (kind) =>
    Platform.OS === 'android' ? (kind === 'face' ? 'Face Unlock' : 'Fingerprint') : kind === 'face' ? 'Face ID' : 'Touch ID',
  lockTitle: 'Locked',
  lockSubtitle: 'Enter your PIN to continue.',
  useBiometrics: (bio) => `Use ${bio}`,
  identityTitle: 'Confirm It\'s You',
  identitySubtitle: (bio) => (bio ? `Use ${bio} or enter your PIN.` : 'Enter your PIN to continue.'),
  biometricPrompt: (bio) => `Unlock with ${bio}`,
  forgotPin: 'Forgot PIN?',
  enterPin: 'Enter PIN',
  wrongPin: (n) => (n === 1 ? 'Incorrect PIN. 1 attempt remaining.' : `Incorrect PIN. ${n} attempts remaining.`),
  waitFor: (t) => `Too many attempts. Try again in ${t}.`,
  checking: 'Verifying…',
  couldNotCheck: 'Unable to verify your PIN. Please try again.',
  tooManyTitle: 'Too Many Attempts',
  tooManyBody: 'For your security, please sign in again to set a new PIN. Your data is not affected.',
  signInAgain: 'Sign In Again',
  pinGone: 'Please sign in again to set a new PIN.',
  setupTitle: 'Create a PIN',
  setupSubtitle: (n) => `Choose a ${n}-digit PIN. You will use it to unlock the app and to show amounts.`,
  confirmTitle: 'Confirm Your PIN',
  confirmSubtitle: 'Enter the same PIN again.',
  mismatch: 'The PINs do not match. Please try again.',
  obvious: 'This PIN is too easy to guess. Please choose another.',
  couldNotSave: 'Unable to save your PIN. Please try again.',
  cancel: 'Cancel',
  back: 'Back',
  offerTitle: (bio) => `Unlock with ${bio}?`,
  offerBody: (bio) => `Use ${bio} to unlock the app. Your PIN remains available at any time.`,
  offerYes: (bio) => `Use ${bio}`,
  offerNo: 'Not Now',
  offerSwitch: (bio) => `Unlock with ${bio}`,
  offerOnNote: (bio) => `${bio} is on. You can change this at any time in Settings > Security.`,
  offerOffNote: (bio) => `${bio} is off. You can turn it on at any time in Settings > Security.`,
  offerContinue: 'Continue',
  biometricsChanged: (bio) => `${bio} settings changed on this device, so ${bio} unlock has been turned off. You can turn it on again in Settings > Security.`,
  revealTitle: 'Enter PIN to Show Amounts',
  revealSubtitle: (idle) => `Amounts are hidden again after ${idle} of inactivity, or when you leave the app.`,
  hiddenAmount: 'Amount hidden',
  showAmounts: 'Show Amounts',
  hideAmounts: 'Hide Amounts',
  changeTitle: 'Change PIN',
  currentPin: 'Enter Your Current PIN',
  newPin: 'Enter a New PIN',
  confirmNewPin: 'Confirm Your New PIN',
  pinChanged: 'PIN Updated',
  securityTitle: 'Security',
  securityFooter: 'Your PIN is stored securely on this device and is never shared.',
  biometricsRow: (bio) => bio,
  changePinRow: 'Change PIN',
  lockAfterRow: 'Lock After',
  hideAfterRow: 'Hide Amounts After',
  lockRow: 'App Lock',
  lockGroup: 'App Lock',
  privacyGroup: 'Privacy',
  lockOffConfirm: 'Enter your PIN to turn off App Lock.',
  immediately: 'Immediately',
  seconds: (n) => `${n} s`,
  minutes: (n) => (n === 1 ? '1 min' : `${n} min`),
  deleteKey: 'Delete',
  digit: (n) => String(n),
  pinProgress: (e, l) => `${e} of ${l} digits entered`,
};

export const formatSeconds = time;

/** "Immediately", "30 s", "1 min", "5 min" for the Settings pickers. */
export const durationLabel = (s: number, strings: GuardStrings) =>
  s === 0 ? strings.immediately : s % 60 === 0 ? strings.minutes(s / 60) : s < 60 ? strings.seconds(s) : time(s);
