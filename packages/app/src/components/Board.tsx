import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, { LinearTransition } from 'react-native-reanimated';
import type { Meld, OpponentView, PlayerView, Seat, TileKind, Wind } from '@mahjong/engine';
import { Tile, type TileEntrance } from '../tiles/Tile';
import { ThinkingDots, TurnGlow } from './Motion';
import { dealDelay } from '../theme/motion';
import {
  COMPACT_ROW, SIDE_STACK, TABLE_ZONES, TILE_SIZES, sideStackColumns, tileHeight, tokens,
} from '../theme/tokens';
import { strings } from '../strings';
import { POND, isVerticalEdge, pondSlots, type Edge, type Rect } from '../state/tableLayout';

/**
 * Widest a hand tile can be and still fit `count` of them across `available`.
 *
 * Never wider than `TILE_SIZES.hand`; on a roomy screen this changes nothing.
 * It exists for narrow ones, where 17 tiles at full size run under the action
 * stack — a Discard button sitting on top of the tiles you are choosing
 * between is worse than slightly smaller tiles.
 */
export function handTileWidth(available: number, count: number): number {
  if (count <= 0) return TILE_SIZES.hand;
  const perTile = Math.floor(available / count) - 2; // 2 = the per-tile margin
  return Math.max(20, Math.min(TILE_SIZES.hand, perTile));
}

/**
 * React keys for a sorted hand: each tile with its occurrence, `5t#0`, `5t#1`.
 * Keyed by position, every tile after a newly drawn one changed key and was
 * rebuilt; keyed like this only the newcomer mounts, and the rest slide aside.
 */
function occurrenceKeys(tiles: TileKind[]): string[] {
  const seen = new Map<TileKind, number>();
  return tiles.map((t) => {
    const n = seen.get(t) ?? 0;
    seen.set(t, n + 1);
    return `${t}#${n}`;
  });
}

/** Tiles making room for a newcomer glide over rather than jumping. */
const HAND_REFLOW = LinearTransition.springify().damping(18).stiffness(220);

/** My concealed hand. Tap to select, tap the selected tile again to discard. */
export function HandRow({
  tiles, selectedTile, onSelect, onDiscard, disabled, available, entrances,
}: {
  tiles: TileKind[];
  selectedTile: TileKind | null;
  onSelect: (tile: TileKind) => void;
  onDiscard: (tile: TileKind) => void;
  disabled: boolean;
  /** Width the hand may occupy, already excluding the action gutter. */
  available?: number;
  /** Tiles to animate in, by index: the opening deal, or the tile just drawn. */
  entrances?: Record<number, TileEntrance>;
}): React.ReactElement {
  const width = available === undefined
    ? TILE_SIZES.hand
    : handTileWidth(available, tiles.length);
  const keys = occurrenceKeys(tiles);
  // Selection is by tile kind (that is what a discard names), but with two of
  // a kind only the one actually tapped should rise. Remembered by key, which
  // survives the hand re-sorting; if it goes stale, the first copy stands in.
  const [tapped, setTapped] = useState<string | null>(null);
  const liftedKey = selectedTile === null ? null
    : tapped !== null && tapped.startsWith(`${selectedTile}#`) && keys.includes(tapped)
      ? tapped
      : `${selectedTile}#0`;
  return (
    <View style={styles.handRow}>
      {tiles.map((tile, i) => (
        <Animated.View key={keys[i]} style={styles.handTile} layout={HAND_REFLOW}>
          <Tile
            tile={tile}
            size="hand"
            width={width}
            selected={keys[i] === liftedKey}
            disabled={disabled}
            entrance={entrances?.[i]}
            onPress={() => {
              setTapped(keys[i]!);
              if (selectedTile === tile) onDiscard(tile);
              else onSelect(tile);
            }}
            testID={`hand-tile-${tile}-${i}`}
          />
        </Animated.View>
      ))}
    </View>
  );
}

/** The row above my hand that holds my completed sets (and the action buttons beside them). */
export const MELD_ROW = 42;

