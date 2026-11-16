# app-guard-kit

Keeps a signed-in app **locked on the device**: Face ID / Touch ID with a PIN fallback when the app opens or comes back from the background, a PIN that is set up and changed on the phone, **hidden amounts** that are revealed only after the PIN and hide again on their own, and a way to reset a forgotten PIN. For React Native / Expo apps (iOS first). Nothing in it is specific to any one app.

> Status: **design only, not built yet.** Building starts only after the owner says "yes, build it". Choices marked *to confirm* are guesses waiting for the owner's decision.

Part of the shared kits:
[app-core-kit](https://github.com/yuvarajsalla20/app-core-kit) ·
[app-auth-kit](https://github.com/yuvarajsalla20/app-auth-kit) ·
[app-account-kit](https://github.com/yuvarajsalla20/app-account-kit) ·
[app-settings-kit](https://github.com/yuvarajsalla20/app-settings-kit) ·
[app-subscriptions-kit](https://github.com/yuvarajsalla20/app-subscriptions-kit) ·
[app-payments-kit](https://github.com/yuvarajsalla20/app-payments-kit) ·
[app-export-kit](https://github.com/yuvarajsalla20/app-export-kit) ·
**app-guard-kit** ·
[app-goldrates-api-kit](https://github.com/yuvarajsalla20/app-goldrates-api-kit)

First used by **PAL – Personal Asset Locker**.

---

## Contents

1. [Auth kit vs guard kit](#auth-kit-vs-guard-kit)
2. [What it does](#what-it-does)
3. [App lock](#app-lock)
4. [PIN](#pin)
5. [Face ID / Touch ID](#face-id--touch-id)
6. [Hidden amounts (reveal behind the PIN)](#hidden-amounts-reveal-behind-the-pin)
7. [Forgot PIN (OTP)](#forgot-pin-otp)
8. [Where things are stored](#where-things-are-stored)
9. [Install](#install)
10. [How an app uses it](#how-an-app-uses-it)
11. [Settings](#settings)
12. [Expo and Firebase fit](#expo-and-firebase-fit)
13. [Rules it follows](#rules-it-follows)
14. [Kit rules](#kit-rules)
15. [Build plan](#build-plan)
16. [To confirm](#to-confirm)

---

## Auth kit vs guard kit

| | [app-auth-kit](https://github.com/yuvarajsalla20/app-auth-kit) | **app-guard-kit** |
|---|---|---|
| Question it answers | **Who are you?** | **Is the owner holding this phone right now?** |
| How | Apple, Google or email sign-in through Firebase Auth | Face ID / Touch ID or a PIN, on the phone |
| How often | Once; stays signed in for weeks | Every time the app opens or comes back, and before amounts are shown |
| Where it lives | Firebase (cloud account) | The phone only (Keychain). The PIN never leaves the device |
| Lost access | Password reset email | Forgot PIN → prove who you are again (see [Forgot PIN](#forgot-pin-otp)) |

The guard kit sits **inside** a signed-in session. It never signs anyone in or out by itself, and it does not duplicate anything the auth kit does. When the guard needs to check identity again (forgot PIN, too many wrong tries), it asks the auth kit.

```
App opens ─► auth kit: signed in? ──no──► Sign-in screen (auth kit)
                    │ yes
                    ▼
            guard kit: PIN set? ──no──► Set up PIN (+ offer Face ID)
                    │ yes
                    ▼
            Lock screen: Face ID ─► fallback PIN ─► App (amounts hidden)
                                                        │ tap 👁
                                                        ▼
                                                   PIN ─► amounts shown ─► hidden again on idle / leaving
```

## What it does

- **App lock** when the app opens and when it returns from the background.
- **PIN** set up, change and turn off, kept on the device.
- **Face ID / Touch ID** as the quick way in, with the PIN as fallback.
- **Hidden amounts:** an `<Amount>` component and a `useReveal()` hook. Amounts show as `•••••` until the eye is tapped and the PIN is entered.
- **Auto-hide:** amounts hide again after a configurable idle time, and whenever the app goes to the background or locks.
- **Privacy cover** in the app switcher, so the last screen is not visible in the snapshot.
- **Forgot PIN / OTP** reset.
- **Wrong-PIN limits** with growing wait times.
- A **Security page** for app-settings-kit.

## App lock

| When | What happens |
|---|---|
| Cold start (app opened) | Lock screen first, before any app screen draws |
| Back from background | Locked again if it was away longer than the **grace time** |
| Grace time | Default **0 seconds** (lock every time), options 0 s / 30 s / 1 min / 5 min. *To confirm* |
| Phone locked while in the app | Treated as going to the background |
| App switcher | A cover (app logo on the theme background) hides the screen while the app is inactive |
| Signed out | No lock (the auth kit's sign-in screen shows instead). Sign-out clears the PIN |

The lock screen is themeable like the auth kit's sign-in screen (logo, colours, fonts, wording). It shows the Face ID prompt straight away, with a "Use PIN" button.

## PIN

- **Length:** 4 digits (the mockup uses 4). 6 digits as an option. *To confirm*
- Set up right after first sign-in (required for apps that turn `requirePin` on, as PAL does), entered twice to confirm.
- Rejects obvious PINs: `0000`, `1234`, `1111`… *To confirm*
- Change PIN needs the current PIN. Turning the lock off needs the PIN too (PAL keeps it always on).
- **Wrong tries:** after 5 wrong tries, wait 30 s; then 1 min, 5 min, 15 min. After 10 wrong tries, the app asks the person to sign in again (auth kit) and set a new PIN. Nothing is ever erased automatically. *Numbers to confirm*
- The waiting time is counted with the device's uptime clock, so changing the phone's time does not skip it.

## Face ID / Touch ID

- Offered after the PIN is set ("Unlock with Face ID?"). Can be turned on and off in Settings.
- Uses `expo-local-authentication`. The prompt text comes from the app (`NSFaceIDUsageDescription` in `app.json`).
- If Face ID fails, is cancelled, is not enrolled, or the phone's Face ID set changes (someone adds a new face), the kit falls back to the PIN. *A change in enrolled faces turns Face ID off until the PIN is entered: to confirm.*
- Face ID can also reveal hidden amounts, if the app allows it (`revealWith: 'pin' | 'pin-or-biometric'`). PAL: **PIN only** for now, as decided. *To confirm*

## Hidden amounts (reveal behind the PIN)

Every money amount in the app goes through the kit, so nothing can show by accident.

```tsx
import { Amount, RevealButton, useReveal } from 'app-guard-kit';

<Amount value={245000} format={formatInr} />   // shows ••••• until revealed
<RevealButton />                               // the 👁 icon; asks for the PIN, then reveals all amounts
const { revealed, reveal, hide } = useReveal();
```

| Rule | Default |
|---|---|
| Hidden when the app opens | Always |
| Revealing | Tap 👁 → PIN → **all** amounts on all screens show |
| Hide again after idle | **60 seconds** without a touch. Options: 30 s / 1 min / 2 min / 5 min. Set in Settings. *Default to confirm* (the mockup uses 20 s for the demo) |
| Hide again when leaving | Going to the background, the app switcher, or the lock screen always hides |
| Tapping 👁 while shown | Hides straight away |
| Masked text | `•••••` with the same width for every amount, so lengths do not give values away |
| Screen reader | Reads "Amount hidden" |
| Screenshots while shown | Allowed. Blocking them (`expo-screen-capture`) is an option. *To confirm* |

"Idle" means no touch on the screen. The kit wraps the app in a touch listener to reset the timer, and the timer stops while the app is in the background.

The revealed state lives **in memory only**. It is never saved, so a restart always starts hidden.

## Forgot PIN (OTP)

The person must prove who they are before setting a new PIN. Two ways, *which one to confirm*:

| Option | How | Notes |
|---|---|---|
| **A. Sign in again (recommended)** | "Forgot PIN" → the auth kit re-confirms the account (Apple, Google or email password, the same step it uses before Delete account) → set a new PIN | No extra servers or email sending. Works today with the auth kit |
| **B. One-time code (OTP) by email** | "Forgot PIN" → a Cloud Function emails a 6-digit code to the account's email → enter it → set a new PIN | Needs a Cloud Function, an email sender and rate limits. Codes expire after 10 minutes, 5 tries, at most 3 codes an hour |

Either way, a reset clears the old PIN and the Face ID setting, and the amounts stay hidden.

## Where things are stored

| What | Where | Leaves the phone? |
|---|---|---|
| PIN | **Salted hash** (PBKDF2 via `expo-crypto`, *to confirm*) in `expo-secure-store` (iOS Keychain, "this device only, when unlocked") | Never |
| Face ID on/off, grace time, idle time | `expo-secure-store` | Never |
| Wrong-try count and wait-until | `expo-secure-store` | Never |
| Revealed / hidden | Memory | Never |
| OTP codes (option B only) | Hashed in Firestore, written only by the Cloud Function, deleted after use | Yes, server-side only |

Nothing about the PIN is sent to Firebase, Sentry or logs. Keychain items are set to **not** move to a new phone or a backup, so a new phone asks to set the PIN again after sign-in.

## Install

Pinned like every kit: full commit SHA of a release tag, with the tag in `kitVersions`.

```jsonc
// package.json of the app
"dependencies": {
  "app-guard-kit": "git+https://github.com/yuvarajsalla20/app-guard-kit.git#<full SHA of v1.0.0>"
},
"kitVersions": {
  "app-guard-kit": "v1.0.0"
}
```

Find a SHA with `git ls-remote https://github.com/yuvarajsalla20/app-guard-kit refs/tags/v1.0.0`. Use `git+https`, never `git+ssh`.

**Peer dependencies** (install with `npx expo install`):

| Package | Needed for |
|---|---|
| `app-core-kit`, `react`, `react-native`, `react-native-safe-area-context` | Always |
| `expo-local-authentication` | Face ID / Touch ID |
| `expo-secure-store` | Keeping the PIN hash and settings in the Keychain |
| `expo-crypto` | Hashing the PIN |
| `expo-screen-capture` | Only if screenshot blocking is turned on |
| `app-auth-kit` | Forgot PIN and too many wrong tries (re-confirm the account) |

Face ID needs a **development build**, not Expo Go.

## How an app uses it

```ts
// guard.ts (one per app)
import { createGuardKit } from 'app-guard-kit';
import { reportError } from 'app-core-kit';
import { authKit } from './authKit';

export const guard = createGuardKit({
  requirePin: true,               // PAL: the lock cannot be turned off
  pinLength: 4,
  biometrics: true,               // offer Face ID
  graceSeconds: 0,                // lock every time the app comes back
  idleHideSeconds: 60,            // hide amounts after 60 s idle
  revealWith: 'pin',              // 'pin' | 'pin-or-biometric'
  reconfirm: authKit.reconfirm,   // forgot PIN / too many tries → auth kit
  onError: reportError,
});
```

```tsx
// App.tsx
<SafeAreaProvider>
  <SubscriptionProvider …>
    <GuardProvider kit={guard} userId={uid} brand={{ logo: <Logo /> }} theme={{ bg: '#FBF8F3', accent: '#A87A2E' }}>
      <ErrorBoundary where="app">{/* screens */}</ErrorBoundary>
    </GuardProvider>
  </SubscriptionProvider>
</SafeAreaProvider>
```

`GuardProvider` draws the lock screen over the app when locked, the PIN setup when no PIN is set, and the app-switcher cover. `userId` comes from the auth kit: when it changes or becomes empty (sign-out), the PIN and settings for the old user are cleared.

*All names above are a sketch, to confirm when building.*

## Settings

The kit gives a **Security page** to drop into app-settings-kit's `extraPages`:

- Face ID: on / off
- Change PIN
- Lock after: Immediately / 30 s / 1 min / 5 min
- Hide amounts after: 30 s / 1 min / 2 min / 5 min
- Turn off lock (hidden when `requirePin` is on)

It is built from app-account-kit's `SettingRow` and `PickerRow`, so it looks like the rest of Settings.

## Expo and Firebase fit

- **Expo:** only Expo modules (`expo-local-authentication`, `expo-secure-store`, `expo-crypto`). The Face ID wording goes in `app.json` through the `expo-local-authentication` config plugin (`faceIDPermission`). No hand-edited `ios/` or `android/`.
- **Firebase:** the lock itself uses no Firebase at all. Only option B of [Forgot PIN](#forgot-pin-otp) would add a Cloud Function and a Firestore collection.
- **Sentry (core kit):** errors are reported through `onError`, without PIN digits, counts or amounts.
- **Delete account (auth kit):** the app's `eraseData` should call `guard.clear()`, so the Keychain is wiped too.

## Rules it follows

- The PIN is never stored in plain text, never logged, never sent anywhere.
- The lock screen shows **before** any app content on cold start, so nothing flashes.
- Amounts start hidden on every launch and hide on every trip to the background.
- A wrong PIN and a cancelled Face ID never sign the person out by themselves.
- Every word can be reworded through `strings`, like the other kits.
- Respects Reduce Motion and Dynamic Type.

## Kit rules

- **The kit tags itself.** Raise `version` in `package.json` and `KIT_VERSION` (a test checks they match) inside the pull request and add a CHANGELOG note. Merging creates tag `v<version>` through the `version-tag` workflow, which refuses a pull request whose version is not higher than the latest tag. Never tag by hand.
- **Nothing app-specific** in the kit. Logo, colours and wording come from the app.
- **Commit and push only when the owner says so.**

### Planned folder layout

```
src/
  createGuardKit.ts   options and the kit object
  GuardProvider.tsx   lock screen, PIN setup, app-switcher cover, idle timer
  pin.ts              hashing, checking, wrong-try limits
  biometrics.ts       Face ID / Touch ID through expo-local-authentication
  reveal.tsx          Amount, RevealButton, useReveal
  SecurityPage.tsx    the Settings page
  strings.ts theme.ts kit.ts
tests/                vitest, with stand-ins for the Expo modules
```

## Build plan

| Step | What | Done when |
|---|---|---|
| 1 | Repo setup: package.json, TypeScript, lint, vitest, `version-tag` workflow, licence | Builds cleanly |
| 2 | PIN: hash, check, change, clear, wrong-try limits | Tests cover right, wrong and lockout |
| 3 | Face ID with PIN fallback | Works on a development build |
| 4 | `GuardProvider`: lock on start and on return, grace time, app-switcher cover | No app content flashes on start (tested on device) |
| 5 | Hidden amounts: `Amount`, `RevealButton`, `useReveal`, idle timer, hide on background | Tests for idle and background hide |
| 6 | Forgot PIN (option A or B, as decided) | A reset works end to end |
| 7 | Security page for app-settings-kit | Shows in PAL's Settings |
| 8 | Release v1.0.0 and pin it in PAL | PAL's `check:kits` passes |

## To confirm

1. PIN length: 4 (as in the mockup) or 6.
2. Forgot PIN: sign in again (recommended) or an email OTP.
3. Default idle time before amounts hide (60 s suggested; the mockup demo uses 20 s).
4. Grace time before re-locking (0 s suggested).
5. Can Face ID reveal amounts, or the PIN only.
6. Wrong-try limits (5 tries then waits; sign in again after 10).
7. Block screenshots while amounts are shown, or not.
8. Reject obvious PINs like 1234.

## License

MIT
