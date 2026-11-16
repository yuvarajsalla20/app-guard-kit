# Changelog

Upgrade notes for app-guard-kit, newest first. Each version is tagged in git (`v1.0.0`).

## 1.0.0

First release. App lock with Face ID / Touch ID and a PIN fallback, PIN setup, change and Forgot PIN (sign in again through the app's `reconfirm`), wrong-PIN waits (5 free, then 30 s, 1, 5, 15 min; sign in again after 10), hidden amounts (`Amount`, `RevealButton`, `useReveal`) that hide after 60 s idle and on leaving the app, an app-switcher cover, and a Security page for app-settings-kit (`app-guard-kit/settings`). The PIN is kept on the phone only, as a salted PBKDF2-SHA-256 hash in the Keychain ("this device only").
