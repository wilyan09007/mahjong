import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../src/state/store';
import { createRoom, joinRoom } from '../src/net/connection';
import { setDisplayName } from '../src/net/deviceId';
import { normaliseCode, isCompleteCode } from '../src/state/codeInput';
import { Button, ErrorToast } from '../src/components/Controls';
import { tokens } from '../src/theme/tokens';
import { strings } from '../src/strings';

/** Home: pick a name, then create a table or join one by code. */
export default function HomeScreen(): React.ReactElement {
  const identity = useGameStore((s) => s.identity);
  const connection = useGameStore((s) => s.connection);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const dismissError = useGameStore((s) => s.dismissError);
  const setIdentity = useGameStore((s) => s.setIdentity);

  const [name, setName] = useState(identity?.name ?? '');
  const [code, setCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const busy = connection === 'connecting';
  const trimmedName = name.trim() || 'Player';

  async function persistName(): Promise<{ playerId: string; name: string }> {
    await setDisplayName(trimmedName);
    const next = { playerId: identity?.playerId ?? '', name: trimmedName };
    setIdentity(next);
    return next;
  }

  async function onCreate(): Promise<void> {
    setLocalError(null);
    const me = await persistName();
    try {
      await createRoom(me.playerId, me.name);
      router.push('/lobby');
    } catch {
      setLocalError(strings.connectFailed);
    }
  }

  async function onJoin(): Promise<void> {
    setLocalError(null);
    if (!isCompleteCode(code)) {
      setLocalError(strings.invalidCode);
      return;
    }
    const me = await persistName();
    try {
      await joinRoom(code, me.playerId, me.name);
      router.push('/lobby');
    } catch {
      setLocalError(strings.connectFailed);
    }
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{strings.appName}</Text>

      <Text style={styles.label}>{strings.yourName}</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder={strings.namePlaceholder}
        placeholderTextColor={tokens.color.textMuted}
        maxLength={16}
        accessibilityLabel={strings.yourName}
      />

      <Button
        label={strings.createTable}
        onPress={() => void onCreate()}
        disabled={busy}
        testID="create-table"
      />

      <View style={styles.divider} />

      <Text style={styles.label}>{strings.joinTable}</Text>
      <TextInput
        style={[styles.input, styles.codeInput]}
        value={code}
        onChangeText={(t) => setCode(normaliseCode(t))}
        placeholder={strings.codePlaceholder}
        placeholderTextColor={tokens.color.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        accessibilityLabel={strings.joinTable}
      />
      <Text style={styles.hint}>{strings.codeHint}</Text>
      <Button
        label={strings.joinTable}
        tone="secondary"
        onPress={() => void onJoin()}
        disabled={busy}
        testID="join-table"
      />

      <ErrorToast
        message={localError ?? errorMessage}
        onDismiss={() => {
          setLocalError(null);
          dismissError();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: tokens.space.l,
    gap: tokens.space.m,
    justifyContent: 'center',
    backgroundColor: tokens.color.tableFelt,
  },
  title: {
    color: tokens.color.accentGold,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: tokens.space.l,
  },
  label: { color: tokens.color.textOnFelt, fontSize: 15 },
  input: {
    backgroundColor: tokens.color.surfaceRaised,
    color: tokens.color.textOnFelt,
    borderRadius: tokens.radius.m,
    paddingHorizontal: tokens.space.m,
    minHeight: tokens.hitSlop + 12,
    fontSize: 18,
  },
  codeInput: { letterSpacing: 6, textAlign: 'center', fontSize: 24 },
  hint: { color: tokens.color.textMuted, fontSize: 12 },
  divider: {
    height: 1,
    backgroundColor: tokens.color.tableFeltEdge,
    marginVertical: tokens.space.m,
  },
});
