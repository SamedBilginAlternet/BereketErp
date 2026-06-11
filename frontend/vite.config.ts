import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        // Docker: VITE_API_URL=http://nginx  |  native: http://127.0.0.1:8000
        target: process.env.VITE_API_URL ?? 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
