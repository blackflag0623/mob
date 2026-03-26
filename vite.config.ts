import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import path from 'path';

export default defineConfig({
  plugins: [svelte()],
  resolve: {
    alias: {
      '$shared': path.resolve(__dirname, 'src/shared')
    }
  },
  server: {
    port: 4041,
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:4040',
      '/mob-ws': { target: 'http://localhost:4040', ws: true }
    }
  },
  build: {
    outDir: 'dist/client',
    emptyOutDir: true
  }
});
