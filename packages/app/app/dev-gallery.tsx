import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FLOWERS, NON_FLOWER_KINDS } from '@mahjong/engine';
import { Tile } from '../src/tiles/Tile';
import { MeldGroup, OpponentPanel } from '../src/components/Board';
import { TABLE_ZONES, tokens } from '../src/theme/tokens';

/**
 * Every tile at every size, plus the board pieces with fake data.
 *
 * This is the screen the art gets judged on: the geometry tests prove dots do
 * not overlap and glyphs are non-empty, but only a human eye can say whether a
 * 22px 九萬 is still legible. Open `/dev-gallery` on a device to check.
 */
export default function DevGalleryScreen(): React.ReactElement {
  const all = [...NON_FLOWER_KINDS, ...FLOWERS];
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
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
      <Text style={styles.heading}>Opponent panels — heavily exposed hand</Text>
      <View style={styles.panels}>
        {(['left', 'top', 'right'] as const).map((edge) => (
          <View key={edge} style={styles.panelSlot}>
            <View style={edge === 'top' ? undefined : styles.rimWidth}>
              <OpponentPanel
                opponent={SAMPLE_OPPONENT}
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
    </ScrollView>
  );
}

const SAMPLE_MELDS = [
  { type: 'chow', tiles: ['2w', '3w', '4w'], concealed: false, claimedFrom: 1 },
  { type: 'pung', tiles: ['dr', 'dr', 'dr'], concealed: false, claimedFrom: 2 },
  { type: 'kong', tiles: ['5t', '5t', '5t', '5t'], concealed: true, claimedFrom: null },
] as unknown as React.ComponentProps<typeof MeldGroup>['melds'];

/** Four melds and four flowers — about the worst a rim ever has to hold. */
const SAMPLE_OPPONENT = {
  seat: 1,
  handCount: 5,
  melds: [
    ...SAMPLE_MELDS,
    { type: 'pung', tiles: ['9b', '9b', '9b'], concealed: false, claimedFrom: 3 },
  ],
  flowers: ['f1', 'f2', 'f3', 'f4'],
  discards: [],
} as unknown as React.ComponentProps<typeof OpponentPanel>['opponent'];

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.tableFelt },
  content: { padding: tokens.space.m, gap: tokens.space.m },
  heading: { color: tokens.color.accentGold, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  panels: { flexDirection: 'row', gap: tokens.space.l, alignItems: 'flex-start' },
  panelSlot: { alignItems: 'center', gap: tokens.space.xs },
  // Exactly the rim the table gives a side seat, so overflow shows up here.
  rimWidth: { width: TABLE_ZONES.side, alignItems: 'center' },
  caption: { color: tokens.color.textMuted, fontSize: 12 },
});
