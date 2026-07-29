/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string;
};

/**
 * `virtual:pwa-register/react` imports `workbox-window` as though it were ours.
 * It is vite-plugin-pwa's peer dependency, and pnpm's strict layout keeps it out
 * of the root `node_modules`, so Rollup cannot resolve it from a virtual module
 * that claims to live at the project root. Borrow the plugin's own copy.
 *
 * Delete this the day `workbox-window` is added as a direct devDependency.
 */
const requireFromConfig = createRequire(import.meta.url);
const requireFromPlugin = createRequire(requireFromConfig.resolve('vite-plugin-pwa'));
const WORKBOX_WINDOW = dirname(requireFromPlugin.resolve('workbox-window/package.json'));

/**
 * UI_DESIGN.md §2 `--canvas`. The pre-hydration splash in index.html already
 * paints this, so the install splash, the address bar and first paint all agree
 * — an installed game that flashes white on launch reads as broken.
 */
const CANVAS = '#0e1420';

const VENDOR = /[/\\]node_modules[/\\](react|react-dom|scheduler)[/\\]/;
const STORE = /[/\\]node_modules[/\\](zustand|immer|dexie|zod)[/\\]/;
const DATA = /[/\\]src[/\\](content|i18n)[/\\]/;

/**
 * Three cuts, by how often the bytes change (TECHNICAL_ARCHITECTURE.md §9 perf
 * budget). React and the persistence stack move on dependency bumps; the
 * catalogs and the string table move on content patches; everything else moves
 * every commit. Splitting on that seam keeps a balance tweak from invalidating
 * 700 kB of cache — and keeps every chunk under Rollup's 500 kB warning.
 */
function manualChunks(id: string): string | undefined {
  if (VENDOR.test(id)) return 'vendor';
  if (STORE.test(id)) return 'store';
  if (DATA.test(id)) return 'content';
  return undefined;
}

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // 'prompt', never 'autoUpdate': a silent reload mid-mission would look
      // like a crash. The player accepts the patch (UpdateToast, §12).
      registerType: 'prompt',
      // The globs below are the single statement of what the shell is, and the
      // icon is already one of them — don't let the manifest add it twice.
      includeManifestIcons: false,
      manifest: {
        name: 'SimpleRPG',
        short_name: 'SimpleRPG',
        description: 'A fully single-player fantasy RPG. It runs offline, because it always did.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: CANVAS,
        background_color: CANVAS,
        // One vector mark scales to every launcher size; 'any' only, because the
        // shield reaches the edge of its box and a maskable crop would behead it.
        icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // The shell is the whole game: chunks, styles, the icon sprite, the
        // tinted 9-slice frames, and the two Latin font subsets English content
        // actually renders (the Cyrillic/Vietnamese cuts would be dead weight).
        globPatterns: [
          '**/*.{js,css,html}',
          'favicon.svg',
          'assets/icons.svg',
          'assets/frames/*.png',
          'assets/*-latin-wght-normal-*.woff2',
        ],
        // 4.3 MB of zone art would make the install ten times the game; it is
        // cached on first sight instead (below). Maps and the build-time asset
        // manifest are tooling and never fetched at runtime.
        globIgnores: ['**/assets/bg/**', '**/*.map', '**/assets/manifest.json'],
        /**
         * The plugin defaults this to /^assets/, which would hand EVERY file
         * under assets/ a null revision on the assumption that they are all
         * content-hashed. Ours are not: Vite hashes the JS/CSS/font it emits,
         * but `icons.svg`, `frames/*.png` and `nine-slice.css` are copied from
         * public/ under stable names. With a null revision an installed player
         * could never receive updated chrome art — the entry would be
         * considered immutable forever. Match only the genuinely hashed shape.
         */
        dontCacheBustURLsMatching: /assets\/[^/]+-[A-Za-z0-9_-]{8,}\.(?:js|css|woff2)$/,
        cleanupOutdatedCaches: true,
        // Claim the tab that installed us, so the very first session is already
        // offline-capable. `skipWaiting` stays off (that is what makes the
        // update a prompt) — the two are independent switches.
        clientsClaim: true,
        runtimeCaching: [
          {
            urlPattern: /\/assets\/bg\/[^/]+\.(?:avif|webp)$/,
            // Backgrounds are content-addressed by name and never edited in
            // place — a patch ships a new name — so the cached copy is always
            // the right copy, and a returning player pays the network once.
            handler: 'CacheFirst',
            options: {
              cacheName: 'simplerpg-zone-art',
              expiration: {
                // A player visits a handful of zones per session; 40 entries is
                // several months of art without ever crowding the saves.
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 24 * 60,
                purgeOnQuotaError: true,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      'workbox-window': WORKBOX_WINDOW,
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: { manualChunks },
    },
  },
  test: {
    environment: 'node',
    environmentMatchGlobs: [
      ['src/ui/**', 'jsdom'],
      ['src/state/**', 'jsdom'],
      ['src/App.test.tsx', 'jsdom'],
    ],
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    globals: false,
  },
});
