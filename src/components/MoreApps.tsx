// src/components/MoreApps.tsx
// The "More from Simon Shih" section at the foot of Settings. Three sibling
// apps, each opening its App Store page. Lives in its own file so Settings
// does not grow (see issue #3) and so the whole feature copies to another repo
// as two files plus one line.
//
// No network, no tracking, no fetch of any kind. The list is static data from
// moreApps.ts, which keeps the privacy promise in AGENTS.md intact.

import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Palette, ThemeFonts, useTheme } from '../theme';
import { FleetApp, relatedApps, storeUrl } from '../moreApps';

export default function MoreApps() {
  const { colors: c, fonts } = useTheme();
  const styles = useMemo(() => makeStyles(c, fonts), [c, fonts]);
  const apps = useMemo(() => relatedApps(), []);

  if (apps.length === 0) return null;

  const open = (app: FleetApp) => {
    // openURL rejects when nothing can handle the scheme. There is nothing
    // useful to tell the user in that case, so swallow it rather than throw.
    Linking.openURL(storeUrl(app)).catch(() => {});
  };

  return (
    <>
      <Text style={styles.sectionTitle}>More from Simon Shih</Text>
      <View style={styles.card}>
        {apps.map((app, i) => (
          <React.Fragment key={app.key}>
            {i > 0 ? <View style={styles.hairline} /> : null}
            <Pressable
              onPress={() => open(app)}
              hitSlop={6}
              accessibilityRole="link"
              accessibilityLabel={`${app.name}, ${app.line}. Opens the App Store.`}
            >
              <Text style={styles.appName}>{app.name}</Text>
              <Text style={styles.appLine}>{app.line}</Text>
            </Pressable>
          </React.Fragment>
        ))}
      </View>
    </>
  );
}

const makeStyles = (c: Palette, f: ThemeFonts) =>
  StyleSheet.create({
    sectionTitle: {
      fontFamily: f.title,
      color: c.textPrimary,
      fontSize: 17,
      marginTop: 18,
      marginBottom: 8,
    },
    card: {
      backgroundColor: c.card,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderRadius: 12,
      padding: 14,
      gap: 12,
    },
    hairline: { height: StyleSheet.hairlineWidth, backgroundColor: c.hairline },
    appName: { color: c.accent, fontSize: 15 },
    appLine: { color: c.textMuted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  });
