import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: process.env.BASE_PATH || '/auto-game/',
  resolve: {
    alias: {
      '@auto-game/ui-component': resolve(__dirname, '../ui-component/src'),
      '@auto-game/logic': resolve(__dirname, '../logic/src'),
      '@auto-game/data-base': resolve(__dirname, '../data-base/src'),
      '@auto-game/city-territory': resolve(__dirname, '../city-territory/src'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        mapDemo: resolve(__dirname, 'map-demo.html'),
        cityTerritoryDemo: resolve(__dirname, 'city-territory-demo.html'),
      }
    }
  }
});
