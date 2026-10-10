// src/revenuecat.ts
// RevenueCat configuration for Inkwell's one-time Pro unlock.
//
// FAIL-OPEN HOUSE RULE: while these keys are placeholders — or react-native-purchases
// is not in the running build (e.g. Expo Go) — Pro is treated as UNLOCKED. We never
// lock content without a working way to pay. Gate logic lives in proAccess.ts.
//
// SETUP (Simon): after creating the RevenueCat "Inkwell" project, paste the PUBLIC
// SDK keys below. Then open the RC Entitlements page and confirm ENTITLEMENT_ID matches
// EXACTLY what the wizard created — identifiers are IMMUTABLE (the Billowe capital-`P`
// trap: the wizard auto-created `Pro`, not `pro`). Whatever it created, this constant
// must equal it character-for-character.

// Public SDK keys (safe to ship in the app bundle — these are NOT secret).
export const RC_API_KEY_IOS = 'appl_LsLAucJFFyEEgWiuNynrzgqzoml'; // RC project "Inkwell"
export const RC_API_KEY_ANDROID = 'goog_knkoTtCODvEeaDAZtDRWrLvtkea'; // starts with "goog_"

// The entitlement that grants Pro. CONFIRM on the RC Entitlements page before trusting.
export const ENTITLEMENT_ID = 'pro';

// The App Store / Play non-consumable product id. Must match App Store Connect exactly.
// PRICE: $9.99 one-time (App Store Tier 10) — decided 2026-07-25. If this ever
// changes in ASC, update the hardcoded "$9.99" mentions in SettingsScreen /
// EditorScreen / JournalScreen paywall copy to match (grep for "9.99").
export const PRODUCT_ID = 'inkwell_pro_lifetime';

const PLACEHOLDER_KEYS = new Set([
  'REPLACE_WITH_RC_IOS_KEY',
  'REPLACE_WITH_RC_ANDROID_KEY',
  '',
]);

export function keyForPlatform(os: 'ios' | 'android'): string {
  return os === 'ios' ? RC_API_KEY_IOS : RC_API_KEY_ANDROID;
}

export function isPlaceholderKey(key: string): boolean {
  return PLACEHOLDER_KEYS.has(key.trim());
}
