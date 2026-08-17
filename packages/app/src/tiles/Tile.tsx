import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { TileKind } from '@mahjong/engine';
import { TileFace } from './TileFace';
import { TILE_SIZES, tileHeight, tokens, type TileSizeName } from '../theme/tokens';

/**
 * A tile: the ivory body, a darker bottom edge for depth, and a face.
 *
 * The bottom edge strip does most of the work — it is what makes a flat
 * rectangle read as a physical object at 22px, where a drop shadow alone
 * disappears.
 */

export interface TileProps {
  tile: TileKind;
  size?: TileSizeName;
  faceUp?: boolean;
  selected?: boolean;
  disabled?: boolean;
  onPress?: (tile: TileKind) => void;
  testID?: string;
}

export function Tile({
  tile,
  size = 'hand',
  faceUp = true,
  selected = false,
  disabled = false,
  onPress,
  testID,
}: TileProps): React.ReactElement {
  const width = TILE_SIZES[size];
  const height = tileHeight(width);
  const edge = Math.max(3, height * 0.08);

  const body = (
    <View
      testID={testID}
      style={[
        styles.body,
        {
          width,
          height,
          borderRadius: tokens.tile.radius,
          backgroundColor: faceUp ? tokens.color.tileFace : tokens.color.tileBack,
          borderColor: selected ? tokens.color.accentGold : 'transparent',
          borderWidth: selected ? 2 : 0,
          // Lifting a selected tile is the clearest possible "this is the one
          // you are about to throw" without a label.
          transform: [{ translateY: selected ? -10 : 0 }],
        },
      ]}
    >
      {faceUp && <TileFace tile={tile} size={width - tokens.tile.faceInset * 2} />}
      <View
        style={[
          styles.edge,
          {
            height: edge,
            backgroundColor: faceUp ? tokens.color.tileFaceEdge : tokens.color.tableFeltEdge,
            borderBottomLeftRadius: tokens.tile.radius,
            borderBottomRightRadius: tokens.tile.radius,
          },
        ]}
      />
    </View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={() => onPress(tile)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={tile}
      style={({ pressed }) => ({ opacity: disabled ? 0.5 : pressed ? 0.8 : 1 })}
    >
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  body: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});
