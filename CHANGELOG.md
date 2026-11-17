# Changelog

Upgrade notes for app-guard-kit, newest first. Each version is tagged in git (`v1.0.0`).

## 1.4.0

Speed. Nothing to change in an app; screens look the same. Saved PINs keep working (same hash format and bytes).

- **No freeze while a PIN is checked.** PBKDF2 (10,000 rounds) now runs in short slices with a pause between them, so the lock screen keeps drawing and taking touches. The rounds also run on 32-bit words with no per-round allocation (about 20% faster in an interpreter).
- Optional `modules.pbkdf2` in `createGuardKit`: an app may pass a native PBKDF2-HMAC-SHA-256 (e.g. react-native-quick-crypto) for even faster checks. Left out, the kit uses its own.
- `checkPinAsync`, `hashPinAsync`, `pbkdf2Sha256Async` added; `checkPin` / `hashPin` stay.
- **Fewer redraws.** The controller no longer notifies when a change changes nothing (app switches sent several). `Amount` and `useReveal` now follow only whether amounts show (`useGuardRevealed`, exported), not every lock-state change.
- `GuardProvider` compares the contents of `theme`, `brand` and `components`, so apps passing them inline no longer redraw every amount on each render.

## 1.3.0

Adds opt-in `brand.contentUnderLogo` on `GuardProvider`, used with `logoAtTop`. With it, the title, PIN dots and pad start right under the pinned logo instead of being centred in the space below it, so tall phones don't show a big gap between the logo and the PIN. Apps that don't set it see no change, so no update is needed.

Fix for the `offerAsPage` screen (1.2.0): the "Unlock with Face ID" switch row is now centred (it sat to the left on wide screens), and Continue is a compact centred pill instead of a full-width bar.

## 1.2.0

Adds opt-in `brand.offerAsPage` on `GuardProvider`. With it, the "Unlock with Face ID?" offer after a new PIN is a full guard screen instead of a pop-up card: an "Unlock with Face ID" switch (on by default), a line saying where to change it later ("Face ID is on. You can change this in Settings > Security."), and Continue. New strings: `offerSwitch`, `offerOnNote`, `offerOffNote`, `offerContinue`. Apps that don't set it keep the pop-up card, so no update is needed.

## 1.1.0

Adds opt-in `brand.logoAtTop` on `GuardProvider`. With it, the app's logo sits at the top of every guard screen, centred, and the PIN pad is centred below it. That covers the lock screen, PIN setup, the show-amounts sheet and Change PIN, which used to show a plain lock tile. The app-switcher cover keeps the logo in the middle. Apps that don't set it see no change, so no update is needed.

## 1.0.0

First release. App lock with Face ID / Touch ID and a PIN fallback, PIN setup, change and Forgot PIN (sign in again through the app's `reconfirm`), wrong-PIN waits (5 free, then 30 s, 1, 5, 15 min; sign in again after 10), hidden amounts (`Amount`, `RevealButton`, `useReveal`) that hide after 60 s idle and on leaving the app, an app-switcher cover, and a Security page for app-settings-kit (`app-guard-kit/settings`). The PIN is kept on the phone only, as a salted PBKDF2-SHA-256 hash in the Keychain ("this device only").