/** How wide `MeldGroup` draws these melds at `tile` px — what the action buttons must leave free. */
export function meldRowWidth(melds: Meld[], tile: number = TILE_SIZES.meld): number {
  return melds.reduce((w, m) => w + m.tiles.length * tile + tokens.space.s, 0);
}

/** Each tile of a meld just laid down rises into place, one after another. */
function meldEntrance(i: number): TileEntrance {
  return { kind: 'meld', delay: i * 60 };
}

/**
 * Exposed melds. A concealed kong shows two backs and two faces, which is how
 * it is laid on a real table — you can see it is a kong without seeing which.
 */
export function MeldGroup({
  melds, size = 'meld', freshLast = false,
}: {
  melds: Meld[];
  size?: 'meld' | 'mini';
  /** The last meld was just claimed: lay it down with a flourish. */
  freshLast?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.meldRow}>
      {melds.map((meld, m) => (
        // Keyed by size too: an added kong turns a three-tile meld into four,
        // and that should replay its entrance rather than tack a tile on.
        <View key={`${m}-${meld.tiles.length}`} style={styles.meld}>
          {meld.tiles.map((tile, i) => (
            <Tile
              key={`${tile}-${i}`}
              tile={tile}
              size={size}
              faceUp={!(meld.concealed && meld.type === 'kong' && (i === 0 || i === 3))}
              entrance={freshLast && m === melds.length - 1 ? meldEntrance(i) : undefined}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

const WIND_GLYPH: Record<Wind, string> = { E: '東', S: '南', W: '西', N: '北' };

/**
 * One seat's discards, on its mat in front of that player.
 *
 * Where the pond sits says whose it is; the mat, faintly visible even when
 * empty and watermarked with the seat's wind (東 is the dealer), makes the four
 * of them read as four separate places from the first turn. Only the newest
 * discard at the table is ringed — the one that can still be claimed.
 */
export function SeatPond({
  edge, tiles, mat, tile, wind, highlightLast = false, enterLast,
}: {
  edge: Edge;
  tiles: TileKind[];
  /** Where the mat sits on the felt, from `pondLayout`. */
  mat: Rect;
  /** Discard width, from `pondLayout`. */
  tile: number;
  wind: Wind;
  highlightLast?: boolean;
  /** The newest tile was just thrown: land it like this. */
  enterLast?: TileEntrance;
}): React.ReactElement {
  const slots = pondSlots(edge, tiles.length, tile);
  return (
    <View
      testID={`pond-${edge}`}
      pointerEvents="none"
      style={[styles.pondMat, { left: mat.x, top: mat.y, width: mat.width, height: mat.height }]}
    >
      <Text
        style={[styles.pondWind, { fontSize: Math.min(mat.width, mat.height) * 0.62 }]}
        allowFontScaling={false}
      >
        {WIND_GLYPH[wind]}
      </Text>
      {tiles.map((t, i) => (
        <View
          key={`${t}-${i}`}
          style={[styles.pondSlot, { left: POND.matPad + slots[i]!.x, top: POND.matPad + slots[i]!.y }]}
        >
          <Tile
            tile={t}
            width={tile}
            selected={highlightLast && i === tiles.length - 1}
            lift={false}
            entrance={i === tiles.length - 1 ? enterLast : undefined}
            testID={`pond-${edge}-tile`}
          />
        </View>
      ))}
    </View>
  );
}

/** Mini tile width plus its gap, for sizing the concealed-tile block. */
const MINI_PITCH = TILE_SIZES.mini + 1;

/**
 * A side seat's exposed tiles, flattened into a single list for the grid.
 *
 * Side seats cannot use `MeldGroup`: a meld is a non-wrapping row, and a
 * non-wrapping row inside a `maxWidth` box does not shrink in React Native, it
 * overflows — which is how the right seat's melds ended up 31px off the screen
 * and the left seat's 80px out across the felt.
 *
 * Flattening has to carry the concealed-kong rule with it. Two of a concealed
 * kong's four tiles stay face down, so declaring an 暗槓 still does not tell
 * the table which tile it was. Pure, so that rule is testable without a
 * renderer — asserting it through the rendered SVG silently proved nothing.
 */
export function exposedTiles(
  opponent: Pick<OpponentView, 'melds' | 'flowers'>,
): { tile: TileKind; faceUp: boolean; meld: number | null }[] {
  return [
    ...opponent.melds.flatMap((meld, m) => meld.tiles.map((tile, i) => ({
      tile,
      faceUp: !(meld.concealed && meld.type === 'kong' && (i === 0 || i === 3)),
      meld: m,
    }))),
    ...opponent.flowers.map((tile) => ({ tile, faceUp: true, meld: null })),
  ];
}

/**
 * An opponent's concealed tiles: real tile backs at every seat.
 *
 * The seat across the table faces you, so their tiles stand upright in a row.
 * The left and right seats' tiles face THEM — from where you sit those are
 * turned ninety degrees, so they are drawn laid down, in two columns, with felt
 * between every one. Nothing overlaps: two columns of nine laid-down tiles fit
 * the rail whole, which upright tiles never could.
 *
 * Grouped in fours regardless, because a run of seventeen identical backs is
 * the one thing an eye cannot count.
 */
function ConcealedTiles({ count, edge, dealing }: {
  count: number;
  edge: Edge;
  /** A new hand: the backs cascade in alongside my own tiles. */
  dealing: boolean;
}): React.ReactElement {
  const deal = (i: number): TileEntrance | undefined =>
    dealing ? { kind: 'deal', delay: dealDelay(i) } : undefined;
  if (isVerticalEdge(edge)) {
    return (
      <View style={styles.sideStack}>
        {sideStackColumns(count).map((inColumn, c, columns) => (
          <View key={c} style={styles.sideStackColumn}>
            {Array.from({ length: inColumn }, (_, i) => (
              <View
                key={i}
                testID="concealed-sliver"
                style={i > 0 && i % SIDE_STACK.groupSize === 0
                  ? styles.sideStackGroupBreak
                  : null}
              >
                <Tile
                  tile="1w"
                  size="mini"
                  width={SIDE_STACK.tileWidth}
                  landscape
                  faceUp={false}
                  entrance={deal(columns.slice(0, c).reduce((n, k) => n + k, 0) + i)}
                  testID="side-tile"
                />
              </View>
            ))}
          </View>
        ))}
      </View>
    );
  }
  // One row, always. A full hand is 17 tiles (~325px of the 880 available), and
  // wrapping to a second row overflowed the top zone's height budget and got
  // clipped — leaving the count unreadable, which is the one thing this shows.
  return (
    <View style={[styles.backs, { maxWidth: 18 * MINI_PITCH }]}>
      {Array.from({ length: count }, (_, i) => (
        <Tile key={i} tile="1w" size="mini" faceUp={false} entrance={deal(i)} />
      ))}
    </View>
  );
}

/**
 * An opponent: name, tile-backs for their concealed count, melds, flowers.
 *
 * The panel is NOT rotated. Rotating the whole panel — which the first version
 * did — turns a wide element into a tall one visually while layout still
 * reserves the original box, so the tile blocks overflowed their column and
 * collided with the table; it also left every opponent's name upside-down or
 * sideways. Instead the backs are arranged to suit the edge and the name stays
 * upright, which is what you actually need to read mid-hand.
 *
 * Exposed tiles — melds and flowers — sit BESIDE the concealed ones rather than
 * under them. Stacked underneath they pushed the top seat's panel to 80px in a
 * 56px zone, and `overflow: hidden` silently swallowed the difference: an
 * opponent could pung in front of you and the meld would simply not be drawn.
 * Hiding an exposed meld is the worst thing this panel can do, because a
 * revealed pung is the strongest read you get on what someone is collecting.
 * Alongside is also where melds are laid on a real table.
 */
export function OpponentPanel({
  opponent, edge, isTurn, connected, name, dealing = false, freshMeld = false, thinking = false,
}: {
  opponent: OpponentView;
  edge: Edge;
  isTurn: boolean;
  connected: boolean;
  name: string;
  /** A new hand is being dealt. */
  dealing?: boolean;
  /** Their last meld was just claimed. */
  freshMeld?: boolean;
  /** They may be deciding something right now: dots by the name. */
  thinking?: boolean;
}): React.ReactElement {
  const sideways = isVerticalEdge(edge);
  const hasExposed = opponent.melds.length > 0 || opponent.flowers.length > 0;

  const flattened = exposedTiles(opponent);

  const exposed = hasExposed ? (
    sideways ? (
      <View style={styles.exposedBeside}>
        {flattened.map(({ tile, faceUp, meld }, i) => (
          <Tile
            key={`${tile}-${i}`}
            tile={tile}
            size="mini"
            faceUp={faceUp}
            entrance={freshMeld && meld === opponent.melds.length - 1
              ? meldEntrance(i - flattened.findIndex((t) => t.meld === meld))
              : undefined}
          />
        ))}
      </View>
    ) : (
      <View style={styles.exposedInline}>
        <MeldGroup melds={opponent.melds} size="mini" freshLast={freshMeld} />
        {opponent.flowers.map((f, i) => <Tile key={`${f}-${i}`} tile={f} size="mini" />)}
      </View>
    )
  ) : null;

  return (
    <View style={styles.opponent}>
      {isTurn && <TurnGlow radius={tokens.radius.m} />}
      <View style={styles.opponentHeader}>
        <Text style={styles.opponentName} numberOfLines={1}>{name}</Text>
        {thinking && <ThinkingDots />}
        {/* The side stacks are 4px slivers. Grouping them in fours makes them
            countable, but the number itself costs nothing and settles it. */}
        {sideways && <Text style={styles.handCount}>{opponent.handCount}</Text>}
        {!connected && <Text style={styles.covering}>{strings.botCovering}</Text>}
        {!sideways && exposed}
      </View>

      {sideways ? (
        // Mirrored: exposed tiles always lie on the table side of the stack,
        // never the screen side. A player lays their melds in front of them,
        // toward the middle; on the right seat, un-mirrored, they were shoved
        // out against the bezel while the left seat's sat neatly inboard.
        <View style={[styles.sideBody, edge === 'right' && styles.sideBodyMirrored]}>
          <ConcealedTiles count={opponent.handCount} edge={edge} dealing={dealing} />
          {exposed}
        </View>
      ) : (
        <ConcealedTiles count={opponent.handCount} edge={edge} dealing={dealing} />
      )}
    </View>
  );
}

/**
 * Round wind, wall count and whose turn it is.
 *
 * Lives in a corner of the table, not the middle. In the middle it sat exactly
 * where the eye goes to read the ponds, and a scoreboard has no business in the
 * playing area — on a real table this information is on the indicator at the
 * edge, not in the centre where the tiles are.
 */
export function TableStatus({ view, seatNames }: {
  view: PlayerView;
  seatNames: Record<number, string>;
}): React.ReactElement {
  const turnName = seatNames[view.turn] ?? `Seat ${view.turn + 1}`;
  const mine = view.turn === view.seat;
  return (
    <View style={styles.status}>
      <View style={styles.statusHead}>
        <Text style={styles.statusWind}>{view.roundWind}</Text>
        <Text style={styles.statusWall}>{strings.wallRemaining(view.wallCount)}</Text>
      </View>
      {/* Every opponent gets a gold border on their turn; you get this line, so
          on your own turn it has to carry the same weight. Muted grey in a
          corner made the one cue that decides whether you act the quietest
          thing on the table. */}
      <Text style={[styles.statusTurn, mine && styles.statusTurnMine]} numberOfLines={1}>
        {mine ? strings.yourTurn : turnName}
      </Text>
    </View>
  );
}

/** A lobby seat card. `compact` trims it to fit a landscape phone. */
export function SeatCard({
  seat, name, kind, connected, isHost, canEdit, compact = false, onAddBot, onRemoveBot,
}: {
  seat: Seat;
  name: string;
  kind: 'human' | 'bot' | 'empty';
  connected: boolean;
  isHost: boolean;
  canEdit: boolean;
  compact?: boolean;
  onAddBot: (seat: Seat) => void;
  onRemoveBot: (seat: Seat) => void;
}): React.ReactElement {
  return (
    <View style={[styles.seatCard, compact && styles.seatCardCompact]}>
      <Text style={styles.seatName} numberOfLines={1}>
        {kind === 'bot' ? `🤖 ${name}` : name}
        {isHost ? ' ⭐' : ''}
      </Text>
      {kind === 'human' && !connected && (
        <Text style={styles.covering}>{strings.disconnected}</Text>
      )}
      {canEdit && kind === 'empty' && (
        <Text style={styles.seatAction} onPress={() => onAddBot(seat)}>{strings.addBot}</Text>
      )}
      {canEdit && kind === 'bot' && (
        <Text style={styles.seatAction} onPress={() => onRemoveBot(seat)}>
          {strings.removeBot}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  handRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  handTile: { marginHorizontal: 1, marginTop: 10 },
  meldRow: { flexDirection: 'row', flexWrap: 'wrap' },
  meld: { flexDirection: 'row', marginRight: tokens.space.s, marginTop: tokens.space.xs },
  pondMat: {
    position: 'absolute',
    backgroundColor: tokens.color.pondMat,
    borderColor: tokens.color.pondMatEdge,
    borderWidth: 1,
    borderRadius: tokens.radius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pondWind: { color: tokens.color.pondWind, fontFamily: tokens.font.cjk, includeFontPadding: false },
  pondSlot: { position: 'absolute' },
  opponent: {
    padding: tokens.space.xs,
    borderRadius: tokens.radius.m,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 2,
  },
  opponentHeader: { flexDirection: 'row', alignItems: 'center', gap: tokens.space.xs },
  opponentName: { color: tokens.color.textOnFelt, fontSize: 13, fontWeight: '600' },
  covering: { color: tokens.color.accentGold, fontSize: 11 },
  handCount: { color: tokens.color.textMuted, fontSize: 12, fontWeight: '700' },
  backs: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 2 },
  // Top seat: exposed tiles ride along the name row, which is otherwise mostly
  // empty space, so they cost the zone no extra height at all.
  exposedInline: {
    flexDirection: 'row', flexWrap: 'nowrap', gap: 1, alignItems: 'center',
    maxWidth: 24 * MINI_PITCH,
  },
  // Side seats: three tiles wide, an EXPLICIT width rather than a maxWidth —
  // that is the difference between wrapping and overflowing off the screen.
  // Height is capped so a freak hand cannot push the grid down through the
  // ponds; melds are laid out before flowers, so what a cap sacrifices is a
  // flower rather than the meld that tells you what someone is collecting.
  exposedBeside: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    width: 3 * MINI_PITCH,
    maxHeight: 5 * (tileHeight(TILE_SIZES.mini) + 1),
    alignContent: 'flex-start',
    overflow: 'hidden',
  },
  sideBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  sideBodyMirrored: { flexDirection: 'row-reverse' },
  // A side seat's hand: laid-down tile backs, two columns, none touching.
  sideStack: {
    marginTop: 2,
    flexDirection: 'row',
    gap: SIDE_STACK.gap,
    alignItems: 'flex-start',
  },
  sideStackColumn: { gap: SIDE_STACK.gap },
  sideStackGroupBreak: { marginTop: SIDE_STACK.groupGap },
  // Corner block: wind and wall on one line, whose turn under it.
  status: { alignItems: 'flex-start', gap: 1 },
  statusHead: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.xs },
  statusWind: { color: tokens.color.accentGold, fontSize: 20, fontWeight: '700' },
  statusWall: { color: tokens.color.textOnFelt, fontSize: 12 },
  statusTurn: { color: tokens.color.textMuted, fontSize: 11 },
  statusTurnMine: { color: tokens.color.accentGold, fontSize: 13, fontWeight: '700' },
  seatCard: {
    backgroundColor: tokens.color.surfaceRaised,
    borderRadius: tokens.radius.m,
    padding: tokens.space.m,
    minHeight: 72,
    justifyContent: 'center',
    gap: tokens.space.xs,
  },
  // Four of these plus the controls have to fit a landscape phone's height.
  seatCardCompact: {
    padding: tokens.space.s,
    minHeight: COMPACT_ROW.seat,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: tokens.space.s,
  },
  seatName: { color: tokens.color.textOnFelt, fontSize: 16, fontWeight: '600' },
  seatAction: { color: tokens.color.accentGold, fontSize: 14 },
});
