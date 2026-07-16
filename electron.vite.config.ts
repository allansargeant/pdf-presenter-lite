import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    // Pinned away from Vite's default 5173 — this machine sometimes runs
    // another Electron project's dev server concurrently, and both would
    // otherwise silently race for the same port (confirmed live: this app's
    // Electron process ended up loading the OTHER project's page content).
    server: {
      port: 5183,
      strictPort: true
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
