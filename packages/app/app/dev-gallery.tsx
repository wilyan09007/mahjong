import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FLOWERS, NON_FLOWER_KINDS, type TileKind } from '@mahjong/engine';
import { Tile, type TileEntrance } from '../src/tiles/Tile';
import { HandRow, MeldGroup, OpponentPanel, SeatPond } from '../src/components/Board';
import { Button } from '../src/components/Controls';
import { Callout } from '../src/components/Motion';
import { PHONE_LANDSCAPE, TABLE_ZONES, tokens } from '../src/theme/tokens';
import { MOTION, dealDelay } from '../src/theme/motion';
import { strings } from '../src/strings';
import { feltSize, pondLayout, type Edge } from '../src/state/tableLayout';

/**
 * Every tile at every size, every motion on demand, and the board pieces with
 * fake data.
 *
 * This is the screen the art and the motion get judged on: tests prove each
 * tile has the right face and each entrance starts invisible, but only a human
 * eye can say whether a 22px 九萬 is legible or a pung lands with weight. Open
 * `/dev-gallery` on a device to check.
 */
export default function DevGalleryScreen(): React.ReactElement {
  const all = [...NON_FLOWER_KINDS, ...FLOWERS];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <MotionStage />
      <LateGamePonds />

      <Text style={styles.heading}>42 faces @ hand size</Text>
      <View style={styles.grid}>
        {all.map((tile) => <Tile key={tile} tile={tile} size="hand" />)}
      </View>

      <Text style={styles.heading}>Every size (meld · discard · mini)</Text>
      {(['meld', 'discard', 'mini'] as const).map((size) => (
        <View key={size} style={styles.grid}>
          {all.map((tile) => <Tile key={`${size}-${tile}`} tile={tile} size={size} />)}
        </View>
      ))}

      <Text style={styles.heading}>States</Text>
      <View style={styles.grid}>
        <Tile tile="5t" size="hand" selected />
        <Tile tile="5t" size="hand" faceUp={false} />
        <Tile tile="dr" size="hand" disabled onPress={() => undefined} />
      </View>

      <Text style={styles.heading}>Melds</Text>
      <MeldGroup melds={SAMPLE_MELDS} />

      {/* Opponent panels are hard to judge in a live game: you have to wait for
          a bot to claim before a single meld appears on the rim. Here they are
          on demand, at the width the table actually gives them. */}
      {/* Two extremes, because they stress different dimensions: a full
          concealed hand is the tallest the sliver stack ever gets, and a
          heavily exposed one is the widest and tallest the meld grid gets. A
          player never has both at once — melding is what shortens the stack. */}
      {([
        ['full concealed hand', FULL_HAND_OPPONENT],
        ['heavily exposed hand', EXPOSED_OPPONENT],
      ] as const).map(([label, sample]) => (
        <React.Fragment key={label}>
          <Text style={styles.heading}>Opponent panels — {label}</Text>
          <View style={styles.panels}>
            {(['left', 'top', 'right'] as const).map((edge) => (
              <View key={edge} style={styles.panelSlot}>
                <View style={edge === 'top' ? undefined : styles.rimWidth}>
                  <OpponentPanel
                    opponent={sample}
                    edge={edge}
                    isTurn={edge === 'left'}
                    connected
                    name={`${edge} seat`}
                  />
                </View>
                <Text style={styles.caption}>{edge}</Text>
              </View>
            ))}
          </View>
        </React.Fragment>
      ))}
    </ScrollView>
  );
}

const SAMPLE_HAND: TileKind[] = ['1w', '2w', '3w', '5t', '5t', '6t', '7t', '3b', '4b', '5b', 'we', 'we', 'dr', 'dr', 'dg', 'dg'];
const DRAWN_AT = 6; // where the drawn 6t sorts into the hand
const WITH_DRAW: TileKind[] = [...SAMPLE_HAND.slice(0, DRAWN_AT), '6t', ...SAMPLE_HAND.slice(DRAWN_AT)];

