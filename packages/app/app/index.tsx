import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../src/state/store';
import { classifyJoinFailure, createRoom, joinRoom } from '../src/net/connection';
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
  const { width, height } = useWindowDimensions();

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
    } catch (failure) {
      setLocalError(strings.joinFailed[classifyJoinFailure(failure)]);
    }
  }

  // Landscape is short and wide: stack the two paths side by side rather than
  // vertically, or the Join button falls off the bottom of the screen. The
  // ScrollView is the safety net for anything shorter still.
  const landscape = width > height;

  const createSection = (
    <View style={styles.section}>
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
    </View>
  );

  const joinSection = (
    <View style={styles.section}>
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
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, landscape && styles.titleCompact]}>
          {strings.appName}
        </Text>
        <View style={landscape ? styles.columns : styles.rows}>
          {createSection}
          {landscape ? <View style={styles.columnDivider} /> : <View style={styles.divider} />}
          {joinSection}
        </View>
      </ScrollView>

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
  screen: { flex: 1, backgroundColor: tokens.color.tableFelt },
  content: {
    flexGrow: 1,
    padding: tokens.space.l,
    gap: tokens.space.m,
    justifyContent: 'center',
  },
  // Side by side in landscape, stacked in portrait.
  columns: { flexDirection: 'row', gap: tokens.space.l, alignItems: 'flex-start' },
  rows: { gap: tokens.space.m },
  section: { flex: 1, gap: tokens.space.s },
  columnDivider: { width: 1, alignSelf: 'stretch', backgroundColor: tokens.color.tableFeltEdge },
  title: {
    color: tokens.color.accentGold,
    fontSize: 32,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: tokens.space.l,
  },
  titleCompact: { fontSize: 24, marginBottom: tokens.space.s },
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
