import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import type { TileKind } from '@mahjong/engine';
import { TileFace } from './TileFace';
import { tileGeometry } from './tileGeometry';
import { TILE_SIZES, tileHeight, tokens, type TileSizeName } from '../theme/tokens';
import { MOTION, entrancePose, type EntranceKind } from '../theme/motion';
import type { Edge } from '../state/tableLayout';

/**
 * A tile: a physical object, not a card.
 *
 * Face up you see the ivory face and, along the bottom, the tile's thickness —
 * a band of ivory body over a band of green back, which is how a real
 * Taiwanese tile looks from the chair. Face down the top is the green back and
 * the visible edge is ivory: the edge turned toward you is the lit one, so it
 * stays ivory either way (drawn dark, it read as a shadow gnawing the bottom
 * off every tile across the table). A soft sheen across the top half is the
 * light from above.
 *
 * Motion lives here too, so every tile on the table moves the same way:
 *  - a selected tile rises on a quick spring and a gold halo breathes in;
 *  - a tile under the finger dips, like a key going down;
 *  - `entrance` plays once on mount — dealt, drawn, discarded or melded.
 * Under the OS's reduced-motion setting all of it snaps to rest instead.
 */

export interface TileEntrance {
  kind: EntranceKind;
  /** Which side of the table it comes from. Only discards use it. */
  from?: Edge;
  /** ms before it starts, for cascades like the deal. */
  delay?: number;
}

export interface TileProps {
  tile: TileKind;
  size?: TileSizeName;
  faceUp?: boolean;
  selected?: boolean;
  /**
   * Whether a selected tile also lifts off the table. True in your hand, where
   * it means "this is the one you are about to throw". False in a discard
   * pond: there the ring marks the newest tile, and lifting it pushed it up
   * behind the row above, which clipped it in half.
   */
  lift?: boolean;
  /** Explicit width, overriding `size`. Used by the hand, which shrinks its
   *  tiles to whatever the screen leaves beside the action stack. */
  width?: number;
  /**
   * Lay the tile down, wider than tall.
   *
   * The left and right players' tiles face THEM, so from your seat they are
   * turned ninety degrees. Only ever used for face-down backs, which have no
   * glyph to rotate with them.
   */
  landscape?: boolean;
  /** Animate in when mounted. Leave unset for tiles that were already there. */
  entrance?: TileEntrance;
  disabled?: boolean;
  onPress?: (tile: TileKind) => void;
  testID?: string;
}

