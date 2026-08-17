/**
 * Jest setup.
 *
 * Only Expo's own native modules are substituted here, and only because they
 * have no JS implementation off-device — there is no way to run
 * `expo-crypto`'s native randomUUID in Node. Nothing about the app's own logic
 * is mocked: the store, selectors, layout and tile data are all exercised for
 * real, and `@mahjong/engine` runs its genuine implementation.
 */

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: async (k: string) => store.get(k) ?? null,
      setItem: async (k: string, v: string) => {
        store.set(k, v);
      },
      removeItem: async (k: string) => {
        store.delete(k);
      },
      clear: async () => {
        store.clear();
      },
    },
  };
});

jest.mock('expo-crypto', () => ({
  __esModule: true,
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
}));
