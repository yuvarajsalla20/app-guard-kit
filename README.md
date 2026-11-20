# app-guard-kit

Keeps a signed-in app **locked on the device**: Face ID / Touch ID with a PIN fallback when the app opens or comes back from the background, a PIN that is set up and changed on the phone, **hidden amounts** that are revealed only after the PIN and hide again on their own, and a way to reset a forgotten PIN. For React Native / Expo apps (iOS first). Nothing in it is specific to any one app.

> Status: **v1.6.0.** The open choices were decided by the owner on 2026-11-16; see [Decisions](#decisions).

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
7. [Forgot PIN](#forgot-pin)
8. [Where things are stored](#where-things-are-stored)
9. [Install](#install)
10. [How an app uses it](#how-an-app-uses-it)
11. [Settings](#settings)
12. [Expo and Firebase fit](#expo-and-firebase-fit)
13. [Rules it follows](#rules-it-follows)
14. [Kit rules](#kit-rules)
15. [Build plan](#build-plan)
16. [Decisions](#decisions)
17. [Known limits](#known-limits)

---

## Auth kit vs guard kit

| | [app-auth-kit](https://github.com/yuvarajsalla20/app-auth-kit) | **app-guard-kit** |
|---|---|---|
| Question it answers | **Who are you?** | **Is the owner holding this phone right now?** |
| How | Apple, Google or email sign-in through Firebase Auth | Face ID / Touch ID or a PIN, on the phone |
| How often | Once; stays signed in for weeks | Every time the app opens or comes back, and before amounts are shown |
| Where it lives | Firebase (cloud account) | The phone only (Keychain). The PIN never leaves the device |
| Lost access | Password reset email | Forgot PIN → prove who you are again (see [Forgot PIN](#forgot-pin)) |

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
- **Forgot PIN** reset by signing in again.
- **Wrong-PIN limits** with growing wait times.
- A **Security page** for app-settings-kit.

## App lock

| When | What happens |
|---|---|
| Cold start (app opened) | Lock screen first, before any app screen draws |
| Back from background | Locked again if it was away longer than the **grace time** |
| Grace time | Default **0 seconds** (lock every time), options 0 s / 30 s / 1 min / 5 min |
| Phone locked while in the app | Treated as going to the background |
| App switcher | A cover (app logo on the theme background) hides the screen while the app is inactive |
| Signed out | No lock (the auth kit's sign-in screen shows instead). Sign-out clears the PIN |

The lock screen is themeable like the auth kit's sign-in screen (logo, colours, fonts, wording). It shows the Face ID prompt straight away, with a "Use PIN" button.

## PIN

- **Length:** 4 digits (the mockup uses 4). Apps can choose 6 with `pinLength: 6`.
- Set up right after first sign-in (required for apps that turn `requirePin` on, as PAL does), entered twice to confirm.
- Rejects obvious PINs: one digit repeated (`0000`), straight runs up or down (`1234`, `4321`, `9012`), two digits taking turns (`1212`), `123123` and a few favourites. Turn off with `rejectObviousPins: false`.
- Change PIN needs the current PIN. Turning the lock off needs the PIN too (PAL keeps it always on).
- **Wrong tries:** after 5 wrong tries, wait 30 s; then 1 min, 5 min, 15 min. After 10 wrong tries, the app asks the person to sign in again (auth kit) and set a new PIN. Nothing is ever erased automatically. Apps can change the numbers with `limits`.
- **Checking a PIN** (PBKDF2, 10,000 rounds) runs in short slices, so the screen never freezes while it works (1.4.0). An app may pass a native PBKDF2 as `modules: { pbkdf2 }` to `createGuardKit` for faster checks; it must give the same bytes, and saved PINs keep working.
- The wait is saved in the Keychain, so closing the app does not end it. Setting the phone's clock back starts the wait again. Setting it forward can shorten a wait, but every wrong try still counts toward the limit of 10, which always ends in signing in again. (Expo has no device-uptime clock to do better without a native module.)

## Face ID / Touch ID

- Offered after the PIN is set ("Unlock with Face ID?"). Can be turned on and off in Settings.
- Uses `expo-local-authentication`. The prompt text comes from the app (`NSFaceIDUsageDescription` in `app.json`).
- If Face ID fails, is cancelled, is not enrolled, or the phone's Face ID set changes (someone adds a new face), the kit falls back to the PIN. A change in enrolled faces turns Face ID off until the PIN is entered: Face ID reads a Keychain secret that iOS keeps only for "the faces enrolled now" (`biometryCurrentSet`), and iOS deletes it when a face is added.
- Face ID can also reveal hidden amounts, if the app allows it (`revealWith: 'pin' | 'pin-or-biometric'`). Default and PAL: **PIN only**.

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
| Hide again after idle | **60 seconds** without a touch. Options: 30 s / 1 min / 2 min / 5 min. Set in Settings (the mockup uses 20 s for the demo) |
| Hide again when leaving | Going to the background, the app switcher, or the lock screen always hides |
| Tapping 👁 while shown | Hides straight away |
| Masked text | `•••••` with the same width for every amount, so lengths do not give values away |
| Screen reader | Reads "Amount hidden" |
| Screenshots while shown | Allowed. Apps can block them with `blockScreenshotsWhenRevealed: true` and `screenCapture` (`expo-screen-capture`) |
| With the lock off | Amounts start hidden and the eye shows them without a PIN. With `hideAmountsWithoutLock: false` (1.5.0) they show while the lock is off, and `RevealButton` is not drawn |

`Amount` (1.5.0) also takes `mask` as an element (a currency sign and smaller dots, say), `adjustsFontSizeToFit`, and `label`, what a screen reader hears while shown, so an app can animate `value` and still read out the final amount. `useAmountsHidden()` says whether amounts are hidden right now, for amounts an app draws itself.

"Idle" means no touch on the screen. The kit wraps the app in a touch listener to reset the timer, and the timer stops while the app is in the background.

The revealed state lives **in memory only**. It is never saved, so a restart always starts hidden.

## Forgot PIN

The person must prove who they are before setting a new PIN. Two ways were considered; **A is built**:

| Option | How | Notes |
|---|---|---|
| **A. Sign in again (built)** | "Forgot PIN" → the app's `reconfirm` re-confirms the account through the auth kit (Apple, Google or email password, the same step used before Delete account) → set a new PIN | No extra servers or email sending |
| B. One-time code (OTP) by email (not built) | "Forgot PIN" → a Cloud Function emails a 6-digit code to the account's email → enter it → set a new PIN | Needs a Cloud Function, an email sender and rate limits. Codes expire after 10 minutes, 5 tries, at most 3 codes an hour |

A reset clears the old PIN and the Face ID setting, and the amounts stay hidden.

## Where things are stored

| What | Where | Leaves the phone? |
|---|---|---|
| PIN | **Salted hash** (PBKDF2-HMAC-SHA-256, 10,000 rounds, 16-byte random salt from `expo-crypto`) in `expo-secure-store` (iOS Keychain, "this device only, when unlocked") | Never |
| Face ID on/off, grace time, idle time | `expo-secure-store` | Never |
| Face ID secret (a random token) | `expo-secure-store` behind Face ID, for the faces enrolled now | Never |
| Wrong-try count and wait-until | `expo-secure-store` | Never |
| Revealed / hidden | Memory | Never |

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
| `react`, `react-native`, `react-native-safe-area-context`, `@expo/vector-icons` | Always |
| `expo-local-authentication` | Face ID / Touch ID (is it on this phone, Face or Touch) |
| `expo-secure-store` | The PIN hash, settings and the Face ID secret in the Keychain |
| `expo-crypto` | Random salt for the PIN hash |
| `app-account-kit` ≥ 7.12.0 | Only for the Security page (`app-guard-kit/settings`) |
| `expo-screen-capture` | Only if screenshot blocking is turned on (the app passes it in) |

The kit does not import app-core-kit or app-auth-kit itself: the app passes `onError: reportError` and a `reconfirm` function, so each kit stays independent.

Face ID needs a **development build**, not Expo Go. In `app.json`, give the Face ID wording to both plugins:

```jsonc
"plugins": [
  ["expo-local-authentication", { "faceIDPermission": "PAL uses Face ID to open your locker." }],
  ["expo-secure-store", { "faceIDPermission": "PAL uses Face ID to open your locker." }]
]
```

## How an app uses it

```ts
// src/security/guard.ts (one per app)
import { createGuardKit } from 'app-guard-kit';
import { reportError } from 'app-core-kit';
import { reconfirmAccount } from '../auth/reconfirm';

export const guard = createGuardKit({
  requirePin: true,               // PAL: the lock cannot be turned off
  pinLength: 4,
  biometrics: true,               // offer Face ID
  graceSeconds: 0,                // lock every time the app comes back
  idleHideSeconds: 60,            // hide amounts after 60 s idle
  revealWith: 'pin',              // 'pin' | 'pin-or-biometric'
  reconfirm: reconfirmAccount,    // Forgot PIN / too many tries: sign in again, resolve true when it was them
  onError: reportError,
});
```

```tsx
// App.tsx
<SafeAreaProvider>
  <SubscriptionProvider …>
    <GuardProvider kit={guard} userId={authLoading ? undefined : user?.uid ?? null} brand={{ logo: <Logo /> }} theme={{ bg: '#FBF8F3', key: '#F3EDE4', accent: '#A87A2E' }}>
      <ErrorBoundary where="app">{/* screens */}</ErrorBoundary>
    </GuardProvider>
  </SubscriptionProvider>
</SafeAreaProvider>
```

`GuardProvider` draws the lock screen over the app when locked, the PIN setup when no PIN is set, the "Unlock with Face ID?" offer, and the app-switcher cover. The app stays mounted underneath (so it keeps its place) but screen readers cannot reach it.

`userId`: pass `undefined` while sign-in is loading (the cover shows), `null` when signed out (no lock), and the id when signed in. When it changes to another person or to `null`, the previous person's PIN and settings are wiped from the phone.

**Screens**

```tsx
import { Amount, RevealButton, useReveal } from 'app-guard-kit';

<Amount value={245000} format={formatInr} style={styles.big} />   // ••••• until revealed; reads "Amount hidden"
<RevealButton />                                                    // the eye: PIN sheet, then every amount shows
const { revealed, reveal, hide, toggle } = useReveal();
```

**Delete account:** call `guard.clear()` inside the auth kit's `eraseData`, so the Keychain is wiped too. `guard.hide()` hides amounts at any time.

**`reconfirm`** is the app's own small function around the auth kit: Apple and Google sign the person in again with their sheet; email accounts ask for the password. It resolves `true` when the account was confirmed and `false` when cancelled. (A ready-made `reconfirm` inside app-auth-kit would remove this app code; see [Known limits](#known-limits).)

**Wording and look:** `createGuardKit({ strings: { lockTitle: 'PAL is locked' } })`, and `theme`, `brand` (`logo`, `backdrop`, and since 1.1.0 `logoAtTop: true` to pin the logo at the top of every guard screen, including the show-amounts sheet; since 1.2.0 `offerAsPage: true` to show the Face ID offer as a page with a switch instead of a pop-up; since 1.3.0 `contentUnderLogo: true`, with `logoAtTop`, to start the PIN right under the logo instead of centring it) and `components` (`Text`, for the app's fonts) on `GuardProvider`.

## Settings

The kit gives a **Security page** to drop into app-settings-kit's `extraPages`:

```tsx
import { securityPage } from 'app-guard-kit/settings';

<AppSettings … extraPages={[securityPage({ tint: '#A87A2E' })]} />
```

- Face ID: on / off (shown when the phone has Face ID or Touch ID)
- Change PIN (current PIN, new PIN, new PIN again)
- Lock after: Immediately / 30 s / 1 min / 5 min
- Hide amounts after: 30 s / 1 min / 2 min / 5 min
- App lock on / off (only when `requirePin` is off; turning it off needs the PIN)

It is built from app-account-kit's `SettingRow` and `PickerRow`, so it looks like the rest of Settings. It must be inside `GuardProvider`, which it is when the provider wraps the app.

## Expo and Firebase fit

- **Expo:** only Expo modules (`expo-local-authentication`, `expo-secure-store`, `expo-crypto`, `@expo/vector-icons`). The Face ID wording goes in `app.json` through the two config plugins (`faceIDPermission`). No hand-edited `ios/` or `android/`.
- **Firebase:** the lock uses no Firebase at all.
- **Sentry (core kit):** errors are reported through `onError` as `guard.<step>` (for example `guard.readPin`), never with PIN digits, counts or amounts. A cancelled Face ID is not an error.
- **Delete account (auth kit):** the app's `eraseData` should call `guard.clear()`, so the Keychain is wiped too.

## Rules it follows

- The PIN is never stored in plain text, never logged, never sent anywhere.
- Keychain items are "this device only": not in backups, not moved to a new phone.
- The cover shows **before** any app content on cold start (while sign-in and the Keychain load), so nothing flashes.
- Amounts start hidden on every launch and hide on every trip to the background or the app switcher.
- A wrong PIN and a cancelled Face ID never sign the person out by themselves.
- Every word can be reworded through `strings`, like the other kits.
- No movement other than a fade, so Reduce Motion is respected; text follows Dynamic Type (the keypad digits up to 1.4×).

## Kit rules

- **The kit tags itself.** Raise `version` in `package.json` and `KIT_VERSION` (a test checks they match) inside the pull request and add a CHANGELOG note. Merging creates tag `v<version>` through the `version-tag` workflow, which refuses a pull request whose version is not higher than the latest tag. Never tag by hand.
- **Nothing app-specific** in the kit. Logo, colours and wording come from the app.
- **Commit and push only when the owner says so.**

### Folder layout

```
src/
  createGuardKit.ts   options and the kit object
  controller.ts       the whole lock as plain logic: PIN, Face ID, waits, grace, idle hide, sign-out wipe
  GuardProvider.tsx   draws the lock screen, PIN setup, Face ID offer and app-switcher cover; idle touches
  reveal.tsx          Amount, RevealButton, useReveal
  SecurityPage.tsx    the Settings page (entry: app-guard-kit/settings)
  ui/                 PIN pad and screens
  logic/              PIN hash (PBKDF2-SHA-256), obvious-PIN rules, wrong-try limits, options
  modules.ts          the Expo modules, swappable in tests
  strings.ts theme.ts kit.ts
tests/                vitest, with stand-ins for the Expo modules and React Native
```

`npm run typecheck` and `npm test` (84 tests) run in CI on every pull request.

## Build plan

| Step | What | State |
|---|---|---|
| 1 | Repo setup: package.json, TypeScript, vitest, `version-tag` and `ci` workflows, licence | Done |
| 2 | PIN: hash, check, change, clear, wrong-try limits | Done, tested |
| 3 | Face ID with PIN fallback | Done, tested with stand-ins. **Needs a check on a real iPhone** (development build) |
| 4 | `GuardProvider`: lock on start and on return, grace time, app-switcher cover | Done, tested. **Needs a check on a real iPhone** that nothing flashes |
| 5 | Hidden amounts: `Amount`, `RevealButton`, `useReveal`, idle timer, hide on background | Done, tested |
| 6 | Forgot PIN (option A: sign in again) | Done in the kit; the app supplies `reconfirm` |
| 7 | Security page for app-settings-kit | Done |
| 8 | Release v1.0.0 and pin it in PAL | Merging the pull request tags v1.0.0 |

## Decisions

Decided by the owner on 2026-11-16, and the kit's defaults:

1. PIN length: **4 digits** (apps may choose 6).
2. Forgot PIN: **sign in again** with the account (no email OTP).
3. Amounts hide after **60 s** with no touch.
4. Re-lock **immediately** when the app comes back (grace 0 s).
5. Reveal amounts with the **PIN only** (`revealWith: 'pin-or-biometric'` exists for other apps).
6. Wrong PINs: **5 free, then 30 s, 1 min, 5 min, 15 min; sign in again after 10.** Nothing is erased.
7. Screenshots **allowed** while amounts show (blocking is opt-in).
8. **Obvious PINs are rejected.**

## Known limits

- **Modals the app itself opens** (React Native `Modal`) draw above the lock screen. Close them when the app goes to the background, or keep amounts inside them as `<Amount>` (which hide on their own).
- The wrong-try wait can be shortened by moving the phone's clock forward (see [PIN](#pin)); the sign-in-again limit still holds.
- `reconfirm` is written in the app for now. Adding a `reconfirm()` to app-auth-kit (Apple, Google, or a password prompt for email accounts) would let every app pass `authKit.reconfirm` instead.
- iOS only has been designed for. Android should work with the same Expo modules but is untested.

## License

MIT