export function Tile({
  tile,
  size = 'hand',
  faceUp = true,
  selected = false,
  lift = true,
  width: widthOverride,
  landscape = false,
  entrance,
  disabled = false,
  onPress,
  testID,
}: TileProps): React.ReactElement {
  const width = widthOverride ?? TILE_SIZES[size];
  // Upright a tile is taller than wide; laid down the ratio simply inverts.
  const height = landscape ? width * tokens.tile.aspect : tileHeight(width);
  const g = tileGeometry(width, height);
  const reduced = useReducedMotion();

  // The entrance's start pose, read once: these shared values are created at
  // the start pose and animated to rest, so the first frame is already right.
  const start = entrance && !reduced ? entrancePose(entrance.kind, entrance.from ?? 'bottom') : null;
  const enterX = useSharedValue(start?.translateX ?? 0);
  const enterY = useSharedValue(start?.translateY ?? 0);
  const enterScale = useSharedValue(start?.scale ?? 1);
  const opacity = useSharedValue(start?.opacity ?? 1);
  const liftY = useSharedValue(0);
  const press = useSharedValue(1);
  const halo = useSharedValue(selected ? 1 : 0);

  useEffect(() => {
    if (!start) return;
    const delay = entrance?.delay ?? 0;
    enterX.value = withDelay(delay, withSpring(0, MOTION.spring.land));
    enterY.value = withDelay(delay, withSpring(0, MOTION.spring.land));
    enterScale.value = withDelay(delay, withSpring(1, MOTION.spring.land));
    opacity.value = withDelay(delay, withTiming(1, { duration: MOTION.duration.fade }));
    // Mount-only by design: an entrance is a one-off, never replayed by a re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const raised = selected && lift ? -MOTION.lift : 0;
  useEffect(() => {
    liftY.value = reduced ? raised : withSpring(raised, MOTION.spring.lift);
    halo.value = reduced ? (selected ? 1 : 0) : withTiming(selected ? 1 : 0, { duration: MOTION.duration.fade });
  }, [raised, selected, reduced, liftY, halo]);

  const motionStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: enterX.value },
      { translateY: enterY.value + liftY.value },
      { scale: enterScale.value * press.value },
    ],
  }));
  const haloStyle = useAnimatedStyle(() => ({ opacity: halo.value }));

  const faceBottom = g.backBand + g.ivoryBand;
  const body = (
    <Animated.View style={[{ width, height }, motionStyle]}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { borderRadius: g.radius + HALO }, haloStyle]}
      />
      <View
        testID={testID}
        style={[
          styles.body,
          {
            width,
            height,
            borderRadius: g.radius,
            backgroundColor: faceUp ? tokens.color.tileBackBand : tokens.color.tileFaceEdge,
          },
        ]}
      >
        {faceUp ? (
          <>
            <View style={[styles.fill, { bottom: g.backBand, borderRadius: g.radius, backgroundColor: tokens.color.tileFaceEdge }]} />
            <View
              style={[
                styles.fill,
                styles.center,
                {
                  bottom: faceBottom,
                  borderRadius: g.radius,
                  backgroundColor: tokens.color.tileFace,
                  borderWidth: selected ? 1.5 : 0,
                  borderColor: tokens.color.accentGold,
                },
              ]}
            >
              <TileFace tile={tile} size={g.face.width} height={g.face.height} />
            </View>
            <Sheen radius={g.radius} height={(height - faceBottom) * 0.42} />
          </>
        ) : (
          <>
            <View
              style={[
                styles.fill,
                {
                  bottom: g.ivoryBand,
                  borderRadius: g.radius,
                  backgroundColor: tokens.color.tileBack,
                  borderWidth: selected ? 1.5 : 0,
                  borderColor: tokens.color.accentGold,
                },
              ]}
            />
            <Sheen radius={g.radius} height={(height - g.ivoryBand) * 0.42} />
          </>
        )}
      </View>
    </Animated.View>
  );

  if (!onPress) return body;

  return (
    <Pressable
      onPress={() => onPress(tile)}
      onPressIn={() => {
        if (!reduced) press.value = withTiming(MOTION.pressScale, { duration: MOTION.duration.press });
      }}
      onPressOut={() => {
        press.value = reduced ? 1 : withSpring(1, MOTION.spring.lift);
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={tile}
      accessibilityState={{ selected, disabled }}
      style={{ opacity: disabled ? 0.5 : 1 }}
    >
      {body}
    </Pressable>
  );
}

/** How far the selection halo spreads past the tile's edge, in px. */
const HALO = 3;

/** Light from above, across the top of the tile. Drawn over the art, very faint. */
function Sheen({ radius, height }: { radius: number; height: number }): React.ReactElement {
  return (
    <View
      pointerEvents="none"
      style={[
        styles.sheen,
        { height, borderTopLeftRadius: radius, borderTopRightRadius: radius },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  body: {
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fill: { position: 'absolute', top: 0, left: 0, right: 0 },
  center: { alignItems: 'center', justifyContent: 'center' },
  sheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: tokens.color.tileSheen,
    opacity: 0.5,
  },
  halo: {
    position: 'absolute',
    top: -HALO,
    left: -HALO,
    right: -HALO,
    bottom: -HALO,
    backgroundColor: tokens.color.tileHalo,
  },
});
