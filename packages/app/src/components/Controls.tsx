import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Action } from '@mahjong/engine';
import { tokens } from '../theme/tokens';
import { strings, EMOTES } from '../strings';
import type { ActionBarModel } from '../state/selectors';

/** A big, unmissable button. Touch targets never go below `tokens.hitSlop`. */
export function Button({
  label, onPress, tone = 'primary', disabled = false, compact = false, testID,
}: {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  /** Tighter, for the vertical action stack where several share the height. */
  compact?: boolean;
  testID?: string;
}): React.ReactElement {
  const background = tone === 'primary'
    ? tokens.color.accentGold
    : tone === 'danger' ? tokens.color.danger : tokens.color.surfaceRaised;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        compact && styles.buttonCompact,
        { backgroundColor: background, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
      ]}
    >
      <Text style={[styles.buttonLabel, tone === 'primary' && styles.buttonLabelDark]}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * The action bar.
 *
 * Buttons come straight from `actionBarModel`, which is derived from
 * `view.legalActions` — so a button exists if and only if the server would
 * accept it. There is no client-side guess about what is legal.
 */
export function ActionBar({
  model, onAction, disabled, vertical = false,
}: {
  model: ActionBarModel;
  onAction: (action: Action) => void;
  disabled: boolean;
  /** Stack the buttons in a column instead of a row. The table uses this to
   *  put them up the right-hand side, directly above the hand. */
  vertical?: boolean;
}): React.ReactElement | null {
  const hasAnything =
    model.discard || model.win || model.pass ||
    model.claims.length > 0 || model.kongs.length > 0;
  if (!hasAnything && !model.needsSelection) return null;

  return (
    <View style={[styles.actionBar, vertical && styles.actionBarVertical]}>
      {model.win && (
        <Button
          label={model.win.label}
          tone="primary"
          disabled={disabled}
          onPress={() => onAction(model.win!.action)}
          compact={vertical}
          testID="action-win"
        />
      )}
      {model.claims.map((claim, i) => (
        <Button
          key={`${claim.label}-${i}`}
          label={claim.detail ? `${claim.label} ${claim.detail}` : claim.label}
          tone="secondary"
          disabled={disabled}
          onPress={() => onAction(claim.action)}
          compact={vertical}
          testID={`action-claim-${i}`}
        />
      ))}
      {model.kongs.map((kong, i) => (
        <Button
          key={`kong-${i}`}
          label={`${kong.label} ${kong.detail ?? ''}`.trim()}
          tone="secondary"
          disabled={disabled}
          onPress={() => onAction(kong.action)}
          compact={vertical}
          testID={`action-kong-${i}`}
        />
      ))}
      {model.pass && (
        <Button
          label={strings.pass}
          tone="secondary"
          disabled={disabled}
          onPress={() => onAction(model.pass!)}
          compact={vertical}
          testID="action-pass"
        />
      )}
      {model.needsSelection && (
        <Button
          label={strings.discard}
          tone="primary"
          disabled={disabled || !model.discard}
          onPress={() => model.discard && onAction(model.discard)}
          compact={vertical}
          testID="action-discard"
        />
      )}
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
  actionBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: tokens.space.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // A column that wraps into a SECOND column to the left when there are more
  // actions than fit the height, so a busy claim window can never run off the
  // top of the screen.
  actionBarVertical: {
    flexDirection: 'column',
    flexWrap: 'wrap',
    alignContent: 'flex-end',
    alignItems: 'stretch',
    justifyContent: 'flex-end',
    maxHeight: '100%',
  },
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
