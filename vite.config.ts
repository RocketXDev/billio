import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The prerendered pages in public/ (terms, privacy, blog...) are copied as they
// are, so point them at this build's bundle or they load files that are gone.
function syncStaticPages(): Plugin {
  return {
    name: 'sync-static-pages',
    apply: 'build',
    closeBundle() {
      const entry = readFileSync('dist/index.html', 'utf8')
      const js = entry.match(/src="(\/assets\/[^"]+\.js)"/)?.[1]
      const css = entry.match(/href="(\/assets\/[^"]+\.css)"/)?.[1]
      if (!js || !css) throw new Error("Couldn't find the bundle in dist/index.html.")

      const pages = readdirSync('dist', { recursive: true, encoding: 'utf8' })
        .filter((file) => file.endsWith('index.html') && file !== 'index.html')
      for (const page of pages) {
        const path = join('dist', page)
        const html = readFileSync(path, 'utf8')
          .replace(/\/assets\/index-[\w-]+\.js/g, js)
          .replace(/\/assets\/index-[\w-]+\.css/g, css)
        writeFileSync(path, html)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), syncStaticPages()],
  // The entry bundle is about 517 kB (149 kB gzipped); pages are already lazy.
  build: { chunkSizeWarningLimit: 600 },
})
