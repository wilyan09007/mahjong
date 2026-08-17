import { describe, expect, it } from 'vitest';
import {
  addedKongOptions, canExposedKong, canPung, chowOptions, concealedKongOptions,
  type Meld,
} from '../src/melds.js';

describe('chowOptions', () => {
  it('finds all run completions', () => {
    expect(chowOptions(['1w', '2w', '4w', '5w'], '3w')).toEqual([
      ['1w', '2w'], ['2w', '4w'], ['4w', '5w'],
    ]);
  });
  it('never chows honors or across suits', () => {
    expect(chowOptions(['we', 'ws'], 'ww')).toEqual([]);
    expect(chowOptions(['1w', '2t'], '3b')).toEqual([]);
  });
  it('deduplicates identical options', () => {
    expect(chowOptions(['4t', '4t', '5t'], '6t')).toEqual([['4t', '5t']]);
  });
  it('does not run off either end of a suit', () => {
    // 1b can only be the low end: 2b3b. There is no 0b or -1b.
    expect(chowOptions(['2b', '3b', '9b'], '1b')).toEqual([['2b', '3b']]);
    // 9b can only be the high end: 7b8b.
    expect(chowOptions(['7b', '8b', '1b'], '9b')).toEqual([['7b', '8b']]);
  });
  it('will not build a run out of a flower', () => {
    expect(chowOptions(['f1', 'f2', '1w'], 'f3')).toEqual([]);
  });
  it('returns nothing when the hand cannot reach the tile', () => {
    expect(chowOptions(['1w', '9w'], '5w')).toEqual([]);
  });
});

describe('pung and kong', () => {
  it('pung needs two matching in hand', () => {
    expect(canPung(['dr', 'dr', '1w'], 'dr')).toBe(true);
    expect(canPung(['dr', '1w'], 'dr')).toBe(false);
  });
  it('exposed kong needs three matching in hand', () => {
    expect(canExposedKong(['5b', '5b', '5b'], '5b')).toBe(true);
    expect(canExposedKong(['5b', '5b'], '5b')).toBe(false);
  });
  it('three in hand can also pung — a kong is a choice, not a requirement', () => {
    expect(canPung(['5b', '5b', '5b'], '5b')).toBe(true);
  });
  it('concealed kong lists kinds held four times', () => {
    expect(concealedKongOptions(['9t', '9t', '9t', '9t', '1w'])).toEqual(['9t']);
  });
  it('concealed kong finds every eligible kind and ignores triples', () => {
    expect(concealedKongOptions([
      '9t', '9t', '9t', '9t', 'we', 'we', 'we', 'we', '1w', '1w', '1w',
    ])).toEqual(['9t', 'we']);
    expect(concealedKongOptions(['1w', '1w', '1w'])).toEqual([]);
  });
  it('added kong requires an existing exposed pung plus the 4th tile', () => {
    const melds: Meld[] = [
      { type: 'pung', tiles: ['ww', 'ww', 'ww'], concealed: false, claimedFrom: 2 },
    ];
    expect(addedKongOptions(['ww', '3b'], melds)).toEqual(['ww']);
    expect(addedKongOptions(['3b'], melds)).toEqual([]);
  });
  it('added kong ignores chow melds and melds that are already kongs', () => {
    const melds: Meld[] = [
      { type: 'chow', tiles: ['1w', '2w', '3w'], concealed: false, claimedFrom: 1 },
      { type: 'kong', tiles: ['dg', 'dg', 'dg', 'dg'], concealed: true, claimedFrom: null },
    ];
    expect(addedKongOptions(['1w', 'dg'], melds)).toEqual([]);
  });
});
