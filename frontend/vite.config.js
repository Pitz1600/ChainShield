import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Listen on all addresses
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: 'http://chainshield-backend:5000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    target: 'es2015',
    minify: 'esbuild'
  }
})
