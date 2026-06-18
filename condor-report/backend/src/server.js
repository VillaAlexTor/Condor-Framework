"use strict"

// ─────────────────────────────────────────────
//  Cóndor Report Backend — Express API
// ─────────────────────────────────────────────

require("dotenv").config()

const express = require("express")
const cors    = require("cors")
const path    = require("path")

const reportRoutes = require("./routes/report")
const cvssRoutes   = require("./routes/cvss")
const fichaRoutes  = require("./routes/ficha")

// ─────────────────────────────────────────────
//  Configuración
// ─────────────────────────────────────────────

const app = express()

const PORT          = process.env.PORT          || 3001
const OUTPUT_DIR    = process.env.OUTPUT_DIR    || path.join(__dirname, "..", "output")

// ─────────────────────────────────────────────
//  Middleware
// ─────────────────────────────────────────────

const FRONTEND_URLS = (process.env.FRONTEND_URL || "http://localhost:5174")
  .split(",")
  .map(u => u.trim())

// CORS — permitir frontend(s) en desarrollo
app.use(cors({
  origin: (origin, callback) => {
    // Permitir requests sin origin (curl, Postman, apps móviles)
    if (!origin) return callback(null, true)
    if (FRONTEND_URLS.includes(origin)) return callback(null, true)
    callback(new Error("No permitido por CORS"))
  },
  methods: ["GET", "POST", "PUT", "DELETE"],
  allowedHeaders: ["Content-Type"],
}))

// Body parser para JSON
app.use(express.json({ limit: "10mb" }))

// Servir archivos estáticos del directorio de output (PDFs generados)
app.use("/api/report/download", express.static(OUTPUT_DIR))

// ─────────────────────────────────────────────
//  Rutas API
// ─────────────────────────────────────────────

app.use("/api/report", reportRoutes)
app.use("/api/cvss",   cvssRoutes)
app.use("/api/ficha",  fichaRoutes)

// ─────────────────────────────────────────────
//  Health check
// ─────────────────────────────────────────────

app.get("/api/health", (req, res) => {
  res.json({
    status:   "ok",
    service:  "condor-report-backend",
    version:  "0.1.0",
    timestamp: new Date().toISOString(),
  })
})

// ─────────────────────────────────────────────
//  404 para rutas no encontradas
// ─────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`,
  })
})

// ─────────────────────────────────────────────
//  Manejador de errores global
// ─────────────────────────────────────────────

app.use((err, req, res, next) => {
  console.error(`[ERROR] ${err.message}`)
  console.error(err.stack)
  res.status(500).json({
    success: false,
    message: "Error interno del servidor",
    error:   process.env.NODE_ENV === "development" ? err.message : undefined,
  })
})

// ─────────────────────────────────────────────
//  Iniciar servidor
// ─────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │  Cóndor Report Backend                      │
  │  Puerto:    ${String(PORT).padEnd(33)}│
  │  Output:    ${OUTPUT_DIR.padEnd(33)}│
  └─────────────────────────────────────────────┘
  `)
})