type Shot =
  | { kind: 'deal' | 'draw' | 'meld' | 'none' }
  | { kind: 'discard'; from: Edge };

let galleryCallout = 0;

/**
 * Every motion the table has, replayable from a button: the deal, a draw, a
 * discard landing from each side, a meld laid down, and each call-out.
 */
function MotionStage(): React.ReactElement {
  const [shot, setShot] = useState<{ n: number } & Shot>({ n: 0, kind: 'deal' });
  const [selected, setSelected] = useState<TileKind | null>(null);
  const [callouts, setCallouts] = useState<{ id: number; text: string; edge: Edge; big: boolean; muted: boolean }[]>([]);

  const fire = (next: Shot): void => setShot((s) => ({ ...next, n: s.n + 1 }));
  const call = (text: string, edge: Edge, big = false, muted = false): void => {
    const id = ++galleryCallout;
    setCallouts((cs) => [...cs, { id, text, edge, big, muted }]);
    setTimeout(
      () => setCallouts((cs) => cs.filter((c) => c.id !== id)),
      (big ? MOTION.duration.winHold : MOTION.duration.calloutHold) + MOTION.duration.fade + 100,
    );
  };

  const hand = shot.kind === 'draw' ? WITH_DRAW : SAMPLE_HAND;
  const entrances: Record<number, TileEntrance> = shot.kind === 'deal'
    ? Object.fromEntries(hand.map((_, i) => [i, { kind: 'deal', delay: dealDelay(i) }]))
    : shot.kind === 'draw' ? { [DRAWN_AT]: { kind: 'draw' } } : {};

  return (
    <>
      <Text style={styles.heading}>Motion — tap to replay</Text>
      <View style={styles.controls}>
        <Button compact tone="secondary" label="Deal" onPress={() => fire({ kind: 'deal' })} />
        <Button compact tone="secondary" label="Draw" onPress={() => fire({ kind: 'draw' })} />
        {(['bottom', 'left', 'top', 'right'] as const).map((from) => (
          <Button key={from} compact tone="secondary" label={`Discard ${ARROW[from]}`}
            onPress={() => fire({ kind: 'discard', from })} />
        ))}
        <Button compact tone="secondary" label="Meld" onPress={() => { fire({ kind: 'meld' }); call(strings.callout.pung, 'bottom'); }} />
        <Button compact tone="secondary" label={strings.callout.chow} onPress={() => call(strings.callout.chow, 'left')} />
        <Button compact tone="secondary" label={strings.callout.kong} onPress={() => call(strings.callout.kong, 'top')} />
        <Button compact tone="secondary" label={strings.callout.flower} onPress={() => call(strings.callout.flower, 'right')} />
        <Button compact label={strings.callout.win} onPress={() => call(strings.callout.win, 'left', true)} />
        <Button compact label={strings.callout.selfDraw} onPress={() => call(strings.callout.selfDraw, 'bottom', true)} />
        <Button compact tone="secondary" label={strings.callout.exhausted}
          onPress={() => call(strings.callout.exhausted, 'bottom', true, true)} />
      </View>
      <View style={styles.stage}>
        <View style={styles.stageMiddle}>
          <MeldGroup key={`meld-${shot.kind === 'meld' ? shot.n : 0}`} melds={[SAMPLE_MELDS[1]!]} freshLast={shot.kind === 'meld'} />
          {shot.kind === 'discard' && (
            <Tile key={`d-${shot.n}`} tile="9b" size="hand" selected lift={false}
              entrance={{ kind: 'discard', from: shot.from }} />
          )}
        </View>
        <HandRow
          key={shot.kind === 'deal' || shot.kind === 'draw' ? `hand-${shot.n}` : 'hand'}
          tiles={hand}
          selectedTile={selected}
          entrances={entrances}
          disabled={false}
          onSelect={setSelected}
          onDiscard={() => setSelected(null)}
        />
        {callouts.map((c) => (
          <Callout key={c.id} text={c.text} name={c.muted ? '' : 'Sample'} edge={c.edge} big={c.big} muted={c.muted} />
        ))}
      </View>
    </>
  );
}

