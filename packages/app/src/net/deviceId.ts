/**
 * Device-generated identity. No accounts in v1 (per the spec).
 *
 * The id is the seat key the server reconnects you by, so it must survive app
 * restarts — hence AsyncStorage rather than a module variable. It identifies a
 * device, not a person: nothing else is stored, and it is never shared with a
 * third party.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { randomUUID } from 'expo-crypto';

const PLAYER_ID_KEY = 'mahjong.playerId';
const NAME_KEY = 'mahjong.displayName';

export async function getDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(PLAYER_ID_KEY);
  if (existing) return existing;
  const created = randomUUID();
  await AsyncStorage.setItem(PLAYER_ID_KEY, created);
  return created;
}

export async function getDisplayName(): Promise<string | null> {
  return AsyncStorage.getItem(NAME_KEY);
}

export async function setDisplayName(name: string): Promise<void> {
  await AsyncStorage.setItem(NAME_KEY, name);
}
