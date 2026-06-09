const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('node:path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

const nativeWindConfig = withNativeWind(config, { input: './global.css' });

// In this pnpm monorepo, @smartresidence/api-client (and other shared libs) are
// consumed by BOTH the web app (React 18) and the mobile app (React 19). A
// workspace package can only have ONE physical node_modules/react, and pnpm
// resolves the shared package's `react` peer to React 18 (anchored by the web
// app). When mobile imports api-client's React Query hooks, Metro would bundle a
// SECOND React (18.3.1) and a SECOND @tanstack/react-query context next to the
// app's React 19 — producing "Invalid hook call" and
// "Cannot read property 'useContext' of null" at runtime.
//
// Forcing these packages to always resolve from the mobile app's own copy
// guarantees a single React / renderer / Query context in the iOS/Android
// bundle. This is scoped to the mobile Metro build, so it does not affect the
// web or docs apps (which legitimately run React 18).
const forceSingletons = [
  'react',
  'react-dom',
  'react-native',
  '@tanstack/react-query',
  'react-native-reanimated',
  'react-native-worklets',
];
const singletonPrefixes = forceSingletons.map((name) => `${name}/`);
const singletonOriginModulePath = path.join(projectRoot, 'index.js');
const upstreamResolveRequest = nativeWindConfig.resolver.resolveRequest;

nativeWindConfig.resolver.resolveRequest = (context, moduleName, platform) => {
  const isSingleton =
    forceSingletons.includes(moduleName) ||
    singletonPrefixes.some((prefix) => moduleName.startsWith(prefix));

  if (isSingleton) {
    return context.resolveRequest(
      { ...context, originModulePath: singletonOriginModulePath },
      moduleName,
      platform,
    );
  }

  return (upstreamResolveRequest ?? context.resolveRequest)(context, moduleName, platform);
};

module.exports = nativeWindConfig;
