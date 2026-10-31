import React, { useEffect } from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing, ReduceMotion, useAnimatedStyle, useReducedMotion, useSharedValue, withDelay, withRepeat,
  withSequence, withSpring, withTiming,
} from 'react-native-reanimated';
import { TABLE_ZONES, tokens } from '../theme/tokens';
import { MOTION } from '../theme/motion';
import type { Edge } from '../state/tableLayout';

/**
 * The table's non-tile motion: things appearing, the turn indicator breathing,
 * and the call-outs stamped onto the felt when someone claims or wins.
 */

/** Fades and springs its children in once, on mount. */
export function Appear({
  children, delay = 0, style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const shown = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) shown.value = withDelay(delay, withSpring(1, MOTION.spring.land));
  }, [reduced, delay, shown]);
  const animated = useAnimatedStyle(() => ({
    opacity: Math.min(1, shown.value * 1.4),
    transform: [{ translateY: (1 - shown.value) * 14 }, { scale: 0.9 + 0.1 * shown.value }],
  }));
  return <Animated.View style={[style, animated]}>{children}</Animated.View>;
}

/**
 * A gold ring that breathes while it is someone's turn. A static border was
 * easy to miss across the table; a slow pulse is caught by peripheral vision
 * without demanding attention.
 */
export function TurnGlow({ radius }: { radius: number }): React.ReactElement {
  const reduced = useReducedMotion();
  const glow = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    const half = MOTION.duration.turnPulse / 2;
    const ease = Easing.inOut(Easing.sin);
    glow.value = withRepeat(withSequence(
      withTiming(0.35, { duration: half, easing: ease }),
      withTiming(1, { duration: half, easing: ease }),
    ), -1);
  }, [reduced, glow]);
  const animated = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.turnGlow, { borderRadius: radius }, animated]}
    />
  );
}

/**
 * Three dots rising and falling in turn: "this player is deciding". Shown by
 * an opponent's name on their turn and through claim windows, so a bot's
 * pause reads as thinking rather than as the game having stalled. Under
 * reduced motion they stay still.
 */
export function ThinkingDots(): React.ReactElement {
  return (
    <View style={styles.dots} accessibilityLabel="thinking">
      {[0, 1, 2].map((i) => <Dot key={i} index={i} />)}
    </View>
  );
}

function Dot({ index }: { index: number }): React.ReactElement {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    const half = MOTION.duration.thinkingDot / 2;
    t.value = withDelay(index * (half / 2), withRepeat(withSequence(
      withTiming(1, { duration: half, easing: Easing.inOut(Easing.quad) }),
      withTiming(0, { duration: half, easing: Easing.inOut(Easing.quad) }),
    ), -1));
  }, [reduced, index, t]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.35 + 0.65 * t.value,
    transform: [{ translateY: -2.5 * t.value }],
  }));
  return <Animated.View style={[styles.dot, style]} />;
}

/** Where a seat's call-out lands: in front of that player, toward the middle. */
function anchorFor(edge: Edge, big: boolean): ViewStyle {
  if (big) return styles.anchorCentre;
  switch (edge) {
    case 'bottom': return { ...styles.anchorRow, bottom: TABLE_ZONES.bottom - 6 };
    case 'top': return { ...styles.anchorRow, top: TABLE_ZONES.top + 2 };
    case 'left': return { ...styles.anchorColumn, left: TABLE_ZONES.side + 14 };
    case 'right': return { ...styles.anchorColumn, right: TABLE_ZONES.side + 14 };
  }
}

/** Sparks thrown off a win, as angles around the stamp. */
const SPARKS = Array.from({ length: 12 }, (_, i) => (i / 12) * Math.PI * 2);

/**
 * A call stamped onto the table — 碰, 槓, 胡, 自摸 — the words a real table
 * says aloud. It lands like a seal: dropped from slightly above, big, and
 * pressed down to size, with a gold ring rippling out. A win is larger and
 * throws sparks. Then it lifts away on its own after `hold`.
 */
