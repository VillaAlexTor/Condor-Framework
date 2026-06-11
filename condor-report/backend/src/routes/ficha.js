/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  CÓNDOR FRAMEWORK — backend/src/routes/ficha.js      ║
 * ║  Rutas: recomendaciones y utilidades para fichas     ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * ENDPOINTS:
 *   GET  /api/ficha/categories               — categorías disponibles
 *   POST /api/ficha/recommend                — recomendación por categoría + contexto
 *   POST /api/ficha/enrich                   — enriquece una ficha individual
 *   POST /api/ficha/enrich-all               — enriquece un array de fichas
 *   POST /api/ficha/general-recommendations  — recomendaciones generales del informe
 *   POST /api/ficha/new                      — crea ficha vacía lista para editar
 */

"use strict"

const express = require("express")

const {
  getRecommendation,
  enrichFicha,
  enrichAll,
  generateGeneralRecommendations,
  getCategories,
} = require("../lib/recommender")

const router = express.Router()

// ─────────────────────────────────────────────
//  GET /api/ficha/categories
// ─────────────────────────────────────────────
router.get("/categories", (req, res) => {
  const categories = getCategories()

  const LABELS = {
    exposicion_servicio: "Exposición de servicio",
    cve_critico:         "CVE detectado",
    tls_issue:           "Issue de certificado TLS",
    email_spoofing:      "Email spoofing (SPF/DMARC/DKIM)",
    archivo_sensible:    "Archivo sensible expuesto",
    backup_expuesto:     "Backup expuesto",
    panel_admin:         "Panel de administración expuesto",
    whois_expiracion:    "Expiración de dominio",
    email_expuesto:      "Emails corporativos expuestos",
    api_expuesta:        "API sin autenticación",
  }

  const enriched = categories.map(c => ({
    ...c,
    label: LABELS[c.id] || c.id,
  }))

  res.json({ success: true, categories: enriched })
})

// ─────────────────────────────────────────────
//  POST /api/ficha/recommend
//  Body: { categoria: "email_spoofing", context: { has_spf, has_dmarc } }
// ─────────────────────────────────────────────
router.post("/recommend", (req, res) => {
  const { categoria, context = {} } = req.body

  if (!categoria) {
    return res.status(400).json({ success: false, message: "'categoria' es requerida" })
  }

  const recommendation = getRecommendation(categoria, context)
  res.json({ success: true, categoria, recommendation })
})

// ─────────────────────────────────────────────
//  POST /api/ficha/enrich
//  Body: { ficha: {...} }
// ─────────────────────────────────────────────
router.post("/enrich", (req, res) => {
  const { ficha } = req.body

  if (!ficha || typeof ficha !== "object") {
    return res.status(400).json({ success: false, message: "'ficha' es requerida y debe ser un objeto" })
  }
  if (!ficha.categoria) {
    return res.status(400).json({ success: false, message: "ficha.categoria es requerida para generar la recomendación" })
  }

  try {
    const enriched = enrichFicha(ficha)
    res.json({ success: true, ficha: enriched })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

// ─────────────────────────────────────────────
//  POST /api/ficha/enrich-all
//  Body: { fichas: [...] }
// ─────────────────────────────────────────────
router.post("/enrich-all", (req, res) => {
  const { fichas } = req.body

  if (!Array.isArray(fichas)) {
    return res.status(400).json({ success: false, message: "'fichas' debe ser un array" })
  }

  try {
    const enriched = enrichAll(fichas)
    res.json({ success: true, fichas: enriched, count: enriched.length })
  } catch (err) {
    res.status(400).json({ success: false, message: err.message })
  }
})

// ─────────────────────────────────────────────
//  POST /api/ficha/general-recommendations
//  Body: { fichas: [...] }
// ─────────────────────────────────────────────
router.post("/general-recommendations", (req, res) => {
  const { fichas } = req.body

  if (!Array.isArray(fichas)) {
    return res.status(400).json({ success: false, message: "'fichas' debe ser un array" })
  }

  const recommendations = generateGeneralRecommendations(fichas)
  res.json({ success: true, count: recommendations.length, recommendations })
})

// ─────────────────────────────────────────────
//  POST /api/ficha/new
//  Body: { categoria?: string, fuente?: string }
// ─────────────────────────────────────────────
router.post("/new", (req, res) => {
  const { categoria = "", fuente = "manual" } = req.body

  const nuevaFicha = {
    id:           `VULN-MANUAL-${Date.now().toString(36).toUpperCase()}`,
    titulo:       "",
    categoria,
    fuente,
    cve_id:       null,
    descripcion:  "",
    evidencia:    "",
    impacto:      "",
    cvss: {
      version:  "3.1",
      vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N",
      score:    0,
      severity: "NINGUNO",
      metrics:  { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "N" },
    },
    recomendacion: "",
    referencias:   [],
    estado:        "abierto",
    prioridad:     5,
    _meta: {
      auto_generated: false,
      source_module:  fuente,
      raw: {},
    },
  }

  const result = categoria ? enrichFicha(nuevaFicha) : nuevaFicha

  res.json({ success: true, ficha: result })
})

module.exports = router