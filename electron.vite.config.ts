import { resolve } from 'node:path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'

const shared = { '@shared': resolve(__dirname, 'src/shared') }

export default defineConfig({
  main: {
    resolve: { alias: shared },
    build: {
      // electron-store is ESM only, bundle it instead of requiring it at runtime
      externalizeDeps: { exclude: ['electron-store'] }
    }
  },
  preload: {
    resolve: { alias: shared }
  },
  renderer: {
    resolve: {
      alias: {
        ...shared,
        '@renderer': resolve(__dirname, 'src/renderer/src')
      }
    },
    plugins: [react()]
  }
})
