import React from 'react';
import { Share, StyleSheet, Text, View } from 'react-native';
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

/** The lobby: seats, config, invite, start. Renders `store.lobby` live. */
export default function LobbyScreen(): React.ReactElement {
  const lobby = useGameStore((s) => s.lobby);
  const view = useGameStore((s) => s.view);
  const identity = useGameStore((s) => s.identity);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const dismissError = useGameStore((s) => s.dismissError);

  // The first view means the hand has started — go to the table.
  React.useEffect(() => {
    if (view) router.replace('/table');
  }, [view]);

  const isHost = !!lobby && lobby.hostPlayerId === identity?.playerId;
  const startable = canStart(lobby, identity?.playerId ?? null);

  if (!lobby) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>{strings.reconnecting}</Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.codeLabel}>{strings.roomCode}</Text>
      <Text style={styles.code} accessibilityLabel={`Room code ${lobby.code}`}>
        {lobby.code}
      </Text>

      <Button
        label={strings.invite}
        tone="secondary"
        onPress={() => void Share.share({ message: strings.inviteMessage(lobby.code) })}
        testID="invite"
      />

      <View style={styles.seats}>
        {lobby.seats.map((seat) => (
          <SeatCard
            key={seat.seat}
            seat={seat.seat}
            name={seatLabel(seat)}
            kind={seat.kind}
            connected={seat.connected}
            isHost={lobby.hostPlayerId !== null && seat.kind === 'human'
              && seat.seat === lobby.seats.find((s) => s.kind === 'human')?.seat}
            canEdit={isHost}
            onAddBot={(s: Seat) => send(C2S.fillBot, { seat: s })}
            onRemoveBot={(s: Seat) => send(C2S.removeBot, { seat: s })}
          />
        ))}
      </View>

      {isHost && (
        <View style={styles.configRow}>
          <Text style={styles.muted}>{strings.rounds}</Text>
          {[1, 2, 4].map((rounds) => (
            <Button
              key={rounds}
              label={String(rounds)}
              tone={lobby.config.totalRounds === rounds ? 'primary' : 'secondary'}
              onPress={() => send(C2S.config, { totalRounds: rounds })}
              testID={`rounds-${rounds}`}
            />
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

      <ErrorToast message={errorMessage} onDismiss={dismissError} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    padding: tokens.space.l,
    gap: tokens.space.m,
    backgroundColor: tokens.color.tableFelt,
  },
  codeLabel: { color: tokens.color.textMuted, fontSize: 13, textAlign: 'center' },
  code: {
    color: tokens.color.accentGold,
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 8,
    textAlign: 'center',
  },
  seats: { gap: tokens.space.s },
  configRow: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.s },
  muted: { color: tokens.color.textMuted, fontSize: 14, textAlign: 'center' },
});
