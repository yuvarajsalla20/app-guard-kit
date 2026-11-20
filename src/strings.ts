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
  /** 1.6.0: optional grey headings on the Security page. With `lockGroup` set, the lock rows (lock, Face ID, Change PIN, Lock after) and Hide amounts after sit in two cards. Empty (the default): one card, no heading. */
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
  biometricName: (kind) => (kind === 'face' ? 'Face ID' : 'Touch ID'),
  lockTitle: 'Locked',
  lockSubtitle: 'Enter your PIN to open.',
  useBiometrics: (bio) => `Use ${bio}`,
  biometricPrompt: (bio) => `Unlock with ${bio}`,
  forgotPin: 'Forgot PIN?',
  enterPin: 'Enter PIN',
  wrongPin: (n) => (n === 1 ? 'Wrong PIN. 1 try left.' : `Wrong PIN. ${n} tries left.`),
  waitFor: (t) => `Too many tries. Try again in ${t}.`,
  checking: 'Checking…',
  couldNotCheck: 'Could not check the PIN. Try again.',
  tooManyTitle: 'Too many tries',
  tooManyBody: 'For your safety, sign in again to set a new PIN. Nothing has been deleted.',
  signInAgain: 'Sign in again',
  pinGone: 'Sign in again to set a new PIN.',
  setupTitle: 'Create a PIN',
  setupSubtitle: (n) => `${n} digits. You will use it to open the app and to show amounts.`,
  confirmTitle: 'Enter it again',
  confirmSubtitle: 'To make sure it is right.',
  mismatch: 'Those PINs did not match. Start again.',
  obvious: 'That PIN is too easy to guess. Pick another.',
  couldNotSave: 'Could not save the PIN. Try again.',
  cancel: 'Cancel',
  back: 'Back',
  offerTitle: (bio) => `Unlock with ${bio}?`,
  offerBody: (bio) => `Open the app with ${bio}. Your PIN still works any time.`,
  offerYes: (bio) => `Use ${bio}`,
  offerNo: 'Not now',
  offerSwitch: (bio) => `Unlock with ${bio}`,
  offerOnNote: (bio) => `${bio} is on. You can change this in Settings > Security.`,
  offerOffNote: (bio) => `${bio} is off. You can turn it on in Settings > Security.`,
  offerContinue: 'Continue',
  biometricsChanged: (bio) => `${bio} changed on this phone, so it was turned off. Turn it on again in Settings.`,
  revealTitle: 'Enter PIN to show amounts',
  revealSubtitle: (idle) => `They hide again after ${idle} with no activity, or when you leave the app.`,
  hiddenAmount: 'Amount hidden',
  showAmounts: 'Show amounts',
  hideAmounts: 'Hide amounts',
  changeTitle: 'Change PIN',
  currentPin: 'Enter your current PIN',
  newPin: 'Enter a new PIN',
  confirmNewPin: 'Enter the new PIN again',
  pinChanged: 'PIN changed',
  securityTitle: 'Security',
  securityFooter: 'Your PIN stays on this phone. It is never sent anywhere.',
  biometricsRow: (bio) => bio,
  changePinRow: 'Change PIN',
  lockAfterRow: 'Lock after',
  hideAfterRow: 'Hide amounts after',
  lockRow: 'App lock',
  lockGroup: '',
  privacyGroup: '',
  lockOffConfirm: 'Enter your PIN to turn the lock off',
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
