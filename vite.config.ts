import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // The entry bundle is about 517 kB (149 kB gzipped); pages are already lazy.
  build: { chunkSizeWarningLimit: 600 },
})
