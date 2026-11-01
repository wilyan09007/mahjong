import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import * as ScreenOrientation from 'expo-screen-orientation';
import { resolveVariant, seatWind, type Action, type PlayerView, type Seat, type TileKind } from '@mahjong/engine';
import { useGameStore } from '../src/state/store';
import { playAction, send } from '../src/net/connection';
import { C2S } from '../src/net/messages';
import { actionBarModel, formatResult, thinkingSeats } from '../src/state/selectors';
import { FELT_INSET, edgeFor, feltSize, pondLayout } from '../src/state/tableLayout';
import { tableEvents } from '../src/state/tableEvents';
import { planMotion, type Callout as CalloutPlan, type MotionPlan } from '../src/state/motionPlan';
import { Appear, Callout } from '../src/components/Motion';
import { MOTION, resultSheetDelay } from '../src/theme/motion';
import {
  HandRow, MELD_ROW, MeldGroup, OpponentPanel, SeatPond, TableStatus, meldRowWidth,
} from '../src/components/Board';
import { ActionBar, Button, EmotePicker, ErrorToast } from '../src/components/Controls';
import { Tile } from '../src/tiles/Tile';
import { TABLE_ZONES, tokens } from '../src/theme/tokens';
import { strings } from '../src/strings';

const STILL: MotionPlan = { hand: {}, dealing: false, pondLast: {}, freshMeld: {}, callouts: [] };

/**
 * What should move, given the view that just arrived. The server sends whole
 * positions; comparing each with the one before is what turns them back into
 * moments — a deal, a draw, a discard landing, a pung.
 */
function useTableMotion(view: PlayerView | null): MotionPlan {
  const previous = useRef<PlayerView | null>(null);
  const plan = useMemo(
    () => (view ? planMotion(tableEvents(previous.current, view), view.seat, view.hand.length) : STILL),
    [view],
  );
  useEffect(() => { if (view) previous.current = view; }, [view]);
  return plan;
}

let calloutSequence = 0;

