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
          headerStyle: { backgroundColor: tokens.color.surface },
          headerTintColor: tokens.color.textOnFelt,
          contentStyle: { backgroundColor: tokens.color.tableFelt },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'Mahjong' }} />
        <Stack.Screen name="lobby" options={{ title: 'Table' }} />
        <Stack.Screen name="table" options={{ headerShown: false }} />
        <Stack.Screen name="results" options={{ title: 'Results' }} />
      </Stack>
    </>
  );
}
