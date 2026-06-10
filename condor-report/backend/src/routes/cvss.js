/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  CÓNDOR FRAMEWORK — backend/src/routes/cvss.js       ║
 * ║  Rutas: calculadora CVSS 3.1 y presets               ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * ENDPOINTS:
 *   GET  /api/cvss/calculate?vector=CVSS:3.1/...   — desde vector string
 *   POST /api/cvss/calculate                        — desde métricas individuales
 *   GET  /api/cvss/presets                          — lista de vectores predefinidos
 *   GET  /api/cvss/presets/:id                      — preset específico
 *   GET  /api/cvss/suggest                          — sugiere preset por categoría
 *   GET  /api/cvss/metrics                          — definiciones de métricas (para UI)
 *   GET  /api/cvss/self-test                        — corre tests contra casos del FIRST
 */

"use strict"

const express = require("express")

const {
  calculate,
  calculateFromVector,
  runSelfTest,
} = require("../cvss/calculator")

const {
  METRICS,
  SEVERITY_DISPLAY,
  PRESET_VECTORS,
  getVectorDescription,
  suggestPreset,
  getPresetsOrdered,
} = require("../cvss/vectors")

const router = express.Router()

// ─────────────────────────────────────────────
//  GET /api/cvss/calculate?vector=CVSS:3.1/AV:N/...
//
//  Calcula el score desde un vector string en query param.
//  Útil para links directos y testing rápido.
// ─────────────────────────────────────────────
router.get("/calculate", (req, res) => {
  const { vector } = req.query

  if (!vector) {
    return res.status(400).json({
      success: false,
      message: "Query param 'vector' es requerido. Ej: ?vector=CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    })
  }

  try {
    const result      = calculateFromVector(vector)
    const description = getVectorDescription(result.metrics)

    res.json({
      success: true,
      ...result,
      description,
      severity_info: SEVERITY_DISPLAY[result.severity],
    })

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    })
  }
})

// ─────────────────────────────────────────────
//  POST /api/cvss/calculate
//
//  Calcula el score desde métricas individuales.
//  Usado por CvssCalculator.vue en cada cambio de métrica.
//
//  Body: { AV, AC, PR, UI, S, C, I, A }
// ─────────────────────────────────────────────
router.post("/calculate", (req, res) => {
  const metrics = req.body

  if (!metrics || typeof metrics !== "object") {
    return res.status(400).json({
      success: false,
      message: "Body debe ser un objeto con las métricas: { AV, AC, PR, UI, S, C, I, A }",
    })
  }

  try {
    const result      = calculate(metrics)
    const description = getVectorDescription(result.metrics)

    res.json({
      success: true,
      ...result,
      description,
      severity_info: SEVERITY_DISPLAY[result.severity],
    })

  } catch (err) {
    res.status(400).json({
      success: false,
      message: err.message,
    })
  }
})

// ─────────────────────────────────────────────
//  GET /api/cvss/presets
//
//  Retorna todos los vectores predefinidos, ordenados
//  por score descendente. Usado para poblar el selector
//  de presets en CvssCalculator.vue.
//
//  Query params opcionales:
//    ?category=exposicion_servicio  — filtrar por categoría
// ─────────────────────────────────────────────
router.get("/presets", (req, res) => {
  const { category } = req.query

  let presets = getPresetsOrdered()

  if (category) {
    presets = presets.filter(p => p.category === category)
  }

  res.json({
    success: true,
    count:   presets.length,
    presets,
  })
})

// ─────────────────────────────────────────────
//  GET /api/cvss/presets/:id
//
//  Retorna un preset específico por ID.
// ─────────────────────────────────────────────
router.get("/presets/:id", (req, res) => {
  const preset = PRESET_VECTORS.find(p => p.id === req.params.id)

  if (!preset) {
    return res.status(404).json({
      success: false,
      message: `Preset '${req.params.id}' no encontrado`,
      available: PRESET_VECTORS.map(p => p.id),
    })
  }

  res.json({ success: true, preset })
})

// ─────────────────────────────────────────────
//  GET /api/cvss/suggest?category=...&keyword=...
//
//  Sugiere el preset más apropiado para una categoría
//  y palabra clave. Usado al crear fichas manualmente.
// ─────────────────────────────────────────────
router.get("/suggest", (req, res) => {
  const { category, keyword } = req.query

  if (!category) {
    return res.status(400).json({
      success: false,
      message: "Query param 'category' es requerido",
    })
  }

  const preset = suggestPreset(category, keyword)

  if (!preset) {
    return res.json({
      success: true,
      preset: null,
      message: `Sin presets para la categoría '${category}'`,
    })
  }

  res.json({ success: true, preset })
})

// ─────────────────────────────────────────────
//  GET /api/cvss/metrics
//
//  Retorna las definiciones completas de las 8 métricas
//  CVSS 3.1 con labels, descripciones, ejemplos y colores.
//  Usado por CvssCalculator.vue para renderizar los botones.
// ─────────────────────────────────────────────
router.get("/metrics", (req, res) => {
  res.json({
    success:  true,
    metrics:  METRICS,
    severity: SEVERITY_DISPLAY,
  })
})

// ─────────────────────────────────────────────
//  GET /api/cvss/self-test
//
//  Corre los casos de prueba conocidos del estándar FIRST
//  para verificar que el calculador funciona correctamente.
//  Útil para debugging y CI.
// ─────────────────────────────────────────────
router.get("/self-test", (req, res) => {
  const results = runSelfTest()

  res.json({
    success: results.passed === results.total,
    ...results,
  })
})

module.exports = router