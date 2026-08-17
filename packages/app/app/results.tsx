import React from 'react';
import {
  ScrollView, StyleSheet, Text, useWindowDimensions, View,
} from 'react-native';
import { router } from 'expo-router';
import { useGameStore } from '../src/state/store';
import { leaveRoom, send } from '../src/net/connection';
import { C2S } from '../src/net/messages';
import { medalFor, rankStandings } from '../src/state/selectors';
import { Button } from '../src/components/Controls';
import { COMPACT_ROW, tokens } from '../src/theme/tokens';
import { strings } from '../src/strings';

/**
 * Session standings, plus play-again.
 *
 * Landscape puts the standings beside the actions. Stacked vertically, a title,
 * four rows, the stakes line and two buttons need ~470px — on a ~360px
 * landscape phone that clipped the FIRST-PLACE row off the top, so the one
 * thing this screen exists to say (who won) was the one thing you could not
 * read, and put "Leave table" off the bottom with no way to reach it.
 */
export default function ResultsScreen(): React.ReactElement {
  const standings = useGameStore((s) => s.standings);
  const lobby = useGameStore((s) => s.lobby);
  const identity = useGameStore((s) => s.identity);
  const { width, height } = useWindowDimensions();

  const landscape = width > height;
  const isHost = !!lobby && lobby.hostPlayerId === identity?.playerId;
  const ranked = rankStandings(standings ?? []);

  const board = (
    <View style={styles.board}>
      <Text style={[styles.title, landscape && styles.titleCompact]}>
        {strings.sessionComplete}
      </Text>
      {ranked.map((row) => (
        <View key={row.seat} style={[styles.row, landscape && styles.rowCompact]}>
          <Text style={styles.medal}>{medalFor(row.place)}</Text>
          <Text style={styles.name} numberOfLines={1}>{row.name}</Text>
          <Text style={[styles.score, row.score < 0 && styles.scoreNegative]}>
            {row.score > 0 ? `+${row.score}` : row.score}
          </Text>
        </View>
      ))}
    </View>
  );

  const actions = (
    <View style={styles.actions}>
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

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={landscape ? styles.columns : styles.rows}>
          {board}
          {actions}
        </View>
      </ScrollView>
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
  columns: { flexDirection: 'row', gap: tokens.space.l, alignItems: 'center' },
  rows: { gap: tokens.space.m },
  board: { flex: 1.4, gap: tokens.space.xs },
  actions: { flex: 1, gap: tokens.space.s },
  title: {
    color: tokens.color.accentGold, fontSize: 28, fontWeight: '800', textAlign: 'center',
  },
  titleCompact: { fontSize: 20, marginBottom: tokens.space.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: tokens.space.m,
    backgroundColor: tokens.color.surfaceRaised,
    borderRadius: tokens.radius.m,
    padding: tokens.space.m,
  },
  rowCompact: {
    paddingVertical: tokens.space.xs,
    paddingHorizontal: tokens.space.s,
    minHeight: COMPACT_ROW.standing,
    gap: tokens.space.s,
  },
  medal: { fontSize: 22, width: 32 },
  name: { flex: 1, color: tokens.color.textOnFelt, fontSize: 18 },
  score: { color: tokens.color.accentGold, fontSize: 20, fontWeight: '700' },
  scoreNegative: { color: tokens.color.danger },
  muted: { color: tokens.color.textMuted, fontSize: 13, textAlign: 'center' },
});
