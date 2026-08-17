import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { FLOWERS, NON_FLOWER_KINDS } from '@mahjong/engine';
import { Tile } from '../src/tiles/Tile';
import { MeldGroup } from '../src/components/Board';
import { tokens } from '../src/theme/tokens';

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
      <MeldGroup
        melds={[
          { type: 'chow', tiles: ['2w', '3w', '4w'], concealed: false, claimedFrom: 1 },
          { type: 'pung', tiles: ['dr', 'dr', 'dr'], concealed: false, claimedFrom: 2 },
          { type: 'kong', tiles: ['5t', '5t', '5t', '5t'], concealed: true, claimedFrom: null },
        ]}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: tokens.color.tableFelt },
  content: { padding: tokens.space.m, gap: tokens.space.m },
  heading: { color: tokens.color.accentGold, fontSize: 16, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
});
