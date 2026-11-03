"use strict"

// ─────────────────────────────────────────────
//  Cóndor Report Backend — Express API
// ─────────────────────────────────────────────

require("dotenv").config()

const express = require("express")
const cors    = require("cors")
const path    = require("path")
const authRoutes = require("./routes/auth")
const { requireAuth } = require("./auth")

const reportRoutes = require("./routes/report")
const cvssRoutes   = require("./routes/cvss")
const fichaRoutes  = require("./routes/ficha")

// ─────────────────────────────────────────────
//  Configuración
// ─────────────────────────────────────────────

const app = express()

const PORT          = process.env.PORT          || 3001
const OUTPUT_DIR    = process.env.OUTPUT_DIR    || path.join(__dirname, "..", "output")
const PDF_TIMEOUT   = Number(process.env.PDF_TIMEOUT || 30000)
const RATE_LIMIT_WINDOW_MS = 60 * 1000
const configuredRateLimit = Number(process.env.RATE_LIMIT_MAX || 30)
const RATE_LIMIT_MAX = Number.isFinite(configuredRateLimit) && configuredRateLimit > 0
  ? Math.floor(configuredRateLimit)
  : 30
const requestCounts = new Map()
const cleanupRateLimitTimer = setInterval(() => {
  const cutoff = Date.now() - RATE_LIMIT_WINDOW_MS
  for (const [key, value] of requestCounts) {
    if (value.startedAt < cutoff) requestCounts.delete(key)
  }
}, RATE_LIMIT_WINDOW_MS)
cleanupRateLimitTimer.unref()

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
  allowedHeaders: ["Content-Type", "Authorization", "X-API-Key"],
  credentials: true,
}))

// Body parser para JSON
app.use(express.json({ limit: "10mb" }))

app.locals.outputDir = path.resolve(OUTPUT_DIR)
app.locals.pdfTimeout = Number.isFinite(PDF_TIMEOUT) && PDF_TIMEOUT > 0 ? PDF_TIMEOUT : 30000

function rateLimit(req, res, next) {
  const key = req.ip || "unknown"
  const now = Date.now()
  const current = requestCounts.get(key)
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    requestCounts.set(key, { startedAt: now, count: 1 })
    return next()
  }
  if (current.count >= RATE_LIMIT_MAX) {
    return res.status(429).json({ success: false, message: "Límite de solicitudes excedido" })
  }
  current.count += 1
  next()
}

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff")
  res.setHeader("X-Frame-Options", "DENY")
  res.setHeader("Referrer-Policy", "no-referrer")
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'")
  next()
})

// ─────────────────────────────────────────────
//  Rutas API
// ─────────────────────────────────────────────

app.use("/api/auth", authRoutes)
app.use("/api/report", rateLimit, requireAuth, reportRoutes)
app.use("/api/cvss",   rateLimit, requireAuth, cvssRoutes)
app.use("/api/ficha",  rateLimit, requireAuth, fichaRoutes)

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
