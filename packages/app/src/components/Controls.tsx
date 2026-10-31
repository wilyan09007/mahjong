import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Action, TileKind } from '@mahjong/engine';
import { tokens } from '../theme/tokens';
import { EMOTES } from '../strings';
import { actionButtons, type ActionBarModel } from '../state/selectors';
import { ACTION_SIZES, layoutActionRow, type ActionSize } from '../state/actionRow';
import { Tile } from '../tiles/Tile';

/**
 * A big, unmissable button. Touch targets never go below `tokens.hitSlop`:
 * the action row's smaller sizes draw smaller but extend their touch area by
 * `hitSlop`, so a squeezed row is no harder to hit.
 */
export function Button({
  label, onPress, tone = 'primary', disabled = false, compact = false, size, tiles = [], testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  /** Tighter, for places where several share a line. */
  compact?: boolean;
  /** One of the action row's sizes; overrides `compact`. */
  size?: ActionSize;
  /** Small tiles drawn after the label — a chow's run, a kong's tile. */
  tiles?: TileKind[];
  testID?: string;
}): React.ReactElement {
  const background = tone === 'primary'
    ? tokens.color.accentGold
    : tone === 'danger' ? tokens.color.danger : tokens.color.surfaceRaised;
  const metrics = size ? ACTION_SIZES[size] : null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={tiles.length > 0 ? `${label} ${tiles.join(' ')}` : undefined}
      hitSlop={metrics?.hitSlop}
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        metrics && { minHeight: metrics.height, paddingHorizontal: metrics.padH },
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.buttonInner}>
        <Text
          style={[
            styles.buttonLabel,
            tone === 'primary' && styles.buttonLabelDark,
            metrics && { fontSize: metrics.fontSize },
          ]}
        >
          {label}
        </Text>
        {tiles.length > 0 && (
          <View style={styles.buttonTiles}>
            {tiles.map((t, i) => (
              <Tile key={`${t}-${i}`} tile={t} width={metrics?.tile ?? ACTION_SIZES.regular.tile} />
            ))}
          </View>
        )}
      </View>
    </Pressable>
  );
}

/**
 * The action buttons, side by side in the row above my hand.
 *
 * Buttons come straight from `actionBarModel`, which is derived from
 * `view.legalActions` — so a button exists if and only if the server would
 * accept it. There is no client-side guess about what is legal. How they fit
 * `available` is `layoutActionRow`'s call: smaller only if that makes one row,
 * otherwise rows stacking upward, the primary action always bottom-right.
 */
export function ActionBar({
  model, onAction, disabled, available = Number.POSITIVE_INFINITY,
}: {
  model: ActionBarModel;
  onAction: (action: Action) => void;
  disabled: boolean;
  /** Width the row may take, in px. */
  available?: number;
}): React.ReactElement | null {
  const buttons = actionButtons(model);
  if (buttons.length === 0) return null;
  const layout = layoutActionRow(buttons.map((b) => ({ label: b.label, tiles: b.tiles.length })), available);

  return (
    <View style={styles.actionRows}>
      {layout.rows.map((row, r) => (
        <View key={r} style={styles.actionRow}>
          {row.map((i) => {
            const b = buttons[i]!;
            return (
              <Button
                key={b.testID}
                label={b.label}
                tone={b.tone}
                tiles={b.tiles}
                size={layout.size}
                disabled={disabled || !b.action}
                onPress={() => b.action && onAction(b.action)}
                testID={b.testID}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

/** Eight fixed emoji. No free text, so there is nothing to moderate. */
export function EmotePicker({ onSend, disabled }: {
  onSend: (emote: string) => void;
  disabled?: boolean;
}): React.ReactElement {
  return (
    <View style={styles.emoteRow}>
      {EMOTES.map((emote) => (
        <Pressable
          key={emote}
          onPress={() => onSend(emote)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityLabel={`emote ${emote}`}
          style={styles.emote}
        >
          <Text style={styles.emoteText}>{emote}</Text>
        </Pressable>
      ))}
    </View>
  );
}

/** Transient error banner. The server re-sends the truth, so this just informs. */
export function ErrorToast({ message, onDismiss }: {
  message: string | null;
  onDismiss: () => void;
}): React.ReactElement | null {
  if (!message) return null;
  return (
    <Pressable style={styles.toast} onPress={onDismiss} accessibilityRole="alert">
      <Text style={styles.toastText}>{message}</Text>
    </Pressable>
  );
}

/** Countdown ring for a claim window. */
export function ClaimCountdown({ seconds, remaining }: {
  seconds: number;
  remaining: number;
}): React.ReactElement | null {
  if (seconds <= 0) return null;
  const fraction = Math.max(0, Math.min(1, remaining / seconds));
  return (
    <View style={styles.countdownTrack}>
      <View style={[styles.countdownFill, { width: `${fraction * 100}%` }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: tokens.hitSlop + 12,
    paddingHorizontal: tokens.space.l,
    borderRadius: tokens.radius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonLabel: { color: tokens.color.textOnFelt, fontSize: 17, fontWeight: '700' },
  buttonLabelDark: { color: tokens.color.inkPrimary },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  buttonTiles: { flexDirection: 'row', gap: 1 },
  // Rows stack UPWARD from the hand: the first row is the bottom one.
  actionRows: { flexDirection: 'column-reverse', alignItems: 'flex-end', gap: tokens.space.xs },
  actionRow: { flexDirection: 'row', gap: tokens.space.s, justifyContent: 'flex-end', alignItems: 'center' },
  buttonCompact: {
    minHeight: tokens.hitSlop,
    paddingHorizontal: tokens.space.m,
  },
  emoteRow: { flexDirection: 'row', gap: tokens.space.xs },
  emote: { padding: tokens.space.xs },
  emoteText: { fontSize: 22 },
  toast: {
    position: 'absolute',
    top: tokens.space.m,
    alignSelf: 'center',
    backgroundColor: tokens.color.danger,
    paddingHorizontal: tokens.space.l,
    paddingVertical: tokens.space.s,
    borderRadius: tokens.radius.m,
    maxWidth: '90%',
  },
  toastText: { color: tokens.color.textOnFelt, fontSize: 14 },
  countdownTrack: {
    height: 4,
    backgroundColor: tokens.color.surfaceRaised,
    borderRadius: 2,
    overflow: 'hidden',
    width: 160,
  },
  countdownFill: { height: 4, backgroundColor: tokens.color.accentGold },
});
