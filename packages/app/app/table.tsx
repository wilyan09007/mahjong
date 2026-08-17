import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import type { Action, Seat, TileKind } from '@mahjong/engine';
import { useGameStore } from '../src/state/store';
import { playAction, send } from '../src/net/connection';
import { C2S } from '../src/net/messages';
import { actionBarModel, formatResult } from '../src/state/selectors';
import { edgeFor } from '../src/state/tableLayout';
import {
  CenterInfo, DiscardPond, HandRow, MeldGroup, OpponentPanel, pondColumns,
} from '../src/components/Board';
import { ActionBar, Button, EmotePicker, ErrorToast } from '../src/components/Controls';
import { Tile } from '../src/tiles/Tile';
import { TABLE_ZONES, tokens } from '../src/theme/tokens';
import { strings } from '../src/strings';

/**
 * The table. Landscape-locked while focused.
 *
 * Everything rendered here comes from `store.view`, which only the server
 * writes. The screen holds exactly one piece of local state — which tile is
 * selected — because that is a UI intention, not game state.
 */
export default function TableScreen(): React.ReactElement {
  const view = useGameStore((s) => s.view);
  const lobby = useGameStore((s) => s.lobby);
  const seatStatus = useGameStore((s) => s.seatStatus);
  const handResult = useGameStore((s) => s.lastHandResult);
  const standings = useGameStore((s) => s.standings);
  const pendingAction = useGameStore((s) => s.pendingAction);
  const emotes = useGameStore((s) => s.emotes);
  const errorMessage = useGameStore((s) => s.errorMessage);
  const dismissError = useGameStore((s) => s.dismissError);
  const clearHandResult = useGameStore((s) => s.clearHandResult);

  const [selectedTile, setSelectedTile] = useState<TileKind | null>(null);
  const { width } = useWindowDimensions();

  useEffect(() => {
    // Orientation lock does not exist on web and is unavailable on some
    // devices. The table is perfectly playable either way, so a failure here is
    // swallowed rather than surfaced as an unhandled rejection.
    const lock = (orientation: ScreenOrientation.OrientationLock): void => {
      void ScreenOrientation.lockAsync(orientation).catch(() => undefined);
    };
    lock(ScreenOrientation.OrientationLock.LANDSCAPE);
    return () => lock(ScreenOrientation.OrientationLock.PORTRAIT_UP);
  }, []);

  // A new view means a new position: whatever was selected is stale.
  useEffect(() => { setSelectedTile(null); }, [view?.turn, view?.phase]);

  useEffect(() => { if (standings) router.replace('/results'); }, [standings]);

  const seatNames = useMemo(() => {
    const names: Record<number, string> = {};
    for (const seat of lobby?.seats ?? []) names[seat.seat] = seat.name ?? `Seat ${seat.seat + 1}`;
    return names;
  }, [lobby]);

  // Enough columns that all four ponds stay side by side at this width.
  const perRow = pondColumns(width);

  const model = useMemo(
    () => actionBarModel(view ?? null, selectedTile),
    [view, selectedTile],
  );

  if (!view) {
    return (
      <View style={styles.screen}>
        <Text style={styles.muted}>{strings.reconnecting}</Text>
      </View>
    );
  }

  const dispatch = (action: Action): void => {
    setSelectedTile(null);
    playAction(action);
  };

  return (
    <View style={styles.screen}>
      {/* The playing surface. The screen itself is the darker rim all four
          players sit at; this is the felt the wall and the ponds rest on.
          Purely decorative, so it takes no touches. */}
      <View style={styles.surface} pointerEvents="none" />

      {/* Opponents around the edges */}
      <View style={styles.topRow}>
        {view.opponents
          .filter((o) => edgeFor(view.seat, o.seat) === 'top')
          .map((o) => (
            <OpponentPanel
              key={o.seat}
              opponent={o}
              edge="top"
              isTurn={view.turn === o.seat}
              connected={seatStatus[o.seat] ?? true}
              name={seatNames[o.seat] ?? `Seat ${o.seat + 1}`}
            />
          ))}
      </View>

      <View style={styles.middleRow}>
        <View style={styles.sideColumn}>
          {view.opponents
            .filter((o) => edgeFor(view.seat, o.seat) === 'left')
            .map((o) => (
              <OpponentPanel
                key={o.seat}
                opponent={o}
                edge="left"
                isTurn={view.turn === o.seat}
                connected={seatStatus[o.seat] ?? true}
                name={seatNames[o.seat] ?? `Seat ${o.seat + 1}`}
              />
            ))}
        </View>

        <View style={styles.centerColumn}>
          <CenterInfo view={view} seatNames={seatNames} />
          {/* Four ponds side by side rather than a scrolling stack — the whole
              point of the pond is being able to glance at what has been
              thrown, which a scroll view defeats. */}
          <View style={styles.ponds}>
            <DiscardPond tiles={view.discards} highlightLast perRow={perRow} />
            {view.opponents.map((o) => (
              <DiscardPond key={o.seat} tiles={o.discards} perRow={perRow} />
            ))}
          </View>
        </View>

        <View style={styles.sideColumn}>
          {view.opponents
            .filter((o) => edgeFor(view.seat, o.seat) === 'right')
            .map((o) => (
              <OpponentPanel
                key={o.seat}
                opponent={o}
                edge="right"
                isTurn={view.turn === o.seat}
                connected={seatStatus[o.seat] ?? true}
                name={seatNames[o.seat] ?? `Seat ${o.seat + 1}`}
              />
            ))}
        </View>
      </View>

      {/* Me */}
      <View style={styles.bottom}>
        <HandRow
          tiles={view.hand}
          selectedTile={selectedTile}
          onSelect={setSelectedTile}
          onDiscard={(tile) => {
            const discard = view.legalActions.find(
              (a) => a.type === 'discard' && a.tile === tile,
            );
            if (discard) dispatch(discard);
          }}
          disabled={pendingAction}
        />
        {/* The strip under the hand: my melds and flowers in the left corner,
            emotes in the right. That band was empty felt, and melds sitting
            above the hand competed with the tiles I am actually choosing
            between. */}
        <View style={styles.bottomStrip}>
          <View style={styles.myMelds}>
            <MeldGroup melds={view.melds} size="mini" />
            {view.flowers.map((f, i) => <Tile key={`${f}-${i}`} tile={f} size="mini" />)}
          </View>
          <EmotePicker
            onSend={(emote) => send(C2S.emote, { emote })}
            disabled={pendingAction}
          />
        </View>
      </View>

      {/* Actions stack up the right-hand side, directly above the hand. They
          used to sit centred under it, where they shared a line with the emote
          row and the two overlapped. `box-none` so the empty column never
          swallows a tap meant for the table underneath. */}
      <View style={styles.actionStack} pointerEvents="box-none">
        <ActionBar model={model} onAction={dispatch} disabled={pendingAction} vertical />
      </View>

      {/* Floating emote bubbles */}
      <View style={styles.emoteLayer} pointerEvents="none">
        {emotes.map((bubble) => (
          <Text key={bubble.id} style={styles.bubble}>
            {seatNames[bubble.seat] ?? ''} {bubble.emote}
          </Text>
        ))}
      </View>

      {/* Hand result overlay — doubles as scoring education. */}
      {handResult && (
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            {(() => {
              const formatted = formatResult(handResult.result, seatNames);
              return (
                <>
                  <Text style={styles.overlayTitle}>{formatted.title}</Text>
                  {formatted.subtitle && (
                    <Text style={styles.muted}>{formatted.subtitle}</Text>
                  )}
                  {formatted.winningHand && (
                    <View style={styles.winningHand}>
                      {formatted.winningHand.concealed.map((t, i) => (
                        <Tile key={`c-${t}-${i}`} tile={t} size="meld" />
                      ))}
                      {formatted.winningHand.melds.flatMap((m, mi) =>
                        m.tiles.map((t, i) => (
                          <Tile key={`m-${mi}-${t}-${i}`} tile={t} size="meld" />
                        )))}
                    </View>
                  )}
                  {formatted.rows.map((row, i) => (
                    <View key={i} style={styles.taiRow}>
                      <Text style={styles.taiName}>{row.name}</Text>
                      <Text style={styles.taiValue}>{strings.tai(row.tai)}</Text>
                    </View>
                  ))}
                  <View style={styles.payments}>
                    {formatted.payments.map((p) => (
                      <Text key={p.seat} style={styles.payment}>
                        {p.name} {p.delta >= 0 ? `+${p.delta}` : p.delta}
                      </Text>
                    ))}
                  </View>
                  <Button label={strings.continueLabel} onPress={clearHandResult} />
                </>
              );
            })()}
          </ScrollView>
        </View>
      )}

      <ErrorToast message={errorMessage} onDismiss={dismissError} />
    </View>
  );
}

