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
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true,
  },
});
