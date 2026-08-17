import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Meld, OpponentView, PlayerView, Seat, TileKind } from '@mahjong/engine';
import { Tile } from '../tiles/Tile';
import {
  COMPACT_ROW, EDGE_ON_TILE, TABLE_ZONES, TILE_SIZES, tileHeight, tokens,
} from '../theme/tokens';
import { strings } from '../strings';
import { DISCARDS_PER_ROW, isVerticalEdge, type Edge } from '../state/tableLayout';

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

/** My concealed hand. Tap to select, tap the selected tile again to discard. */
export function HandRow({
  tiles, selectedTile, onSelect, onDiscard, disabled, available,
}: {
  tiles: TileKind[];
  selectedTile: TileKind | null;
  onSelect: (tile: TileKind) => void;
  onDiscard: (tile: TileKind) => void;
  disabled: boolean;
  /** Width the hand may occupy, already excluding the action gutter. */
  available?: number;
}): React.ReactElement {
  const width = available === undefined
    ? TILE_SIZES.hand
    : handTileWidth(available, tiles.length);
  return (
    <View style={styles.handRow}>
      {tiles.map((tile, i) => (
        <View key={`${tile}-${i}`} style={styles.handTile}>
          <Tile
            tile={tile}
            size="hand"
            width={width}
            selected={selectedTile === tile}
            disabled={disabled}
            onPress={() => (selectedTile === tile ? onDiscard(tile) : onSelect(tile))}
            testID={`hand-tile-${tile}-${i}`}
          />
        </View>
      ))}
    </View>
  );
}

/**
 * Exposed melds. A concealed kong shows two backs and two faces, which is how
 * it is laid on a real table — you can see it is a kong without seeing which.
 */
