module.exports = {
  preset: 'jest-expo',
  // pnpm nests real packages at
  //   node_modules/.pnpm/<name>@<version>_<hash>/node_modules/<name>/...
  // so jest-expo's stock pattern — which assumes `node_modules/<name>` — fails
  // to match and leaves React Native's own ESM preset untransformed. Matching
  // the package name ANYWHERE in the path handles both layouts.
  //
  // `@mahjong/*` is included because workspace packages are published as
  // TypeScript source and must be transformed like first-party code.
  transformIgnorePatterns: [
    'node_modules/(?!.*(react-native|@react-native|expo|@expo|@mahjong|colyseus|zustand))',
  ],
  // The engine is TypeScript written in ESM style, so its internal imports say
  // `./tiles.js` while the file on disk is `./tiles.ts`. Node and Metro resolve
  // that; Jest does not, so strip the extension off relative imports.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  testMatch: ['**/test/**/*.test.ts', '**/test/**/*.test.tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
