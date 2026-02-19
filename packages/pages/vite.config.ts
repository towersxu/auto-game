import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: '/auto-game/',
  resolve: {
    alias: {
      '@auto-game/ui-component': resolve(__dirname, '../ui-component/src'),
      '@auto-game/logic': resolve(__dirname, '../logic/src'),
      '@auto-game/data-base': resolve(__dirname, '../data-base/src'),
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