/** Call-outs currently on the table. Each removes itself once it has played. */
function useCallouts(plan: MotionPlan): (CalloutPlan & { id: number })[] {
  const [live, setLive] = useState<(CalloutPlan & { id: number })[]>([]);
  useEffect(() => {
    if (plan.callouts.length === 0) return;
    const fresh = plan.callouts.map((c) => ({ ...c, id: ++calloutSequence }));
    setLive((now) => [...now, ...fresh]);
    for (const c of fresh) {
      const hold = c.big ? MOTION.duration.winHold : MOTION.duration.calloutHold;
      setTimeout(
        () => setLive((now) => now.filter((x) => x.id !== c.id)),
        hold + MOTION.duration.fade + 100,
      );
    }
  }, [plan]);
  return live;
}

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
  const { width, height } = useWindowDimensions();
  // The felt's real size once laid out; until then, what the insets predict.
  const [felt, setFelt] = useState<{ width: number; height: number } | null>(null);
  // The width my hand and the row above it share: the whole screen, less its
  // padding. Nothing sits beside the hand any more.
  const rowWidth = width - 2 * tokens.space.s;
  const ponds = useMemo(() => pondLayout(felt ?? feltSize({ width, height })), [felt, width, height]);
  const motion = useTableMotion(view);
  const callouts = useCallouts(motion);

  // The result sheet waits for the closing call-out to land: covering the 胡
  // the moment it appears would throw away the best moment of the hand, and a
  // drawn hand's 流局 deserves its beat too.
  const [resultReady, setResultReady] = useState(false);
  useEffect(() => {
    setResultReady(false);
    if (!handResult) return;
    const timer = setTimeout(() => setResultReady(true), resultSheetDelay(handResult.result.type));
    return () => clearTimeout(timer);
  }, [handResult]);

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

  const thinking = thinkingSeats(view);

  const dispatch = (action: Action): void => {
    setSelectedTile(null);
    playAction(action);
  };

  return (
    <View style={styles.screen}>
      {/* The playing surface. The screen itself is the darker rim all four
          players sit at; this is the felt, and each player's discards lie on
          it in front of them — position is what says whose they are. */}
      <View
        style={styles.surface}
        pointerEvents="none"
        onLayout={(e) => {
          const { width: w, height: h } = e.nativeEvent.layout;
          if (!felt || felt.width !== w || felt.height !== h) setFelt({ width: w, height: h });
        }}
      >
        {[
          { seat: view.seat, discards: view.discards },
          ...view.opponents.map((o) => ({ seat: o.seat, discards: o.discards })),
        ].map(({ seat, discards }) => {
          const edge = edgeFor(view.seat, seat);
          return (
            <SeatPond
              key={seat}
              edge={edge}
              tiles={discards}
              mat={ponds.mats[edge]}
              tile={ponds.tile}
              wind={seatWind(seat, view.dealer)}
              highlightLast={view.lastDiscard?.by === seat}
              enterLast={motion.pondLast[seat]}
            />
          );
        })}
      </View>

      {/* Round wind, wall count and whose turn — in the top-left corner of the
          SCREEN, not of the playing surface. It started in the middle of the
          table, which is where the eye goes to read the ponds; the surface's
          own corner is still inside the play area, so it went all the way out
          to the dead space beside the seat across the table. */}
      <View style={styles.status} pointerEvents="none">
        <TableStatus view={view} seatNames={seatNames} />
      </View>

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
              dealing={motion.dealing}
              freshMeld={!!motion.freshMeld[o.seat]}
              thinking={thinking.includes(o.seat)}
            />
          ))}
      </View>

      {/* The side seats ride their own full-height rails rather than sitting in
          the middle band. The band is capped by the top seat's zone, but that
          zone is centred across the table and its corners are dead space — the
          room the left and right players' tiles needed was sitting there
          unused. `box-none` so an empty rail never eats a tap. */}
      {(['left', 'right'] as const).map((side) => (
        <View
          key={side}
          style={[styles.rail, side === 'left' ? styles.railLeft : styles.railRight]}
          pointerEvents="box-none"
        >
          {view.opponents
            .filter((o) => edgeFor(view.seat, o.seat) === side)
            .map((o) => (
              <OpponentPanel
                key={o.seat}
                opponent={o}
                edge={side}
                isTurn={view.turn === o.seat}
                connected={seatStatus[o.seat] ?? true}
                name={seatNames[o.seat] ?? `Seat ${o.seat + 1}`}
                dealing={motion.dealing}
                freshMeld={!!motion.freshMeld[o.seat]}
                thinking={thinking.includes(o.seat)}
              />
            ))}
        </View>
      ))}

      {/* The middle of the table is the felt above; this only holds the bands
          above and below it apart. */}
      <View style={styles.middleRow} pointerEvents="none" />

      {/* Me */}
      <View style={styles.bottom}>
        {/* Completed sets sit directly above my remaining tiles — they are part
            of the hand I am reading, so they belong next to it. */}
        {/* The row above my tiles: my completed sets on the left, the action
            buttons on the right, side by side. The buttons hang from the
            bottom of the row, so when a busy claim window will not fit one
            line its extra rows rise over the felt — over my own discards, and
            only for the seconds the window is open. */}
        <View style={styles.aboveHand}>
          <View style={styles.myMelds}>
            <MeldGroup melds={view.melds} freshLast={!!motion.freshMeld[view.seat]} />
          </View>
          <View style={styles.actions} pointerEvents="box-none">
            {/* Re-keyed whenever the set of choices changes, so new options pop
                in rather than appearing — a pung offer has to catch the eye in
                the second or two it is open. */}
            <Appear key={actionSignature(model)}>
              <ActionBar
                model={model}
                onAction={dispatch}
                disabled={pendingAction}
                available={rowWidth - meldRowWidth(view.melds) - tokens.space.s}
              />
            </Appear>
          </View>
        </View>
        <HandRow
          tiles={view.hand}
          available={rowWidth}
          selectedTile={selectedTile}
          entrances={motion.hand}
          onSelect={setSelectedTile}
          onDiscard={(tile) => {
            const discard = view.legalActions.find(
              (a) => a.type === 'discard' && a.tile === tile,
            );
            if (discard) dispatch(discard);
          }}
          disabled={pendingAction}
        />
        {/* The strip under the hand: flowers in the left corner, emotes in the
            right. Flowers only — they are scoring bookkeeping, not part of the
            hand you are reading. */}
        <View style={styles.bottomStrip}>
          <View style={styles.myFlowers}>
            {view.flowers.map((f, i) => <Tile key={`${f}-${i}`} tile={f} size="mini" />)}
          </View>
          <EmotePicker
            onSend={(emote) => send(C2S.emote, { emote })}
            disabled={pendingAction}
          />
        </View>
      </View>

      {/* Floating emote bubbles */}
      <View style={styles.emoteLayer} pointerEvents="none">
        {emotes.map((bubble) => (
          <Text key={bubble.id} style={styles.bubble}>
            {seatNames[bubble.seat] ?? ''} {bubble.emote}
          </Text>
        ))}
      </View>

      {/* Call-outs: 碰, 槓, 胡… stamped in front of whoever made them. */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {callouts.map((c) => (
          <Callout
            key={c.id}
            text={c.text}
            name={c.muted ? '' : seatNames[c.seat] ?? ''}
            edge={edgeFor(view.seat, c.seat)}
            big={c.big}
            muted={c.muted}
          />
        ))}
      </View>

      {/* Hand result overlay — doubles as scoring education. */}
      {handResult && resultReady && (
        <View style={styles.overlay}>
          <Appear style={styles.overlayCard}>
          <ScrollView contentContainerStyle={styles.overlayInner}>
            {(() => {
              const formatted = formatResult(
                handResult.result, seatNames, resolveVariant(lobby?.config.variant ?? 'taiwanese').unit,
              );
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
                      <Text style={styles.taiValue}>{strings.score(row.tai, formatted.unit)}</Text>
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
          </Appear>
        </View>
      )}

      <ErrorToast message={errorMessage} onDismiss={dismissError} />
    </View>
  );
}

/** Which buttons are on offer — when this changes, the action stack pops in afresh. */
function actionSignature(model: ReturnType<typeof actionBarModel>): string {
  return [
    model.win ? 'win' : '',
    ...model.claims.map((c) => c.label),
    ...model.kongs.map(() => 'kong'),
    model.pass ? 'pass' : '',
    model.discard ? 'discard' : '',
  ].join('|');
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
    paddingTop: tokens.space.xs,
    // More at the foot than the head: the emote row sits on the floor of the
    // screen and looked like it had fallen off the bottom with 4px under it.
    paddingBottom: tokens.space.s,
  },
  // The playing surface, inset so the seats fall outside it. Only a shade
  // lighter than the rim — enough to read as a surface with an edge, not
  // enough to look like a green box drawn on a green screen.
  // Inset clear of every zone (`FELT_INSET`) so the seats sit fully ON the rim.
  // Flush against the zones, every panel's border and my melds crossed the
  // surface's rounded edge by 3-4px, which read as the felt being torn rather
  // than as tiles resting on a table. The ponds lay out to its measured size.
  surface: {
    position: 'absolute',
    top: FELT_INSET.top,
    bottom: FELT_INSET.bottom,
    left: FELT_INSET.side,
    right: FELT_INSET.side,
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
  middleRow: { flex: 1, minHeight: 0 },
  rail: {
    position: 'absolute',
    top: TABLE_ZONES.railTop,
    bottom: TABLE_ZONES.bottom,
    width: TABLE_ZONES.side,
    justifyContent: 'center',
    alignItems: 'center',
  },
  railLeft: { left: tokens.space.s },
  railRight: { right: tokens.space.s },
  bottom: { height: TABLE_ZONES.bottom, justifyContent: 'flex-end', gap: 2 },
  // My sets and the action buttons share the row above the hand. Its height is
  // the melds'; the buttons are anchored to its floor and may rise past it.
  aboveHand: { height: MELD_ROW, flexDirection: 'row', alignItems: 'flex-end' },
  actions: { position: 'absolute', right: 0, bottom: 0 },
  // The band under the hand, which was empty felt.
  bottomStrip: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: tokens.space.s,
  },
  // Above the hand, from the left: my completed sets. The buttons take the right.
  myMelds: {
    flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.s,
    alignItems: 'flex-end', justifyContent: 'flex-start',
    maxHeight: MELD_ROW, overflow: 'hidden',
  },
  // Bottom-LEFT corner: flowers only, mini size, one row.
  myFlowers: {
    flex: 1,
    flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs,
    alignItems: 'flex-end', justifyContent: 'flex-start',
    maxHeight: 30, overflow: 'hidden',
  },
  // Top-left corner of the SCREEN, not of the playing surface. The top zone is
  // centred on the seat across the table, so this corner is dead space; the
  // surface's own corner is inside the play area, where it crowds the ponds it
  // was moved out of the middle to get away from.
  status: {
    position: 'absolute',
    // Inset to match the screen's own padding. At a flat 0,0 the wind glyph
    // sat against the bezel and read as clipped rather than placed.
    top: tokens.space.xs,
    left: tokens.space.s,
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
  overlayCard: { flexShrink: 1 },
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
