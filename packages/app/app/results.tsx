import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../src/state/store';
import { leaveRoom, send } from '../src/net/connection';
import { C2S } from '../src/net/messages';
import { medalFor, rankStandings } from '../src/state/selectors';
import { Button } from '../src/components/Controls';
import { tokens } from '../src/theme/tokens';
import { strings } from '../src/strings';

/** Session standings, plus play-again. */
export default function ResultsScreen(): React.ReactElement {
  const standings = useGameStore((s) => s.standings);
  const lobby = useGameStore((s) => s.lobby);
  const identity = useGameStore((s) => s.identity);

  const isHost = !!lobby && lobby.hostPlayerId === identity?.playerId;
  const ranked = rankStandings(standings ?? []);

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>{strings.sessionComplete}</Text>

      {ranked.map((row) => (
        <View key={row.seat} style={styles.row}>
          <Text style={styles.medal}>{medalFor(row.place)}</Text>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <Text style={[styles.score, row.score < 0 && styles.scoreNegative]}>
            {row.score > 0 ? `+${row.score}` : row.score}
          </Text>
        </View>
      ))}

      {lobby && (
        <Text style={styles.muted}>
          {`${lobby.config.totalRounds} × ${lobby.config.base}底 ${lobby.config.perTai}台`}
        </Text>
      )}

      {isHost ? (
        <Button
          label={strings.playAgain}
          onPress={() => {
            send(C2S.start, {});
            router.replace('/lobby');
          }}
          testID="play-again"
        />
      ) : (
        <Button
          label={strings.lobby}
          tone="secondary"
          onPress={() => router.replace('/lobby')}
        />
      )}

      <Button
        label={strings.leave}
        tone="danger"
        onPress={() => void leaveRoom().then(() => router.replace('/'))}
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
    color: tokens.color.accentGold, fontSize: 28, fontWeight: '800', textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.m,
    backgroundColor: tokens.color.surfaceRaised,
    borderRadius: tokens.radius.m,
    padding: tokens.space.m,
  },
  medal: { fontSize: 22, width: 32 },
  name: { flex: 1, color: tokens.color.textOnFelt, fontSize: 18 },
  score: { color: tokens.color.accentGold, fontSize: 20, fontWeight: '700' },
  scoreNegative: { color: tokens.color.danger },
  muted: { color: tokens.color.textMuted, fontSize: 13, textAlign: 'center' },
});