export function MeldGroup({
  melds, size = 'meld',
}: {
  melds: Meld[];
  size?: 'meld' | 'mini';
}): React.ReactElement {
  return (
    <View style={styles.meldRow}>
      {melds.map((meld, m) => (
        <View key={m} style={styles.meld}>
          {meld.tiles.map((tile, i) => (
            <Tile
              key={`${tile}-${i}`}
              tile={tile}
              size={size}
              faceUp={!(meld.concealed && meld.type === 'kong' && (i === 0 || i === 3))}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * A seat's discard pond, newest ringed in gold.
 *
 * The width is EXPLICIT, not a maxWidth. A wrapping row inside a column
 * collapses to zero intrinsic width in React Native, so `maxWidth` alone made
 * the pond wrap after every single tile and render as a one-tile-wide
 * scrolling column.
 */
export function DiscardPond({
  tiles, highlightLast = false, perRow = DISCARDS_PER_ROW,
}: {
  tiles: TileKind[];
  highlightLast?: boolean;
  /** Tiles per row. Narrower screens use fewer so all four ponds stay side by
   *  side; wrapping the ponds themselves pushed them into the side seats. */
  perRow?: number;
}): React.ReactElement {
  return (
    <View style={[styles.pond, { width: perRow * (TILE_SIZES.discard + 1) }]}>
      {tiles.map((tile, i) => (
        <Tile
          key={`${tile}-${i}`}
          tile={tile}
          size="discard"
          selected={highlightLast && i === tiles.length - 1}
          lift={false}
        />
      ))}
    </View>
  );
}

/** How many tiles fit in one pond row so that all four ponds sit side by side. */
export function pondColumns(screenWidth: number): number {
  const centre = screenWidth - 2 * tokens.space.s - 2 * TABLE_ZONES.side;
  const perPond = (centre - 3 * tokens.space.s) / 4;
  const fit = Math.floor(perPond / (TILE_SIZES.discard + 1));
  return Math.max(3, Math.min(DISCARDS_PER_ROW, fit));
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
): { tile: TileKind; faceUp: boolean }[] {
  return [
    ...opponent.melds.flatMap((meld) => meld.tiles.map((tile, i) => ({
      tile,
      faceUp: !(meld.concealed && meld.type === 'kong' && (i === 0 || i === 3)),
    }))),
    ...opponent.flowers.map((tile) => ({ tile, faceUp: true })),
  ];
}

/**
 * An opponent's concealed tiles.
 *
 * Across the table you see tile BACKS; from the left or right you see the same
 * tiles EDGE-ON, as thin slivers. Rendering the sides as full tile backs is not
 * just less realistic — it is 16 tiles deep, roughly 200px of a 400px-tall
 * phone screen, which is what pushed the side panels straight through the
 * middle of the table.
 */
function ConcealedTiles({ count, edge }: { count: number; edge: Edge }): React.ReactElement {
  if (isVerticalEdge(edge)) {
    return (
      <View style={styles.edgeOnStack}>
        {Array.from({ length: count }, (_, i) => {
          // Break after every fourth tile, but never trailing the last one.
          const endsGroup = (i + 1) % EDGE_ON_TILE.groupSize === 0 && i + 1 < count;
          return (
            <View
              key={i}
              testID="concealed-sliver"
              style={[styles.edgeOnTile, endsGroup && styles.edgeOnGroupBreak]}
            >
              <View style={styles.edgeOnFace} />
            </View>
          );
        })}
      </View>
    );
  }
  // One row, always. A full hand is 17 tiles (~325px of the 880 available), and
  // wrapping to a second row overflowed the top zone's height budget and got
  // clipped — leaving the count unreadable, which is the one thing this shows.
  return (
    <View style={[styles.backs, { maxWidth: 18 * MINI_PITCH }]}>
      {Array.from({ length: count }, (_, i) => (
        <Tile key={i} tile="1w" size="mini" faceUp={false} />
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
  opponent, edge, isTurn, connected, name,
}: {
  opponent: OpponentView;
  edge: Edge;
  isTurn: boolean;
  connected: boolean;
  name: string;
}): React.ReactElement {
  const sideways = isVerticalEdge(edge);
  const hasExposed = opponent.melds.length > 0 || opponent.flowers.length > 0;

  const flattened = exposedTiles(opponent);

  const exposed = hasExposed ? (
    sideways ? (
      <View style={styles.exposedBeside}>
        {flattened.map(({ tile, faceUp }, i) => (
          <Tile key={`${tile}-${i}`} tile={tile} size="micro" faceUp={faceUp} />
        ))}
      </View>
    ) : (
      <View style={styles.exposedInline}>
        <MeldGroup melds={opponent.melds} size="mini" />
        {opponent.flowers.map((f, i) => <Tile key={`${f}-${i}`} tile={f} size="mini" />)}
      </View>
    )
  ) : null;

  return (
    <View style={[styles.opponent, isTurn && styles.opponentTurn]}>
      <View style={styles.opponentHeader}>
        <Text style={styles.opponentName} numberOfLines={1}>{name}</Text>
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
          <ConcealedTiles count={opponent.handCount} edge={edge} />
          {exposed}
        </View>
      ) : (
        <ConcealedTiles count={opponent.handCount} edge={edge} />
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

/** The tile just thrown, alone in the middle of the table where it landed. */
export function LastDiscard({ view }: { view: PlayerView }): React.ReactElement | null {
  if (!view.lastDiscard) return null;
  return (
    <View style={styles.lastDiscard}>
      <Tile tile={view.lastDiscard.tile} size="discard" selected lift={false} />
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
  pond: { flexDirection: 'row', flexWrap: 'wrap', gap: 1 },
  opponent: {
    padding: tokens.space.xs,
    borderRadius: tokens.radius.m,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    gap: 2,
  },
  opponentTurn: { borderColor: tokens.color.accentGold },
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
  // Side seats: three micro tiles wide, an EXPLICIT width rather than a
  // maxWidth — the difference between wrapping and overflowing. Height is
  // capped too, so a freak hand cannot push the grid down through the ponds.
  exposedBeside: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 1,
    width: 3 * (TILE_SIZES.micro + 1),
    maxHeight: 7 * (tileHeight(TILE_SIZES.micro) + 1),
    alignContent: 'flex-start',
    overflow: 'hidden',
  },
  sideBody: { flexDirection: 'row', alignItems: 'flex-start', gap: 2 },
  sideBodyMirrored: { flexDirection: 'row-reverse' },
  // Tiles seen edge-on from a side seat: thin slivers, not full backs.
  edgeOnStack: { marginTop: 2, gap: EDGE_ON_TILE.gap },
  edgeOnTile: {
    width: EDGE_ON_TILE.width,
    height: EDGE_ON_TILE.height,
    borderRadius: 1,
    backgroundColor: tokens.color.tileBack,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  // The ivory body under the green back, as you would see it from the side.
  // Also what separates one sliver from the next at this size.
  edgeOnFace: {
    height: EDGE_ON_TILE.faceEdge,
    // `tileFace`, not `tileFaceEdge`: the brighter pair is the one
    // `contrast.test.ts` already holds to 2.31:1 against the back.
    backgroundColor: tokens.color.tileFace,
  },
  edgeOnGroupBreak: { marginBottom: EDGE_ON_TILE.groupGap },
  // Corner block: wind and wall on one line, whose turn under it.
  status: { alignItems: 'flex-start', gap: 1 },
  statusHead: { flexDirection: 'row', alignItems: 'baseline', gap: tokens.space.xs },
  statusWind: { color: tokens.color.accentGold, fontSize: 20, fontWeight: '700' },
  statusWall: { color: tokens.color.textOnFelt, fontSize: 12 },
  statusTurn: { color: tokens.color.textMuted, fontSize: 11 },
  statusTurnMine: { color: tokens.color.accentGold, fontSize: 13, fontWeight: '700' },
  lastDiscard: { alignItems: 'center' },
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
