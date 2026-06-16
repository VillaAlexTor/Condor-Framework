/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "Fira Code", "monospace"],
      },
      colors: {
        // Paleta del Cóndor Framework — referenciables como
        // bg-condor-green, text-condor-cyan, etc.
        condor: {
          bg:     "#0a0e17",
          panel:  "#070b12",
          green:  "#00ff88",
          cyan:   "#00d4ff",
        },
      },
    },
  },
  plugins: [],
}