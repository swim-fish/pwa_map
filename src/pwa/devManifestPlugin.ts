import type { IncomingMessage, ServerResponse } from 'node:http';

// A Vite plugin shape — kept loose because importing the full Vite
// `Plugin` type would force the test suite to take a Vite dep just for
// types. The runtime contract is what matters.
export interface VitePluginLike {
  name: string;
  apply: 'serve' | 'build';
  configureServer?: (server: {
    middlewares: {
      use: (
        path: string,
        handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
      ) => void;
    };
  }) => void;
}

/**
 * Dev-only Vite plugin that serves /manifest.webmanifest as JSON during
 * `vite dev`. Fixes the `manifest.webmanifest:1 Syntax error` console
 * entry caused by the SPA fallback returning HTML for that URL when
 * `devOptions.enabled` is false.
 *
 * Production builds are unaffected — this plugin sets `apply: 'serve'`
 * so it never runs during `vite build`. vite-plugin-pwa continues to
 * write `dist/manifest.webmanifest` from the same `manifest` object.
 *
 * See contracts/dev-manifest-middleware.md for the full contract.
 */
export function devManifestPlugin(manifest: object): VitePluginLike {
  return {
    name: 'pwa-map:dev-manifest',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/manifest.webmanifest', (req, res, next) => {
        if (req.method !== 'GET') return next();
        res.setHeader('Content-Type', 'application/manifest+json');
        res.setHeader('Cache-Control', 'no-cache');
        res.end(JSON.stringify(manifest));
      });
    },
  };
}
