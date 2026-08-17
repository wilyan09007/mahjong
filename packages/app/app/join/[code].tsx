import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useGameStore } from '../../src/state/store';
import { joinRoom } from '../../src/net/connection';
import { getDeviceId, getDisplayName } from '../../src/net/deviceId';
import { isCompleteCode, normaliseCode } from '../../src/state/codeInput';
import { Button } from '../../src/components/Controls';
import { tokens } from '../../src/theme/tokens';
import { strings } from '../../src/strings';

/**
 * Deep-link entry: `mahjong://join/ABC234`.
 *
 * Joins straight through when the device already has an identity. A first
 * launch has no name yet, so it falls back to Home rather than seating someone
 * as "Player" without asking.
 */
export default function JoinByCodeScreen(): React.ReactElement {
  const { code } = useLocalSearchParams<{ code: string }>();
  const setIdentity = useGameStore((s) => s.setIdentity);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const normalised = normaliseCode(code ?? '');
      if (!isCompleteCode(normalised)) {
        setError(strings.invalidCode);
        return;
      }
      const playerId = await getDeviceId();
      const name = await getDisplayName();
      if (!name) {
        // No identity yet — let them choose a name first.
        router.replace('/');
        return;
      }
      setIdentity({ playerId, name });
      try {
        await joinRoom(normalised, playerId, name);
        router.replace('/lobby');
      } catch {
        setError(strings.connectFailed);
      }
    })();
  }, [code, setIdentity]);

  return (
    <View style={styles.screen}>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Button label={strings.joinTable} onPress={() => router.replace('/')} />
        </>
      ) : (
        <Text style={styles.muted}>{strings.reconnecting}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: 'center',
    padding: tokens.space.l,
    gap: tokens.space.m,
    backgroundColor: tokens.color.tableFelt,
  },
  error: { color: tokens.color.danger, fontSize: 16, textAlign: 'center' },
  muted: { color: tokens.color.textMuted, fontSize: 14, textAlign: 'center' },
});
