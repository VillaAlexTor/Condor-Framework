import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  server: {
    port: 5173,
    host: true,        // Permite acceso desde la red local (útil en Docker/VM)
    strictPort: true,  // Falla si el puerto está ocupado, en vez de cambiar de puerto
    open: false,
  },

  preview: {
    port: 5173,
    host: true,
  },

  build: {
    outDir: "dist",
    sourcemap: false,
    // El JSON de condor-cli puede ser grande — subir el límite
    // de advertencia de chunk para no llenar la consola de warnings
    chunkSizeWarningLimit: 1000,
  },

  resolve: {
    alias: {
      "@": "/src",
    },
  },
})