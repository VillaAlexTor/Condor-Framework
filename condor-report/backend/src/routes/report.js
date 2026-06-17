"use strict"

const express = require("express")
const path    = require("path")
const fs      = require("fs")

const { importFromJson }   = require("../lib/importer")
const { enrichAll }         = require("../lib/recommender")
const { generatePDF }        = require("../generators/pdf")

const router = express.Router()

// ─────────────────────────────────────────────
//  POST /api/report/import
//
//  Recibe el JSON completo de condor-cli y retorna
//  las fichas generadas automáticamente, ya enriquecidas
//  con recomendaciones.
//
//  Body: { meta: {...}, results: {...}, errors: {...} }
//  Response: { success, fichas, stats, report_meta, informe_meta }
// ─────────────────────────────────────────────
router.post("/import", (req, res, next) => {
  try {
    const reportJson = req.body

    if (!reportJson || Object.keys(reportJson).length === 0) {
      return res.status(400).json({
        success: false,
        message: "Body vacío. Enviar el JSON completo generado por condor-cli.",
      })
    }

    console.log(`[report/import] Procesando reporte para target: ${reportJson.meta?.target || "desconocido"}`)

    // Extraer fichas automáticas
    const result = importFromJson(reportJson)

    // Enriquecer con recomendaciones completas
    const fichasEnriquecidas = enrichAll(result.fichas)

    console.log(`[report/import] ${fichasEnriquecidas.length} fichas generadas`)
    console.log(`[report/import] Stats:`, result.stats)

    res.json({
      success:      true,
      fichas:       fichasEnriquecidas,
      stats:        result.stats,
      report_meta:  result.report_meta,
      informe_meta: result.informe_meta,
    })

  } catch (err) {
    console.error("[report/import] Error:", err.message)

    if (err.message.includes("inválido") || err.message.includes("Estructura")) {
      return res.status(400).json({ success: false, message: err.message })
    }

    next(err)
  }
})

// ─────────────────────────────────────────────
//  POST /api/report/generate
//
//  Recibe metadata + fichas (ya editadas por el analista)
//  y genera el PDF final.
//
//  Body: {
//    meta:    { titulo, target, analista, clasificacion, fecha, version },
//    fichas:  [ {...}, ... ],
//    opciones: ["portada", "toc", ...]  (opcional, informativo)
//    formato: "pdf"
//  }
//  Response: { success, path, filename, downloadUrl }
// ─────────────────────────────────────────────
router.post("/generate", async (req, res, next) => {
  try {
    const { meta, fichas, formato = "pdf" } = req.body

    // ── Validaciones ──────────────────────────
    if (!meta || typeof meta !== "object") {
      return res.status(400).json({
        success: false,
        message: "Falta 'meta' con la información del informe (titulo, target, analista, etc.)",
      })
    }

    if (!meta.target) {
      return res.status(400).json({
        success: false,
        message: "meta.target es requerido",
      })
    }

    if (!Array.isArray(fichas) || fichas.length === 0) {
      return res.status(400).json({
        success: false,
        message: "fichas debe ser un array con al menos 1 elemento",
      })
    }

    // Validar que cada ficha tenga lo mínimo
    const camposRequeridos = ["id", "titulo", "cvss"]
    for (const [i, ficha] of fichas.entries()) {
      const faltantes = camposRequeridos.filter(c => !ficha[c])
      if (faltantes.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Ficha #${i + 1} (${ficha.id || "sin ID"}) tiene campos faltantes: ${faltantes.join(", ")}`,
        })
      }
      if (typeof ficha.cvss?.score !== "number") {
        return res.status(400).json({
          success: false,
          message: `Ficha #${i + 1} (${ficha.id}) — cvss.score debe ser un número`,
        })
      }
    }

    // ── Solo PDF soportado por ahora ─────────
    if (formato !== "pdf") {
      return res.status(400).json({
        success: false,
        message: `Formato '${formato}' no soportado aún. Solo 'pdf' está disponible.`,
      })
    }

    console.log(`[report/generate] Generando PDF para: ${meta.target}`)
    console.log(`[report/generate] Fichas: ${fichas.length}`)

    // ── Generar PDF ───────────────────────────
    const outputDir = req.app.locals.outputDir
    const timeout   = req.app.locals.pdfTimeout

    const pdfPath = await generatePDF({
      meta:   {
        ...meta,
        fecha: meta.fecha || new Date().toISOString().split("T")[0],
      },
      fichas,
      outputDir,
      timeout,
    })

    const filename = path.basename(pdfPath)

    console.log(`[report/generate] ✓ PDF generado: ${filename}`)

    res.json({
      success:     true,
      path:        pdfPath,
      filename,
      downloadUrl: `/api/report/download/${filename}`,
      stats: {
        total:   fichas.length,
        critico: fichas.filter(f => f.cvss.severity === "CRÍTICO").length,
        alto:    fichas.filter(f => f.cvss.severity === "ALTO").length,
        medio:   fichas.filter(f => f.cvss.severity === "MEDIO").length,
        bajo:    fichas.filter(f => f.cvss.severity === "BAJO").length,
      },
    })

  } catch (err) {
    console.error("[report/generate] Error:", err.message)

    // Errores de Puppeteer suelen tener mensajes específicos
    if (err.message.includes("Timeout") || err.message.includes("timeout")) {
      return res.status(504).json({
        success: false,
        message: "Timeout generando el PDF. El informe puede ser muy grande — intenta con menos fichas o aumenta PDF_TIMEOUT.",
      })
    }

    if (err.message.includes("Protocol error") || err.message.includes("Target closed")) {
      return res.status(500).json({
        success: false,
        message: "Error de Puppeteer/Chromium. Verifica que esté instalado correctamente: npx puppeteer browsers install chrome",
      })
    }

    next(err)
  }
})

// ─────────────────────────────────────────────
//  GET /api/report/list
//
//  Lista los PDFs generados previamente en el directorio output.
//  Útil para que el frontend muestre informes anteriores.
// ─────────────────────────────────────────────
router.get("/list", (req, res, next) => {
  try {
    const outputDir = req.app.locals.outputDir

    if (!fs.existsSync(outputDir)) {
      return res.json({ success: true, files: [] })
    }

    const files = fs.readdirSync(outputDir)
      .filter(f => f.endsWith(".pdf"))
      .map(f => {
        const fullPath = path.join(outputDir, f)
        const stats    = fs.statSync(fullPath)
        return {
          filename:    f,
          size:        stats.size,
          sizeKB:      Math.round(stats.size / 1024),
          createdAt:   stats.birthtime,
          downloadUrl: `/api/report/download/${f}`,
        }
      })
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))

    res.json({ success: true, files })

  } catch (err) {
    next(err)
  }
})

// ─────────────────────────────────────────────
//  DELETE /api/report/:filename
//
//  Elimina un PDF generado previamente.
// ─────────────────────────────────────────────
router.delete("/:filename", (req, res, next) => {
  try {
    const { filename } = req.params
    const outputDir    = req.app.locals.outputDir

    // Seguridad: prevenir path traversal
    const safeFilename = path.basename(filename)
    if (safeFilename !== filename || !filename.endsWith(".pdf")) {
      return res.status(400).json({ success: false, message: "Nombre de archivo inválido" })
    }

    const filePath = path.join(outputDir, safeFilename)

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, message: "Archivo no encontrado" })
    }

    fs.unlinkSync(filePath)
    console.log(`[report/delete] Eliminado: ${safeFilename}`)

    res.json({ success: true, message: `${safeFilename} eliminado` })

  } catch (err) {
    next(err)
  }
})

module.exports = router