# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Inkwell

Local-first private journal. Text + photos + calendar. Everything lives in
SQLite on device (photos as files in the app sandbox); there is no server,
no account, no analytics. Privacy is the brand — never add a network call.

House rules (shared with Dreamfeed/Invoicer):
- `src/dbCore.ts` and `src/backupFormat.ts` are pure modules (no expo imports, Node-testable).
- PRAGMA user_version migrations, append-only. Integer epoch-ms everywhere.
- Fail-open Pro: if react-native-purchases is missing or RC keys are placeholders, Pro is unlocked.
- Journaling itself is free forever. Pro (one-time unlock) gates extras only
  (currently: more than one photo per entry).
- Export/backup of the user's own data is NEVER gated.
- `expo-file-system/legacy` imports per house convention.
