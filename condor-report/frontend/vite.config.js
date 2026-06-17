import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"

export default defineConfig({
  plugins: [vue()],

  server: {
    port: 5174,
    host: true,
    strictPort: true,
    open: false,

    // Proxy hacia el backend — permite usar fetch("/api/...")
    // en vez de hardcodear http://localhost:3001 en el frontend
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },

  preview: {
    port: 5174,
    host: true,
  },

  build: {
    outDir: "dist",
    sourcemap: false,
  },

  resolve: {
    alias: {
      "@": "/src",
    },
  },
})