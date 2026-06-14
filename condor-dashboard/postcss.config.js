/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  CÓNDOR FRAMEWORK — condor-dashboard/postcss.config.js║
 * ╚══════════════════════════════════════════════════════╝
 *
 * PostCSS procesa el CSS antes de que Vite lo sirva.
 * Tailwind necesita este archivo para inyectar sus utilidades.
 */

export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}