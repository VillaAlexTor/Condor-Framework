/**
 * ╔══════════════════════════════════════════════════════╗
 * ║   CÓNDOR FRAMEWORK — condor-dashboard/src/main.jsx   ║
 * ║   Entrypoint de la aplicación React                  ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * Monta App.jsx en el DOM e importa los estilos globales
 * (Tailwind + fuentes).
 */

import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App.jsx"
import "./index.css"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)