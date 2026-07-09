import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  base: '/ide/',
  build: {
    outDir: resolve(__dirname, '../../edtech/public/ide'),
    emptyOutDir: true,
  },
})
