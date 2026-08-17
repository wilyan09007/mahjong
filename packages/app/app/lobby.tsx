import React from 'react';
import {
  ScrollView, Share, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
import type { Seat } from '@mahjong/engine';
import { useGameStore } from '../src/state/store';
import { send, leaveRoom } from '../src/net/connection';
import { C2S } from '../src/net/messages';
import { canStart, seatLabel } from '../src/state/selectors';
import { SeatCard } from '../src/components/Board';
import { Button, ErrorToast } from '../src/components/Controls';
import { tokens } from '../src/theme/tokens';
import { strings } from '../src/strings';

/**
 * The lobby: seats, config, invite, start. Renders `store.lobby` live.
 *
 * Landscape puts the table controls beside the seats rather than above them.
 * Stacked vertically, the four seat cards alone fill a phone's landscape height
 * and push Start and Leave off the bottom — the game becomes unstartable.
 */
export default function LobbyScreen(): React.ReactElement {
  const lobby = useGameStore((s) => s.lobby);
  const view = useGameStore((s) => s.view);
  const identity = useGameStore((s) => s.identity);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const dismissError = useGameStore((s) => s.dismissError);
  const { width, height } = useWindowDimensions();

  // The first view means the hand has started — go to the table.
  React.useEffect(() => {
    if (view) router.replace('/table');
  }, [view]);

  const landscape = width > height;
  const isHost = !!lobby && lobby.hostPlayerId === identity?.playerId;
  const startable = canStart(lobby, identity?.playerId ?? null);

  if (!lobby) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>{strings.reconnecting}</Text>
      </View>
    );
  }

  // Mirrors the server's own rule (first connected human takes the host role),
  // because `SeatPublic` deliberately carries no playerId to identify them by.
  const hostSeat = lobby.seats.find((s) => s.kind === 'human' && s.connected)?.seat;

  const controls = (
    <View style={styles.controlsColumn}>
      <Text style={styles.codeLabel}>{strings.roomCode}</Text>
      <Text
        style={[styles.code, landscape && styles.codeCompact]}
        accessibilityLabel={`Room code ${lobby.code}`}
      >
        {lobby.code}
      </Text>

      <Button
        label={strings.invite}
        tone="secondary"
        onPress={() => void Share.share({ message: strings.inviteMessage(lobby.code) })}
        testID="invite"
      />

      {isHost && (
        <View style={styles.configRow}>
          <Text style={styles.muted}>{strings.rounds}</Text>
          {[1, 2, 4].map((rounds) => (
            <View key={rounds} style={styles.roundButton}>
              <Button
                label={String(rounds)}
                tone={lobby.config.totalRounds === rounds ? 'primary' : 'secondary'}
                onPress={() => send(C2S.config, { totalRounds: rounds })}
                testID={`rounds-${rounds}`}
              />
            </View>
          ))}
        </View>
      )}

      {isHost ? (
        <Button
          label={strings.start}
          onPress={() => send(C2S.start, {})}
          disabled={!startable.ok}
          testID="start"
        />
      ) : (
        <Text style={styles.muted}>{strings.waitingForHost}</Text>
      )}
      {!startable.ok && isHost && <Text style={styles.muted}>{startable.reason}</Text>}

      <Button
        label={strings.leave}
        tone="danger"
        onPress={() => void leaveRoom().then(() => router.replace('/'))}
      />
    </View>
  );

  const seats = (
    <View style={styles.seats}>
      {lobby.seats.map((seat) => (
        <SeatCard
          key={seat.seat}
          seat={seat.seat}
          name={seatLabel(seat)}
          kind={seat.kind}
          connected={seat.connected}
          isHost={seat.seat === hostSeat}
          canEdit={isHost}
          compact={landscape}
          onAddBot={(s: Seat) => send(C2S.fillBot, { seat: s })}
          onRemoveBot={(s: Seat) => send(C2S.removeBot, { seat: s })}
        />
      ))}
    </View>
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={landscape ? styles.columns : styles.rows}>
          {controls}
          {seats}
        </View>
      </ScrollView>
      <ErrorToast message={errorMessage} onDismiss={dismissError} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.tableFelt },
  content: {
    flexGrow: 1,
    paddingHorizontal: tokens.space.m,
    paddingVertical: tokens.space.s,
    justifyContent: 'center',
  },
  columns: { flexDirection: 'row', gap: tokens.space.l, alignItems: 'flex-start' },
  rows: { gap: tokens.space.m },
  controlsColumn: { flex: 1, gap: 6 },
  seats: { flex: 1, gap: tokens.space.s },
  codeLabel: { color: tokens.color.textMuted, fontSize: 13, textAlign: 'center' },
  code: {
    color: tokens.color.accentGold,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  codeCompact: { fontSize: 30, letterSpacing: 5 },
  configRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.s },
  roundButton: { flex: 1 },
  muted: { color: tokens.color.textMuted, fontSize: 13, textAlign: 'center' },
});
