import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || '/neurogame/',
  build: { chunkSizeWarningLimit: 1300 },
  test: { include: ['src/**/*.test.ts'], environment: 'node' },
})
