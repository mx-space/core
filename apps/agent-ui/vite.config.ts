import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 2340,
    proxy: {
      '/api': {
        target: 'http://localhost:2333',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://localhost:2333',
        changeOrigin: true,
        ws: true,
      },
      '/ai': {
        target: 'http://localhost:2333',
        changeOrigin: true,
      },
    },
  },
})
