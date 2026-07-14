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
    // Local: default ws on the Vite port. Behind HTTPS reverse proxy: set
    // VITE_HMR_PROXY=1 so the client dials wss on 443 through the proxy.
    ...(process.env.VITE_HMR_PROXY === '1'
      ? {
          hmr: {
            protocol: 'wss' as const,
            clientPort: 443,
          },
        }
      : {}),
  },
  build: { target: 'esnext' },
  optimizeDeps: { esbuildOptions: { target: 'esnext' } },
})
