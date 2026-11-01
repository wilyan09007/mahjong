import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CANTONESE_MIN_FAAN_OPTIONS, type CantoneseRules, type VariantId } from '@mahjong/engine';
import { tokens } from '../theme/tokens';
import { strings } from '../strings';

/**
 * The house rules in the lobby: the ruleset, then — for Hong Kong — its four
 * options, as rows of small chips under the seat cards.
 *
 * Chips rather than full buttons because the lobby has no height to spare on a
 * landscape phone: the controls column is full, and full-size buttons for five
 * choices would push the last seat off the screen. A chip draws `CHIP_ROW` tall
 * but is touched `CHIP_HIT_SLOP` beyond that on each side.
 */

export const CHIP_ROW = 30;
export const CHIP_HIT_SLOP = 6;

function Chips<T extends string | number | boolean>({
  label, options, value, onChange, testID,
}: {
  label: string;
  options: { value: T; text: string }[];
  value: T;
  onChange: (value: T) => void;
  testID: string;
}): React.ReactElement {
  return (
    <View style={styles.group}>
      <Text style={styles.label}>{label}</Text>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={String(o.value)}
            onPress={() => onChange(o.value)}
            hitSlop={CHIP_HIT_SLOP}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            testID={`${testID}-${String(o.value)}`}
            style={[styles.chip, on && styles.chipOn]}
          >
            <Text style={[styles.chipText, on && styles.chipTextOn]}>{o.text}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function RuleChips({
  variant, cantonese, onVariant, onCantonese,
}: {
  variant: VariantId;
  cantonese: CantoneseRules;
  onVariant: (v: VariantId) => void;
  onCantonese: (change: Partial<CantoneseRules>) => void;
}): React.ReactElement {
  return (
    <View style={styles.rules}>
      <View style={styles.row}>
        <Chips
          label=""
          testID="ruleset"
          value={variant}
          onChange={onVariant}
          options={(['taiwanese', 'cantonese'] as const).map((v) => ({
            value: v, text: `${strings.ruleset[v]} · ${strings.rulesetDetail[v]}`,
          }))}
        />
      </View>
      {variant === 'cantonese' && (
        <>
          <View style={styles.row}>
            <Chips
              label={strings.minFaan}
              testID="min-faan"
              value={cantonese.minFaan}
              onChange={(minFaan) => onCantonese({ minFaan })}
              options={CANTONESE_MIN_FAAN_OPTIONS.map((n) => ({ value: n as number, text: n === 0 ? strings.anyHand : String(n) }))}
            />
            <Chips
              label={strings.maxFaan}
              testID="max-faan"
              value={cantonese.maxFaan}
              onChange={(maxFaan) => onCantonese({ maxFaan })}
              options={[10, 13].map((n) => ({ value: n as 10 | 13, text: String(n) }))}
            />
          </View>
          <View style={styles.row}>
            <Chips
              label={strings.payment}
              testID="payment"
              value={cantonese.payment}
              onChange={(payment) => onCantonese({ payment })}
              options={(['half', 'full'] as const).map((p) => ({ value: p, text: strings.paymentName[p] }))}
            />
            <Chips
              label={strings.sevenPairs}
              testID="seven-pairs"
              value={cantonese.sevenPairs}
              onChange={(sevenPairs) => onCantonese({ sevenPairs })}
              options={[{ value: true, text: strings.on }, { value: false, text: strings.off }]}
            />
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  rules: { gap: 6, marginTop: tokens.space.s },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: tokens.space.s, minHeight: CHIP_ROW },
  group: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  label: { color: tokens.color.textMuted, fontSize: 12, marginRight: 2 },
  chip: {
    height: CHIP_ROW,
    paddingHorizontal: 10,
    borderRadius: CHIP_ROW / 2,
    justifyContent: 'center',
    backgroundColor: tokens.color.surfaceRaised,
  },
  chipOn: { backgroundColor: tokens.color.accentGold },
  chipText: { color: tokens.color.textOnFelt, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: tokens.color.inkPrimary },
});
