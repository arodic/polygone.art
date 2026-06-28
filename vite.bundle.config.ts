import { defineConfig } from 'vite'
import path from 'node:path'
import strip from '@rollup/plugin-strip'

const rootDir = path.resolve(process.env.BUNDLE_ROOT as string)

export default defineConfig({
  root: rootDir,
  esbuild: { legalComments: 'inline' },
  resolve: {
    alias: {
      '@io-gui/core': path.resolve(rootDir, 'node_modules/@io-gui/core/dist/index.js'),
      '@io-gui/icons': path.resolve(rootDir, 'node_modules/@io-gui/icons/dist/index.js'),
      '@io-gui/inputs': path.resolve(rootDir, 'node_modules/@io-gui/inputs/dist/index.js'),
      '@io-gui/markdown': path.resolve(rootDir, 'node_modules/@io-gui/markdown/dist/index.js'),
      '@io-gui/menus': path.resolve(rootDir, 'node_modules/@io-gui/menus/dist/index.js'),
      '@io-gui/navigation': path.resolve(rootDir, 'node_modules/@io-gui/navigation/dist/index.js'),
    },
  },
  plugins: [strip({ functions: [], labels: ['debug'] })],
  build: {
    target: 'esnext',
    lib: { entry: path.resolve(rootDir, 'src/index.ts'), formats: ['es'], fileName: () => 'index.js' },
    outDir: path.resolve(rootDir, 'dist'),
    emptyOutDir: false,
    minify: 'terser',
    terserOptions: {
      mangle: false,
      compress: { keep_fnames: true, keep_classnames: true, keep_infinity: true },
      format: { comments: /^\s*!|Copyright|@license|@preserve|SPDX-License-Identifier/i },
    },
    sourcemap: false,
    rollupOptions: { treeshake: true, output: { preserveModules: false, inlineDynamicImports: true } },
  },
})
