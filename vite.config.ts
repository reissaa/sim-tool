import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync, writeFileSync } from 'fs'
import type { Plugin } from 'vite'

// Move the inlined script from <head> to end of <body> so it runs after DOM is ready,
// without needing type="module" or defer (both can be blocked by iframe sandboxes).
function moveScriptToBody(): Plugin {
  return {
    name: 'move-script-to-body',
    closeBundle() {
      const file = 'dist/index.html'
      let html = readFileSync(file, 'utf8')

      const scriptRe = /<script type="module"[^>]*>([\s\S]*?)<\/script>/
      const match = html.match(scriptRe)
      if (match) {
        html = html.replace(scriptRe, '')
        html = html.replace('</body>', `<script>\n${match[1]}\n</script>\n</body>`)
      }
      writeFileSync(file, html)
    },
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), moveScriptToBody()],
  build: {
    target: 'es2015',
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        format: 'iife',
        name: 'PassiveDesignApp',
        inlineDynamicImports: true,
      },
    },
  },
})
