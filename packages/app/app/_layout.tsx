import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts, NotoSerifTC_700Bold } from '@expo-google-fonts/noto-serif-tc';
import { useGameStore } from '../src/state/store';
import { getDeviceId, getDisplayName } from '../src/net/deviceId';
import { tokens } from '../src/theme/tokens';

void SplashScreen.preventAutoHideAsync();

/**
 * Root layout: hold the splash until the CJK face is loaded, because every tile
 * glyph is drawn with it — showing the table with fallback glyphs first would
 * flash the wrong artwork across all 42 faces.
 *
 * No screen shows a navigation header. On the target device — a phone in
 * landscape, ~360px tall — the stack header costs 64px, 18% of the screen, and
 * it buys nothing: Home is the root, and Lobby and Results both have an
 * explicit "Leave table". With the header on, the Results screen clipped the
 * first-place row off the top and "Leave table" off the bottom entirely.
 */
export default function RootLayout(): React.ReactElement | null {
  const [fontsLoaded] = useFonts({ NotoSerifTC_700Bold });
  const setIdentity = useGameStore((s) => s.setIdentity);

  useEffect(() => {
    void (async () => {
      const playerId = await getDeviceId();
      const name = (await getDisplayName()) ?? '';
      setIdentity({ playerId, name });
    })();
  }, [setIdentity]);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return null;

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.color.tableFelt },
        }}
      />
    </>
  );
}
