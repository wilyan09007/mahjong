import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Meld, OpponentView, PlayerView, Seat, TileKind } from '@mahjong/engine';
import { Tile } from '../tiles/Tile';
import { TILE_SIZES, tokens } from '../theme/tokens';
import { strings } from '../strings';
import { DISCARDS_PER_ROW, isVerticalEdge, type Edge } from '../state/tableLayout';

/** My concealed hand. Tap to select, tap the selected tile again to discard. */
export function HandRow({
  tiles, selectedTile, onSelect, onDiscard, disabled,
}: {
  tiles: TileKind[];
  selectedTile: TileKind | null;
  onSelect: (tile: TileKind) => void;
  onDiscard: (tile: TileKind) => void;
  disabled: boolean;
}): React.ReactElement {
  return (
    <View style={styles.handRow}>
      {tiles.map((tile, i) => (
        <View key={`${tile}-${i}`} style={styles.handTile}>
          <Tile
            tile={tile}
            size="hand"
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
  tiles, highlightLast = false,
}: {
  tiles: TileKind[];
  highlightLast?: boolean;
}): React.ReactElement {
  return (
    <View style={[styles.pond, { width: DISCARDS_PER_ROW * (TILE_SIZES.discard + 1) }]}>
      {tiles.map((tile, i) => (
        <Tile
          key={`${tile}-${i}`}
          tile={tile}
          size="discard"
          selected={highlightLast && i === tiles.length - 1}
        />
      ))}
    </View>
  );
}

/** Mini tile width plus its gap, for sizing the concealed-tile block. */
const MINI_PITCH = TILE_SIZES.mini + 1;

/**
 * An opponent: name, tile-backs for their concealed count, melds, flowers.
 *
 * The panel is NOT rotated. Rotating the whole panel — which the first version
 * did — turns a wide element into a tall one visually while layout still
 * reserves the original box, so the tile blocks overflowed their column and
 * collided with the table; it also left every opponent's name upside-down or
 * sideways. Instead the backs are arranged to suit the edge and the name stays
 * upright, which is what you actually need to read mid-hand.
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
  // A hand is at most 17 tiles. Across the top there is room for a long run;
  // down the sides there is not, so they stack in a narrow block instead.
  const perRow = isVerticalEdge(edge) ? 3 : 9;

  return (
    <View style={[styles.opponent, isTurn && styles.opponentTurn]}>
      <View style={styles.opponentHeader}>
        <Text style={styles.opponentName} numberOfLines={1}>{name}</Text>
        {!connected && <Text style={styles.covering}>{strings.botCovering}</Text>}
      </View>

      <View style={[styles.backs, { maxWidth: perRow * MINI_PITCH }]}>
        {Array.from({ length: opponent.handCount }, (_, i) => (
          <Tile key={i} tile="1w" size="mini" faceUp={false} />
        ))}
      </View>

      {opponent.melds.length > 0 && (
        <View style={[styles.backs, { maxWidth: perRow * MINI_PITCH }]}>
          <MeldGroup melds={opponent.melds} size="mini" />
        </View>
      )}

      {opponent.flowers.length > 0 && (
        <View style={[styles.backs, { maxWidth: perRow * MINI_PITCH }]}>
          {opponent.flowers.map((f, i) => <Tile key={`${f}-${i}`} tile={f} size="mini" />)}
        </View>
      )}
    </View>
  );
}

/** Wall count, round wind, dealer and whose turn it is. */
export function CenterInfo({ view, seatNames }: {
  view: PlayerView;
  seatNames: Record<number, string>;
}): React.ReactElement {
  const turnName = seatNames[view.turn] ?? `Seat ${view.turn + 1}`;
  return (
    <View style={styles.center}>
      <Text style={styles.centerWind}>{view.roundWind}</Text>
      <Text style={styles.centerWall}>{strings.wallRemaining(view.wallCount)}</Text>
      <Text style={styles.centerTurn} numberOfLines={1}>
        {view.turn === view.seat ? strings.yourTurn : turnName}
      </Text>
      {view.lastDiscard && (
        <View style={styles.lastDiscard}>
          <Tile tile={view.lastDiscard.tile} size="discard" selected />
        </View>
      )}
    </View>
  );
}

/** A lobby seat card. */
export function SeatCard({
  seat, name, kind, connected, isHost, canEdit, onAddBot, onRemoveBot,
}: {
  seat: Seat;
  name: string;
  kind: 'human' | 'bot' | 'empty';
  connected: boolean;
  isHost: boolean;
  canEdit: boolean;
  onAddBot: (seat: Seat) => void;
  onRemoveBot: (seat: Seat) => void;
}): React.ReactElement {
  return (
    <View style={styles.seatCard}>
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
  backs: { flexDirection: 'row', flexWrap: 'wrap', gap: 1, marginTop: 2 },
  center: { alignItems: 'center', gap: tokens.space.xs },
  centerWind: { color: tokens.color.accentGold, fontSize: 28, fontWeight: '700' },
  centerWall: { color: tokens.color.textOnFelt, fontSize: 13 },
  centerTurn: { color: tokens.color.textMuted, fontSize: 12 },
  // Clear of the turn text above it — the raised tile's shadow crowded it.
  lastDiscard: { marginTop: tokens.space.s },
  seatCard: {
    backgroundColor: tokens.color.surfaceRaised,
    borderRadius: tokens.radius.m,
    padding: tokens.space.m,
    minHeight: 72,
    justifyContent: 'center',
    gap: tokens.space.xs,
  },
  seatName: { color: tokens.color.textOnFelt, fontSize: 16, fontWeight: '600' },
  seatAction: { color: tokens.color.accentGold, fontSize: 14 },
});
