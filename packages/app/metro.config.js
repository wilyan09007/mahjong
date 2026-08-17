// Metro, configured for a pnpm workspace.
//
// The app imports `@mahjong/engine` straight from TypeScript source in a
// sibling package. Metro only watches the project folder by default, so
// without `watchFolders` it cannot see the engine at all, and without the
// extra `nodeModulesPaths` it cannot resolve dependencies pnpm hoisted to the
// workspace root.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];
// pnpm links packages rather than copying them; Metro must follow the links.
config.resolver.unstable_enableSymlinks = true;
config.resolver.disableHierarchicalLookup = true;

// The engine and the app's own modules are TypeScript written in ESM style, so
// a relative import says `./tiles.js` while the file on disk is `./tiles.ts`.
// Node and tsc resolve that; Metro does not — it looks for a literal `.js` and
// fails the bundle. Strip the extension so the `.ts`/`.tsx` is found.
// Jest solves the same problem with the moduleNameMapper in `jest.config.js`.
//
// Scoped to OUR source: inside node_modules a `.js` specifier means a real
// `.js` file and rewriting it does damage. `merge-options/index.mjs` is the
// worked example — it imports `./index.js`, and the extensionless form
// resolves back through the package's own `exports` map to `index.mjs`, so the
// module becomes its own dependency and its default export is `undefined`.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolve = defaultResolveRequest ?? context.resolveRequest;
  const firstParty = !context.originModulePath.includes('node_modules');
  if (firstParty && moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return resolve(context, moduleName.slice(0, -'.js'.length), platform);
    } catch {
      // Not a TypeScript source file — resolve the specifier as written.
    }
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
