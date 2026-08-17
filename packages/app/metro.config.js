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

module.exports = config;
