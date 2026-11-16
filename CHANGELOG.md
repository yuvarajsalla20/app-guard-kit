# Changelog

Upgrade notes for app-guard-kit, newest first. Each version is tagged in git (`v1.0.0`).

## 1.2.0

Adds opt-in `brand.offerAsPage` on `GuardProvider`. With it, the "Unlock with Face ID?" offer after a new PIN is a full guard screen instead of a pop-up card: an "Unlock with Face ID" switch (on by default), a line saying where to change it later ("Face ID is on. You can change this in Settings > Security."), and Continue. New strings: `offerSwitch`, `offerOnNote`, `offerOffNote`, `offerContinue`. Apps that don't set it keep the pop-up card, so no update is needed.

## 1.1.0

Adds opt-in `brand.logoAtTop` on `GuardProvider`. With it, the app's logo sits at the top of every guard screen, centred, and the PIN pad is centred below it. That covers the lock screen, PIN setup, the show-amounts sheet and Change PIN, which used to show a plain lock tile. The app-switcher cover keeps the logo in the middle. Apps that don't set it see no change, so no update is needed.

## 1.0.0

First release. App lock with Face ID / Touch ID and a PIN fallback, PIN setup, change and Forgot PIN (sign in again through the app's `reconfirm`), wrong-PIN waits (5 free, then 30 s, 1, 5, 15 min; sign in again after 10), hidden amounts (`Amount`, `RevealButton`, `useReveal`) that hide after 60 s idle and on leaving the app, an app-switcher cover, and a Security page for app-settings-kit (`app-guard-kit/settings`). The PIN is kept on the phone only, as a salted PBKDF2-SHA-256 hash in the Keychain ("this device only").
