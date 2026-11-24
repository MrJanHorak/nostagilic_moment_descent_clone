// Vite configuration
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Base public path when served in development or production
  base: '/',

  // Configure resolver
  resolve: {
    alias: {
      // Create an alias for src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // Configure server
  server: {
    port: 5173,
    strictPort: false,
    open: true,
    // Disable HMR overlay for errors
    hmr: {
      overlay: true,
    },
  },

  // Build options
  build: {
    rollupOptions: {
      input: { game: path.resolve(__dirname, 'index.html'), editor: path.resolve(__dirname, 'editor.html'), playtest: path.resolve(__dirname, 'playtest.html') },
      output: {
        // three.js changes only on dependency upgrades: keep its core in its own
        // long-cached vendor chunk shared by the game, editor and playtest pages.
        // Addons (OrbitControls, TransformControls) stay with the editor that uses them.
        manualChunks(id) {
          if (id.replaceAll('\\', '/').includes('/node_modules/three/build/')) return 'three';
        },
      },
    },
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
    // The isolated three.js vendor chunk is ~550-700 kB minified (~150 kB gzip) and
    // cannot be split further; game/editor chunks remain far below this limit.
    chunkSizeWarningLimit: 750,
  },
});
