import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync, writeFileSync } from 'fs'
import type { Plugin } from 'vite'

function patchModuleType(): Plugin {
  return {
    name: 'patch-module-type',
    closeBundle() {
      const file = 'dist/index.html'
      let html = readFileSync(file, 'utf8')
      html = html.replace(/<script type="module"[^>]*>/g, '<script defer>')
      writeFileSync(file, html)
    },
  }
}

export default defineConfig({
  plugins: [react(), viteSingleFile(), patchModuleType()],
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