/**
 * Four full ponds — 18 discards each, the most any seat threw in 3000
 * simulated hands — on a felt the size of the smallest phone's. If this fits
 * and reads, every real game does.
 */
function LateGamePonds(): React.ReactElement {
  const felt = feltSize(PHONE_LANDSCAPE);
  const { tile, mats } = pondLayout(felt);
  const pool = [...NON_FLOWER_KINDS];
  const winds = { bottom: 'E', right: 'S', top: 'W', left: 'N' } as const;
  return (
    <>
      <Text style={styles.heading}>Ponds — a full late game on the smallest phone ({tile}px discards)</Text>
      <View style={[styles.felt, { width: felt.width, height: felt.height }]}>
        {(['bottom', 'right', 'top', 'left'] as const).map((edge, s) => (
          <SeatPond
            key={edge}
            edge={edge}
            tiles={Array.from({ length: 18 }, (_, i) => pool[(i * 7 + s * 5) % pool.length]!)}
            mat={mats[edge]}
            tile={tile}
            wind={winds[edge]}
            highlightLast={edge === 'left'}
          />
        ))}
      </View>
    </>
  );
}

const ARROW: Record<Edge, string> = { bottom: '↑', left: '→', top: '↓', right: '←' };

const SAMPLE_MELDS = [
  { type: 'chow', tiles: ['2w', '3w', '4w'], concealed: false, claimedFrom: 1 },
  { type: 'pung', tiles: ['dr', 'dr', 'dr'], concealed: false, claimedFrom: 2 },
  { type: 'kong', tiles: ['5t', '5t', '5t', '5t'], concealed: true, claimedFrom: null },
] as unknown as React.ComponentProps<typeof MeldGroup>['melds'];

/** Four melds and four flowers — about the worst a rim ever has to hold. */
const EXPOSED_OPPONENT = {
  seat: 1,
  handCount: 5,
  melds: [
    ...SAMPLE_MELDS,
    { type: 'pung', tiles: ['9b', '9b', '9b'], concealed: false, claimedFrom: 3 },
  ],
  flowers: ['f1', 'f2', 'f3', 'f4'],
  discards: [],
} as unknown as React.ComponentProps<typeof OpponentPanel>['opponent'];

/** Nothing claimed yet: the tallest the sliver stack ever gets. */
const FULL_HAND_OPPONENT = {
  seat: 1,
  handCount: 17,
  melds: [],
  flowers: [],
  discards: [],
} as unknown as React.ComponentProps<typeof OpponentPanel>['opponent'];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.tableFelt },
  content: { padding: tokens.space.m, gap: tokens.space.m },
  heading: { color: tokens.color.accentGold, fontSize: 16, fontWeight: '700' },
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: tokens.space.xs },
  felt: {
    backgroundColor: tokens.color.tableFelt,
    borderRadius: tokens.radius.l,
    borderWidth: 1,
    borderColor: tokens.color.tableSurfaceEdge,
  },
  // Roughly a phone table's height, so call-outs land where they would in play.
  stage: {
    height: 360,
    backgroundColor: tokens.color.tableFeltRim,
    borderRadius: tokens.radius.l,
    justifyContent: 'flex-end',
    paddingBottom: tokens.space.m,
    overflow: 'hidden',
  },
  stageMiddle: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: tokens.space.l,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  panels: { flexDirection: 'row', gap: tokens.space.l, alignItems: 'flex-start' },
  panelSlot: { alignItems: 'center', gap: tokens.space.xs },
  // Exactly the rim the table gives a side seat, so overflow shows up here.
  rimWidth: { width: TABLE_ZONES.side, alignItems: 'center' },
  caption: { color: tokens.color.textMuted, fontSize: 12 },
});
