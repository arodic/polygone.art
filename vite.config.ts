import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  root: '.',
  resolve: {
    alias: {
      './dist/index.js': fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      '@io-gui/core': fileURLToPath(new URL('./node_modules/@io-gui/core/dist/index.js', import.meta.url)),
      '@io-gui/icons': fileURLToPath(new URL('./node_modules/@io-gui/icons/dist/index.js', import.meta.url)),
      '@io-gui/inputs': fileURLToPath(new URL('./node_modules/@io-gui/inputs/dist/index.js', import.meta.url)),
      '@io-gui/markdown': fileURLToPath(new URL('./node_modules/@io-gui/markdown/dist/index.js', import.meta.url)),
      '@io-gui/menus': fileURLToPath(new URL('./node_modules/@io-gui/menus/dist/index.js', import.meta.url)),
      '@io-gui/navigation': fileURLToPath(new URL('./node_modules/@io-gui/navigation/dist/index.js', import.meta.url)),
    },
    dedupe: ['three'],
  },
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['dev.tabanovic.xyz'],
    // Behind HTTPS reverse proxy: client connects to the page host on 443.
    hmr: {
      protocol: 'wss',
      clientPort: 443,
    },
  },
  build: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
})