export function Callout({
  text, name, edge, big = false, muted = false,
}: {
  text: string;
  name: string;
  edge: Edge;
  big?: boolean;
  muted?: boolean;
}): React.ReactElement {
  const reduced = useReducedMotion();
  const hold = big ? MOTION.duration.winHold : MOTION.duration.calloutHold;
  const stamp = useSharedValue(reduced ? 1 : 0);
  const ripple = useSharedValue(0);
  const away = useSharedValue(0);

  useEffect(() => {
    if (!reduced) {
      stamp.value = withSpring(1, MOTION.spring.stamp);
      if (!muted) ripple.value = withDelay(80, withTiming(1, { duration: 700, easing: Easing.out(Easing.cubic) }));
    }
    // Under the OS's reduced-motion setting Reanimated jumps animations straight
    // to their end — delays included — which hid the call-out the instant it
    // appeared. It is information, not decoration, and a fade is not motion,
    // so the hold-then-fade always runs in full. (On web `useReducedMotion` can
    // report false while the setting is on, so this cannot rely on it.)
    away.value = withDelay(
      hold,
      withTiming(1, { duration: MOTION.duration.fade, reduceMotion: ReduceMotion.Never }),
      ReduceMotion.Never,
    );
  }, [reduced, muted, hold, stamp, ripple, away]);

  const size = big ? 116 : 62;
  const discStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, stamp.value * 3) * (1 - away.value),
    transform: [
      { scale: (1.7 - 0.7 * stamp.value) * (1 - 0.12 * away.value) },
      { rotate: `${(1 - stamp.value) * -10}deg` },
    ],
  }));
  const rippleStyle = useAnimatedStyle(() => ({
    opacity: ripple.value > 0 ? (1 - ripple.value) * 0.85 : 0,
    transform: [{ scale: 0.9 + ripple.value * 1.3 }],
  }));
  const nameStyle = useAnimatedStyle(() => ({ opacity: Math.min(1, stamp.value) * (1 - away.value) }));
  // A win dims the table behind it for a beat: for that moment it is the only
  // thing on the screen worth looking at.
  const hushStyle = useAnimatedStyle(() => ({ opacity: 0.6 * Math.min(1, stamp.value * 2) * (1 - away.value) }));

  const glyphSize = (big ? 46 : 32) * (text.length > 1 ? 0.78 : 1);
  return (
    <View pointerEvents="none" style={[styles.anchor, anchorFor(edge, big)]}>
      {big && !muted && <Animated.View style={[StyleSheet.absoluteFill, styles.hush, hushStyle]} />}
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Animated.View
          style={[styles.ripple, { width: size, height: size, borderRadius: size / 2 }, rippleStyle]}
        />
        {big && !muted && SPARKS.map((angle, i) => (
          <Spark key={i} angle={angle} reach={size * 0.95} delay={60 + (i % 3) * 40} />
        ))}
        <Animated.View
          style={[
            styles.disc,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: muted ? tokens.color.calloutMuted : tokens.color.calloutDisc,
              borderColor: muted ? tokens.color.textMuted : tokens.color.accentGold,
              borderWidth: big ? 4 : 3,
            },
            discStyle,
          ]}
        >
          <Text
            style={[styles.glyph, { fontSize: glyphSize, lineHeight: glyphSize * 1.15 }]}
            allowFontScaling={false}
          >
            {text}
          </Text>
        </Animated.View>
      </View>
      {name !== '' && (
        <Animated.Text style={[styles.calloutName, nameStyle]} numberOfLines={1}>{name}</Animated.Text>
      )}
    </View>
  );
}

/** One spark: a small gold diamond flung outward and fading. */
function Spark({ angle, reach, delay }: { angle: number; reach: number; delay: number }): React.ReactElement {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withTiming(1, { duration: 750, easing: Easing.out(Easing.quad) }));
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({
    opacity: t.value === 0 ? 0 : 1 - t.value,
    transform: [
      { translateX: Math.cos(angle) * reach * t.value },
      { translateY: Math.sin(angle) * reach * t.value },
      { rotate: '45deg' },
      { scale: 1 - 0.5 * t.value },
    ],
  }));
  return <Animated.View style={[styles.spark, style]} />;
}

const styles = StyleSheet.create({
  turnGlow: { borderWidth: 2, borderColor: tokens.color.accentGold },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 2, height: 12 },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: tokens.color.accentGold },
  hush: { backgroundColor: tokens.color.overlayScrim, opacity: 0 },
  anchor: { position: 'absolute', alignItems: 'center', justifyContent: 'center', gap: 4 },
  anchorRow: { left: 0, right: 0 },
  anchorColumn: { top: 0, bottom: 0 },
  anchorCentre: { top: 0, bottom: 0, left: 0, right: 0 },
  disc: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  glyph: {
    color: tokens.color.calloutGlyph,
    fontFamily: tokens.font.cjk,
    textAlign: 'center',
    includeFontPadding: false,
  },
  ripple: { position: 'absolute', borderWidth: 3, borderColor: tokens.color.accentGold },
  spark: {
    position: 'absolute',
    width: 7,
    height: 7,
    backgroundColor: tokens.color.accentGold,
  },
  calloutName: {
    color: tokens.color.textOnFelt,
    backgroundColor: tokens.color.overlayScrim,
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    overflow: 'hidden',
    maxWidth: 140,
  },
});
