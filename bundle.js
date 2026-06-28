#!/usr/bin/env node
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readdirSync, rmSync } from 'node:fs'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const viteBin = path.join(rootDir, 'node_modules', '.bin', 'vite')
const keepInDist = new Set(['index.js'])

await new Promise((resolve, reject) => {
  const proc = spawn(viteBin, ['build', '--config', 'vite.bundle.config.ts'], {
    env: { ...process.env, BUNDLE_ROOT: rootDir },
    stdio: 'inherit',
    cwd: rootDir,
  })
  proc.on('close', (code) => (code === 0 ? resolve(code) : reject(new Error('bundle failed'))))
})

for (const name of readdirSync(path.join(rootDir, 'dist'))) {
  if (!keepInDist.has(name)) rmSync(path.join(rootDir, 'dist', name), { recursive: true, force: true })
}