/**
 * Zone heights are FIXED, not flexed apart.
 *
 * A phone in landscape gives about 400px of height, and the first version let
 * every zone size itself — so on a real screen the opponent panels, the ponds
 * and the hand all rendered on top of one another. Each band now gets a budget
 * and clips to it; the middle takes whatever is left.
 */
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    // The RIM, not the surface: the darker felt all four players sit at.
    backgroundColor: tokens.color.tableFeltRim,
    paddingHorizontal: tokens.space.s,
    paddingVertical: tokens.space.xs,
  },
  // The playing surface, inset so the seats fall outside it. Only a shade
  // lighter than the rim — enough to read as a surface with an edge, not
  // enough to look like a green box drawn on a green screen.
  surface: {
    position: 'absolute',
    top: TABLE_ZONES.top,
    bottom: TABLE_ZONES.bottom,
    left: TABLE_ZONES.side,
    right: TABLE_ZONES.side,
    backgroundColor: tokens.color.tableFelt,
    borderRadius: tokens.radius.l,
    borderWidth: 1,
    borderColor: tokens.color.tableSurfaceEdge,
  },
  topRow: {
    height: TABLE_ZONES.top,
    flexDirection: 'row',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  middleRow: { flex: 1, flexDirection: 'row', alignItems: 'center', minHeight: 0 },
  sideColumn: { width: TABLE_ZONES.side, justifyContent: 'center', alignItems: 'center' },
  centerColumn: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 0 },
  ponds: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'flex-start',
    gap: tokens.space.s,
    marginTop: tokens.space.xs,
    overflow: 'hidden',
  },
  bottom: { height: TABLE_ZONES.bottom, justifyContent: 'flex-end', gap: 2 },
  // The band under the hand, which was empty felt.
  bottomStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.space.s,
  },
  // Bottom-LEFT corner: my exposed melds and my flowers. Mini size so the row
  // never wraps into a second line and gets clipped by the zone.
  myMelds: {
    flex: 1,
    flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs,
    alignItems: 'flex-end', justifyContent: 'flex-start',
    maxHeight: 30, overflow: 'hidden',
  },
  // Bounded by the two fixed zones, bottom-aligned, so the stack grows UP from
  // just above the hand and can never run off the top of the screen.
  actionStack: {
    position: 'absolute',
    right: tokens.space.s,
    top: TABLE_ZONES.top,
    bottom: TABLE_ZONES.bottom,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
  },
  // Clear of the top opponent's panel — the token, not a copy of its value,
  // which silently went stale when the zone grew to fit exposed melds.
  emoteLayer: { position: 'absolute', top: TABLE_ZONES.top, right: 12, gap: 2 },
  bubble: { color: tokens.color.textOnFelt, fontSize: 16 },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: tokens.color.overlayScrim,
    justifyContent: 'center',
  },
  overlayInner: {
    margin: tokens.space.l,
    padding: tokens.space.l,
    backgroundColor: tokens.color.surface,
    borderRadius: tokens.radius.l,
    gap: tokens.space.s,
  },
  overlayTitle: {
    color: tokens.color.accentGold, fontSize: 24, fontWeight: '800', textAlign: 'center',
  },
  winningHand: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 2, justifyContent: 'center',
    marginVertical: tokens.space.s,
  },
  taiRow: { flexDirection: 'row', justifyContent: 'space-between' },
  taiName: { color: tokens.color.textOnFelt, fontSize: 16 },
  taiValue: { color: tokens.color.accentGold, fontSize: 16, fontWeight: '700' },
  payments: {
    flexDirection: 'row', justifyContent: 'space-around', marginTop: tokens.space.s,
  },
  payment: { color: tokens.color.textOnFelt, fontSize: 14 },
  muted: { color: tokens.color.textMuted, fontSize: 14, textAlign: 'center' },
});
