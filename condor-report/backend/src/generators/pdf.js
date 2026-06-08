/**
 * ╔══════════════════════════════════════════════════════╗
 * ║  CÓNDOR FRAMEWORK — condor-report/generators/pdf.js  ║
 * ║  Generador de informes PDF con Puppeteer             ║
 * ╚══════════════════════════════════════════════════════╝
 *
 * DESCRIPCIÓN:
 *   Genera el informe de auditoría en formato PDF usando
 *   Puppeteer para renderizar HTML a PDF con calidad
 *   de impresión profesional.
 *
 *   El proceso:
 *     1. Construye el HTML completo del informe en memoria
 *     2. Lanza Puppeteer (headless Chromium)
 *     3. Renderiza el HTML con CSS completo
 *     4. Exporta a PDF con márgenes y cabeceras profesionales
 *     5. Guarda el archivo y retorna la ruta
 *
 *   Secciones del informe generado:
 *     - Portada (target, analista, fecha, clasificación)
 *     - Índice automático
 *     - Resumen ejecutivo (métricas, distribución CVSS)
 *     - Metodología (OSINT pasivo, herramientas)
 *     - Fichas de vulnerabilidad (una por hallazgo)
 *     - Recomendaciones generales
 *     - Conclusiones
 *
 * DEPENDENCIAS:
 *   npm install puppeteer
 *
 * USO:
 *   const { generatePDF } = require("./pdf")
 *   const pdfPath = await generatePDF({ meta, fichas, outputDir })
 */

"use strict"

const puppeteer = require("puppeteer")
const path      = require("path")
const fs        = require("fs")

const { generateGeneralRecommendations } = require("../lib/recommender")

// ─────────────────────────────────────────────
//  Colores por severidad (para HTML/CSS inline)
// ─────────────────────────────────────────────
const SEV_STYLES = {
  "CRÍTICO": { bg: "#fee2e2", border: "#ef4444", text: "#991b1b", badge: "#ef4444" },
  "ALTO":    { bg: "#ffedd5", border: "#f97316", text: "#9a3412", badge: "#f97316" },
  "MEDIO":   { bg: "#fef9c3", border: "#eab308", text: "#854d0e", badge: "#eab308" },
  "BAJO":    { bg: "#dcfce7", border: "#22c55e", text: "#166534", badge: "#22c55e" },
  "NINGUNO": { bg: "#f1f5f9", border: "#94a3b8", text: "#475569", badge: "#94a3b8" },
}

const ss = (sev) => SEV_STYLES[sev] || SEV_STYLES["NINGUNO"]

// ─────────────────────────────────────────────
//  Helpers de formato
// ─────────────────────────────────────────────
function formatDate(iso) {
  if (!iso) return "—"
  try {
    return new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit", month: "long", year: "numeric"
    })
  } catch { return iso }
}

function escapeHtml(str) {
  if (!str) return ""
  return String(str)
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/\n/g, "<br>")
}

function cvssBarWidth(score) {
  return Math.min(100, (score / 10) * 100).toFixed(1) + "%"
}

// ─────────────────────────────────────────────
//  CSS del informe
// ─────────────────────────────────────────────
function buildCSS() {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap');

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 11pt;
      color: #1e293b;
      background: white;
      line-height: 1.6;
    }

    /* ── Página ── */
    @page {
      size: A4;
      margin: 20mm 18mm 22mm 18mm;
    }
    @page :first { margin-top: 0; margin-bottom: 0; }

    .page-break { page-break-before: always; }
    .no-break   { page-break-inside: avoid; }

    /* ── Portada ── */
    .cover {
      height: 297mm;
      display: flex;
      flex-direction: column;
      background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%);
      color: white;
      padding: 0;
      position: relative;
      overflow: hidden;
    }
    .cover-accent {
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 6px;
      background: linear-gradient(90deg, #00ff88, #00d4ff, #7c3aed);
    }
    .cover-grid {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
      background-size: 30px 30px;
    }
    .cover-body {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      padding: 60px 50px;
      position: relative;
      z-index: 1;
    }
    .cover-tag {
      font-size: 9pt;
      letter-spacing: 0.3em;
      text-transform: uppercase;
      color: #00ff88;
      margin-bottom: 24px;
      font-family: 'JetBrains Mono', monospace;
    }
    .cover-title {
      font-size: 28pt;
      font-weight: 800;
      line-height: 1.15;
      color: white;
      margin-bottom: 16px;
    }
    .cover-target {
      font-size: 16pt;
      font-family: 'JetBrains Mono', monospace;
      color: #00d4ff;
      margin-bottom: 40px;
      padding: 12px 16px;
      background: rgba(0, 212, 255, 0.08);
      border: 1px solid rgba(0, 212, 255, 0.2);
      border-radius: 8px;
      display: inline-block;
    }
    .cover-meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-top: 20px;
    }
    .cover-meta-item {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 8px;
      padding: 12px 16px;
    }
    .cover-meta-label {
      font-size: 7pt;
      color: rgba(255,255,255,0.4);
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 4px;
    }
    .cover-meta-value {
      font-size: 10pt;
      font-weight: 600;
      color: white;
    }
    .cover-classification {
      position: absolute;
      bottom: 40px;
      left: 50px;
      right: 50px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      z-index: 1;
    }
    .cover-classification-badge {
      font-size: 8pt;
      font-weight: 700;
      letter-spacing: 0.2em;
      text-transform: uppercase;
      padding: 6px 14px;
      border-radius: 4px;
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #fca5a5;
    }
    .cover-tool {
      font-size: 8pt;
      color: rgba(255,255,255,0.3);
      font-family: 'JetBrains Mono', monospace;
    }

    /* ── Header de sección ── */
    .section-header {
      border-left: 4px solid #3b82f6;
      padding-left: 14px;
      margin-bottom: 20px;
      margin-top: 10px;
    }
    .section-number {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      margin-bottom: 2px;
    }
    .section-title {
      font-size: 16pt;
      font-weight: 700;
      color: #0f172a;
    }

    /* ── Resumen ejecutivo ── */
    .exec-metrics {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      margin: 20px 0;
    }
    .metric-card {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 16px;
      text-align: center;
    }
    .metric-value {
      font-size: 24pt;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      line-height: 1;
      margin-bottom: 4px;
    }
    .metric-label {
      font-size: 8pt;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.1em;
    }

    /* ── Distribución CVSS ── */
    .cvss-dist {
      margin: 20px 0;
    }
    .cvss-row {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }
    .cvss-label {
      width: 70px;
      font-size: 9pt;
      font-weight: 600;
      text-align: right;
    }
    .cvss-bar-container {
      flex: 1;
      height: 20px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }
    .cvss-bar {
      height: 100%;
      border-radius: 4px;
      display: flex;
      align-items: center;
      padding-left: 8px;
      font-size: 8pt;
      color: white;
      font-weight: 600;
      transition: width 0.5s;
    }
    .cvss-count {
      width: 30px;
      font-size: 9pt;
      font-weight: 700;
      text-align: left;
    }

    /* ── Tabla de hallazgos ── */
    .findings-table {
      width: 100%;
      border-collapse: collapse;
      margin: 16px 0;
      font-size: 9pt;
    }
    .findings-table th {
      background: #1e293b;
      color: white;
      padding: 10px 12px;
      text-align: left;
      font-weight: 600;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }
    .findings-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .findings-table tr:nth-child(even) td { background: #f8fafc; }
    .findings-table tr:hover td { background: #f0f9ff; }

    /* ── Fichas de vulnerabilidad ── */
    .ficha {
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .ficha-header {
      padding: 16px 20px;
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 16px;
    }
    .ficha-id {
      font-size: 8pt;
      font-family: 'JetBrains Mono', monospace;
      font-weight: 600;
      opacity: 0.8;
      margin-bottom: 4px;
    }
    .ficha-title {
      font-size: 12pt;
      font-weight: 700;
      line-height: 1.3;
    }
    .ficha-badges {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 4px;
      shrink: 0;
    }
    .badge {
      font-size: 8pt;
      font-weight: 700;
      padding: 4px 10px;
      border-radius: 4px;
      white-space: nowrap;
      letter-spacing: 0.05em;
    }
    .badge-severity {
      color: white;
      font-size: 9pt;
    }
    .badge-source {
      background: #e2e8f0;
      color: #475569;
      font-family: 'JetBrains Mono', monospace;
    }
    .badge-cve {
      background: #ede9fe;
      color: #5b21b6;
      font-family: 'JetBrains Mono', monospace;
    }

    /* CVSS Score display */
    .cvss-score-display {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .cvss-score-number {
      font-size: 28pt;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      line-height: 1;
    }
    .cvss-score-info { flex: 1; }
    .cvss-vector {
      font-size: 8pt;
      font-family: 'JetBrains Mono', monospace;
      color: #64748b;
      word-break: break-all;
      margin-top: 4px;
    }
    .cvss-score-bar {
      flex: 1;
      height: 8px;
      background: #e2e8f0;
      border-radius: 4px;
      overflow: hidden;
    }
    .cvss-score-fill {
      height: 100%;
      border-radius: 4px;
    }

    /* Métricas CVSS grid */
    .cvss-metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      padding: 16px 20px;
      background: #f8fafc;
      border-top: 1px solid #e2e8f0;
    }
    .cvss-metric-item {
      text-align: center;
      padding: 8px;
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
    }
    .cvss-metric-name  { font-size: 7pt; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.1em; }
    .cvss-metric-value { font-size: 11pt; font-weight: 700; font-family: 'JetBrains Mono', monospace; color: #0f172a; }
    .cvss-metric-label { font-size: 7pt; color: #64748b; }

    /* Cuerpo de la ficha */
    .ficha-body {
      padding: 0 20px;
    }
    .ficha-field {
      padding: 14px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .ficha-field:last-child { border-bottom: none; }
    .ficha-field-label {
      font-size: 8pt;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
      margin-bottom: 6px;
    }
    .ficha-field-content {
      font-size: 10pt;
      color: #1e293b;
      line-height: 1.7;
    }
    .evidencia-box {
      background: #0f172a;
      color: #e2e8f0;
      font-family: 'JetBrains Mono', monospace;
      font-size: 8.5pt;
      padding: 14px 16px;
      border-radius: 6px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-all;
    }
    .recomendacion-box {
      background: #f0fdf4;
      border-left: 3px solid #22c55e;
      padding: 12px 16px;
      border-radius: 0 6px 6px 0;
      font-size: 10pt;
      color: #166534;
      line-height: 1.7;
    }
    .hardening-list {
      margin: 8px 0 0 0;
      padding-left: 20px;
    }
    .hardening-list li {
      font-size: 9pt;
      color: #475569;
      margin-bottom: 4px;
      line-height: 1.5;
    }
    .referencias-list {
      list-style: none;
      padding: 0;
      margin: 6px 0 0 0;
    }
    .referencias-list li {
      font-size: 8.5pt;
      font-family: 'JetBrains Mono', monospace;
      color: #3b82f6;
      margin-bottom: 3px;
    }
    .sla-badge {
      display: inline-block;
      font-size: 8pt;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 4px;
      background: #fef9c3;
      color: #854d0e;
      border: 1px solid #fde68a;
    }

    /* ── Recomendaciones generales ── */
    .rec-item {
      display: flex;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f1f5f9;
    }
    .rec-bullet {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #3b82f6;
      margin-top: 6px;
      shrink: 0;
    }

    /* ── Footer ── */
    .report-footer {
      margin-top: 40px;
      padding-top: 16px;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-between;
      font-size: 8pt;
      color: #94a3b8;
    }

    /* ── Índice ── */
    .toc-item {
      display: flex;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px dotted #e2e8f0;
    }
    .toc-number { width: 30px; font-weight: 700; color: #3b82f6; }
    .toc-title  { flex: 1; font-size: 10pt; }
    .toc-dots   { flex: 1; border-bottom: 1px dotted #cbd5e1; margin: 0 8px; margin-bottom: 4px; }

    /* ── Utilidades ── */
    .text-muted  { color: #64748b; }
    .mono        { font-family: 'JetBrains Mono', monospace; }
    .mb-8  { margin-bottom: 8px; }
    .mb-16 { margin-bottom: 16px; }
    .mt-16 { margin-top: 16px; }
    .mt-24 { margin-top: 24px; }
  `
}

// ─────────────────────────────────────────────
//  Constructores de secciones HTML
// ─────────────────────────────────────────────

function buildCover(meta, stats) {
  const fecha = formatDate(meta.fecha || new Date().toISOString())
  return `
    <div class="cover">
      <div class="cover-accent"></div>
      <div class="cover-grid"></div>

      <div class="cover-body">
        <div class="cover-tag">🦅 Cóndor Framework · Informe de Auditoría OSINT</div>
        <div class="cover-title">${escapeHtml(meta.titulo || "Informe de Reconocimiento Pasivo")}</div>
        <div class="cover-target">${escapeHtml(meta.target)}</div>

        <div class="cover-meta">
          <div class="cover-meta-item">
            <div class="cover-meta-label">Analista</div>
            <div class="cover-meta-value">${escapeHtml(meta.analista || "—")}</div>
          </div>
          <div class="cover-meta-item">
            <div class="cover-meta-label">Fecha</div>
            <div class="cover-meta-value">${fecha}</div>
          </div>
          <div class="cover-meta-item">
            <div class="cover-meta-label">Versión</div>
            <div class="cover-meta-value">${escapeHtml(meta.version || "1.0")}</div>
          </div>
          <div class="cover-meta-item">
            <div class="cover-meta-label">Hallazgos</div>
            <div class="cover-meta-value" style="color: #fca5a5;">${stats.total} (${stats.critico} críticos)</div>
          </div>
        </div>
      </div>

      <div class="cover-classification">
        <div class="cover-classification-badge">${escapeHtml(meta.clasificacion || "CONFIDENCIAL")}</div>
        <div class="cover-tool">condor-framework v0.1.0 · villaalextor</div>
      </div>
    </div>
  `
}

function buildTOC(fichas) {
  const sections = [
    { num: "1", title: "Resumen Ejecutivo" },
    { num: "2", title: "Metodología" },
    { num: "3", title: `Hallazgos (${fichas.length})` },
    { num: "4", title: "Fichas de Vulnerabilidad" },
    { num: "5", title: "Recomendaciones Generales" },
    { num: "6", title: "Conclusiones" },
  ]

  return `
    <div class="page-break">
      <div class="section-header">
        <div class="section-number">Navegación</div>
        <div class="section-title">Índice de contenidos</div>
      </div>
      ${sections.map(s => `
        <div class="toc-item">
          <div class="toc-number">${s.num}.</div>
          <div class="toc-title">${s.title}</div>
          <div class="toc-dots"></div>
        </div>
      `).join("")}
    </div>
  `
}

function buildExecutiveSummary(meta, fichas, stats) {
  const critColor = ss("CRÍTICO")
  const altoColor = ss("ALTO")
  const medColor  = ss("MEDIO")
  const bajoColor = ss("BAJO")

  const maxCount = Math.max(stats.critico, stats.alto, stats.medio, stats.bajo, 1)

  return `
    <div class="page-break">
      <div class="section-header">
        <div class="section-number">Sección 1</div>
        <div class="section-title">Resumen Ejecutivo</div>
      </div>

      <p style="margin-bottom: 16px; line-height: 1.8;">
        El presente informe documenta los resultados del reconocimiento pasivo OSINT
        realizado sobre <strong>${escapeHtml(meta.target)}</strong>.
        Se identificaron <strong>${stats.total} hallazgos de seguridad</strong> distribuidos
        en ${Object.keys(fichas.reduce((acc, f) => ({...acc, [f.categoria]: 1}), {})).length} categorías,
        utilizando exclusivamente fuentes públicas y sin generar tráfico directo al objetivo.
      </p>

      <!-- Métricas -->
      <div class="exec-metrics">
        <div class="metric-card">
          <div class="metric-value" style="color: ${critColor.badge};">${stats.critico}</div>
          <div class="metric-label">Críticos</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color: ${altoColor.badge};">${stats.alto}</div>
          <div class="metric-label">Altos</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color: ${medColor.badge};">${stats.medio}</div>
          <div class="metric-label">Medios</div>
        </div>
        <div class="metric-card">
          <div class="metric-value" style="color: ${bajoColor.badge};">${stats.bajo}</div>
          <div class="metric-label">Bajos</div>
        </div>
      </div>

      <!-- Distribución CVSS -->
      <div class="cvss-dist">
        ${[
          { sev: "CRÍTICO", count: stats.critico, color: critColor.badge },
          { sev: "ALTO",    count: stats.alto,    color: altoColor.badge },
          { sev: "MEDIO",   count: stats.medio,   color: medColor.badge  },
          { sev: "BAJO",    count: stats.bajo,    color: bajoColor.badge },
        ].map(({ sev, count, color }) => `
          <div class="cvss-row">
            <div class="cvss-label" style="color: ${color};">${sev}</div>
            <div class="cvss-bar-container">
              <div class="cvss-bar" style="width: ${(count/maxCount*100).toFixed(1)}%; background: ${color};">
                ${count > 0 ? count : ""}
              </div>
            </div>
            <div class="cvss-count">${count}</div>
          </div>
        `).join("")}
      </div>

      <!-- Top hallazgos -->
      <p class="mb-8 mt-16" style="font-weight: 700;">Hallazgos prioritarios:</p>
      <table class="findings-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Título</th>
            <th>CVSS</th>
            <th>Severidad</th>
            <th>Fuente</th>
          </tr>
        </thead>
        <tbody>
          ${fichas.slice(0, 10).map(f => {
            const c = ss(f.cvss.severity)
            return `
              <tr>
                <td class="mono" style="white-space: nowrap;">${f.id}</td>
                <td>${escapeHtml(f.titulo)}</td>
                <td class="mono" style="font-weight: 700; color: ${c.badge}; white-space: nowrap;">${f.cvss.score.toFixed(1)}</td>
                <td><span class="badge badge-severity" style="background: ${c.badge};">${f.cvss.severity}</span></td>
                <td class="mono text-muted">${f.fuente}</td>
              </tr>
            `
          }).join("")}
        </tbody>
      </table>
    </div>
  `
}

function buildMethodology(meta) {
  return `
    <div class="page-break">
      <div class="section-header">
        <div class="section-number">Sección 2</div>
        <div class="section-title">Metodología</div>
      </div>

      <p style="margin-bottom: 16px; line-height: 1.8;">
        El reconocimiento se realizó utilizando exclusivamente fuentes públicas y técnicas pasivas,
        sin generar tráfico directo hacia los sistemas del objetivo. Toda la información fue obtenida
        de bases de datos públicas, APIs de inteligencia y registros históricos.
      </p>

      <table class="findings-table">
        <thead><tr><th>Módulo</th><th>Fuente</th><th>Tipo de datos</th></tr></thead>
        <tbody>
          <tr><td class="mono">dns_recon</td><td>DNS público</td><td>Registros A, MX, NS, TXT, CNAME · Subdominios via crt.sh</td></tr>
          <tr><td class="mono">whois_lookup</td><td>WHOIS público</td><td>Registrante, fechas, registrar, nameservers</td></tr>
          <tr><td class="mono">wayback</td><td>archive.org CDX API</td><td>URLs históricas, archivos sensibles, tecnologías</td></tr>
          <tr><td class="mono">censys_query</td><td>Censys.io API v2</td><td>Hosts, puertos, servicios, certificados TLS</td></tr>
          <tr><td class="mono">shodan_query</td><td>Shodan API</td><td>Banners, versiones de software, CVEs detectados</td></tr>
          <tr><td class="mono">hunter_lookup</td><td>Hunter.io API</td><td>Emails corporativos, patrones, fuentes</td></tr>
        </tbody>
      </table>

      <p style="margin-top: 16px; line-height: 1.8; color: #475569; font-size: 9.5pt;">
        <strong>Alcance:</strong> Reconocimiento pasivo del dominio <span class="mono">${escapeHtml(meta.target)}</span>
        y sus subdominios. No se realizaron pruebas de penetración activas ni se accedió a
        sistemas sin autorización. Todos los datos provienen de fuentes indexadas públicamente.
      </p>
    </div>
  `
}

function buildCvssMetrics(metrics) {
  const metricLabels = {
    AV: { N: "Network", A: "Adjacent", L: "Local",    P: "Physical"  },
    AC: { L: "Low",     H: "High"                                      },
    PR: { N: "None",    L: "Low",      H: "High"                       },
    UI: { N: "None",    R: "Required"                                  },
    S:  { U: "Unchanged", C: "Changed"                                 },
    C:  { N: "None",    L: "Low",      H: "High"                       },
    I:  { N: "None",    L: "Low",      H: "High"                       },
    A:  { N: "None",    L: "Low",      H: "High"                       },
  }

  const items = [
    { code: "AV", name: "Attack Vector"     },
    { code: "AC", name: "Attack Complexity" },
    { code: "PR", name: "Privileges Req."   },
    { code: "UI", name: "User Interaction"  },
    { code: "S",  name: "Scope"             },
    { code: "C",  name: "Confidentiality"   },
    { code: "I",  name: "Integrity"         },
    { code: "A",  name: "Availability"      },
  ]

  return `
    <div class="cvss-metrics-grid">
      ${items.map(item => {
        const val   = metrics[item.code] || "?"
        const label = metricLabels[item.code]?.[val] || val
        return `
          <div class="cvss-metric-item">
            <div class="cvss-metric-name">${item.code}</div>
            <div class="cvss-metric-value">${val}</div>
            <div class="cvss-metric-label">${label}</div>
          </div>
        `
      }).join("")}
    </div>
  `
}

function buildFicha(ficha) {
  const c   = ss(ficha.cvss.severity)
  const rem = ficha.remediacion || {}

  return `
    <div class="ficha no-break">
      <!-- Header -->
      <div class="ficha-header" style="background: ${c.bg}; border-bottom: 2px solid ${c.border};">
        <div style="flex: 1;">
          <div class="ficha-id" style="color: ${c.text};">${ficha.id}</div>
          <div class="ficha-title" style="color: ${c.text};">${escapeHtml(ficha.titulo)}</div>
        </div>
        <div class="ficha-badges">
          <span class="badge badge-severity" style="background: ${c.badge};">${ficha.cvss.severity}</span>
          <span class="badge badge-source">${ficha.fuente}</span>
          ${ficha.cve_id ? `<span class="badge badge-cve">${escapeHtml(ficha.cve_id)}</span>` : ""}
        </div>
      </div>

      <!-- CVSS Score -->
      <div class="cvss-score-display">
        <div class="cvss-score-number" style="color: ${c.badge};">${ficha.cvss.score.toFixed(1)}</div>
        <div class="cvss-score-info" style="flex: 1;">
          <div style="font-weight: 700; font-size: 10pt;">CVSS v3.1 Base Score</div>
          <div class="cvss-vector">${ficha.cvss.vector}</div>
          <div style="margin-top: 8px;" class="cvss-score-bar">
            <div class="cvss-score-fill" style="width: ${cvssBarWidth(ficha.cvss.score)}; background: ${c.badge};"></div>
          </div>
        </div>
        ${rem.sla ? `<div class="sla-badge">SLA: ${escapeHtml(rem.sla)}</div>` : ""}
      </div>

      <!-- Métricas CVSS -->
      ${buildCvssMetrics(ficha.cvss.metrics || {})}

      <!-- Cuerpo -->
      <div class="ficha-body">

        <div class="ficha-field">
          <div class="ficha-field-label">Descripción</div>
          <div class="ficha-field-content">${escapeHtml(ficha.descripcion)}</div>
        </div>

        <div class="ficha-field">
          <div class="ficha-field-label">Evidencia técnica</div>
          <div class="evidencia-box">${escapeHtml(ficha.evidencia)}</div>
        </div>

        ${ficha.impacto ? `
          <div class="ficha-field">
            <div class="ficha-field-label">Impacto</div>
            <div class="ficha-field-content">${escapeHtml(ficha.impacto)}</div>
          </div>
        ` : ""}

        <div class="ficha-field">
          <div class="ficha-field-label">Recomendación de remediación</div>
          <div class="recomendacion-box">${escapeHtml(rem.immediate || ficha.recomendacion)}</div>
          ${rem.hardening && rem.hardening.length > 0 ? `
            <p style="font-size: 9pt; font-weight: 600; margin-top: 12px; margin-bottom: 4px; color: #475569;">
              Acciones de hardening adicionales:
            </p>
            <ul class="hardening-list">
              ${rem.hardening.slice(0, 5).map(h => `<li>${escapeHtml(h)}</li>`).join("")}
            </ul>
          ` : ""}
        </div>

        ${ficha.referencias && ficha.referencias.length > 0 ? `
          <div class="ficha-field">
            <div class="ficha-field-label">Referencias</div>
            <ul class="referencias-list">
              ${ficha.referencias.map(r => `<li>${escapeHtml(r)}</li>`).join("")}
            </ul>
          </div>
        ` : ""}

        <div class="ficha-field" style="display: flex; gap: 16px;">
          <div>
            <div class="ficha-field-label">Estado</div>
            <span class="badge badge-source">${ficha.estado || "abierto"}</span>
          </div>
          <div>
            <div class="ficha-field-label">Categoría</div>
            <span class="mono text-muted" style="font-size: 9pt;">${ficha.categoria}</span>
          </div>
          ${rem.difficulty ? `
            <div>
              <div class="ficha-field-label">Dificultad de remediación</div>
              <span class="mono text-muted" style="font-size: 9pt;">${rem.difficulty} (${rem.effort || "—"})</span>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
  `
}

function buildGeneralRecommendations(fichas) {
  const recs = generateGeneralRecommendations(fichas)
  return `
    <div class="page-break">
      <div class="section-header">
        <div class="section-number">Sección 5</div>
        <div class="section-title">Recomendaciones Generales</div>
      </div>
      <p style="margin-bottom: 20px; line-height: 1.8; color: #475569;">
        Adicional a las recomendaciones específicas de cada hallazgo, se sugieren
        las siguientes medidas transversales para mejorar la postura de seguridad general:
      </p>
      ${recs.map(rec => `
        <div class="rec-item">
          <div class="rec-bullet"></div>
          <div style="font-size: 10pt; line-height: 1.7;">${escapeHtml(rec)}</div>
        </div>
      `).join("")}
    </div>
  `
}

function buildConclusions(meta, fichas, stats) {
  const hasCritical = stats.critico > 0
  return `
    <div class="page-break">
      <div class="section-header">
        <div class="section-number">Sección 6</div>
        <div class="section-title">Conclusiones</div>
      </div>

      <p style="line-height: 1.8; margin-bottom: 16px;">
        El reconocimiento pasivo realizado sobre <strong>${escapeHtml(meta.target)}</strong>
        reveló una superficie de exposición ${hasCritical ? "significativa" : "moderada"} en
        fuentes públicas. Se identificaron <strong>${stats.total} hallazgos</strong>,
        de los cuales <strong>${stats.critico} son de severidad CRÍTICA</strong> y
        requieren atención inmediata.
      </p>

      ${hasCritical ? `
        <p style="line-height: 1.8; margin-bottom: 16px; padding: 12px 16px; background: #fee2e2; border-left: 4px solid #ef4444; border-radius: 0 8px 8px 0;">
          ⚠ Se detectaron ${stats.critico} hallazgo(s) crítico(s) que representan riesgo
          inmediato para la organización. Se recomienda iniciar la remediación de estos
          hallazgos en las próximas 24-72 horas.
        </p>
      ` : ""}

      <p style="line-height: 1.8; margin-bottom: 16px;">
        Todos los hallazgos documentados provienen de reconocimiento pasivo. La información
        utilizada está disponible públicamente, lo que significa que actores maliciosos
        podrían obtenerla sin mayor esfuerzo. La remediación de los hallazgos identificados
        reducirá significativamente la superficie de ataque expuesta.
      </p>

      <div class="report-footer">
        <span>Cóndor Framework v0.1.0 · github.com/villaalextor/condor-framework</span>
        <span>${escapeHtml(meta.clasificacion || "CONFIDENCIAL")} · ${formatDate(meta.fecha)}</span>
      </div>
    </div>
  `
}

// ─────────────────────────────────────────────
//  Builder HTML completo
// ─────────────────────────────────────────────
function buildFullHTML(meta, fichas) {
  const stats = {
    total:   fichas.length,
    critico: fichas.filter(f => f.cvss.severity === "CRÍTICO").length,
    alto:    fichas.filter(f => f.cvss.severity === "ALTO").length,
    medio:   fichas.filter(f => f.cvss.severity === "MEDIO").length,
    bajo:    fichas.filter(f => f.cvss.severity === "BAJO").length,
  }

  const fichasSection = fichas.map((f, i) => `
    ${i === 0 ? '<div class="page-break"><div class="section-header"><div class="section-number">Sección 4</div><div class="section-title">Fichas de Vulnerabilidad</div></div>' : ""}
    ${buildFicha(f)}
    ${i === 0 ? "</div>" : ""}
  `).join("")

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(meta.titulo || "Informe Cóndor Framework")}</title>
  <style>${buildCSS()}</style>
</head>
<body>
  ${buildCover(meta, stats)}
  ${buildTOC(fichas)}
  ${buildExecutiveSummary(meta, fichas, stats)}
  ${buildMethodology(meta)}

  <!-- Sección 3: Hallazgos -->
  <div class="page-break">
    <div class="section-header">
      <div class="section-number">Sección 3</div>
      <div class="section-title">Hallazgos (${fichas.length})</div>
    </div>
    <table class="findings-table">
      <thead>
        <tr><th>ID</th><th>Título</th><th>CVSS</th><th>Severidad</th><th>Categoría</th><th>Fuente</th></tr>
      </thead>
      <tbody>
        ${fichas.map(f => {
          const c = ss(f.cvss.severity)
          return `<tr>
            <td class="mono">${f.id}</td>
            <td>${escapeHtml(f.titulo)}</td>
            <td class="mono" style="font-weight:700;color:${c.badge};">${f.cvss.score.toFixed(1)}</td>
            <td><span class="badge badge-severity" style="background:${c.badge};">${f.cvss.severity}</span></td>
            <td class="mono text-muted" style="font-size:8pt;">${f.categoria}</td>
            <td class="mono text-muted">${f.fuente}</td>
          </tr>`
        }).join("")}
      </tbody>
    </table>
  </div>

  <!-- Sección 4: Fichas -->
  ${fichasSection}

  ${buildGeneralRecommendations(fichas)}
  ${buildConclusions(meta, fichas, stats)}
</body>
</html>`
}

// ─────────────────────────────────────────────
//  Función principal de generación PDF
// ─────────────────────────────────────────────

/**
 * Genera el informe PDF completo.
 *
 * @param {object} params
 *   @param {object} params.meta       — metadata del informe
 *   @param {Array}  params.fichas     — fichas enriquecidas
 *   @param {string} params.outputDir  — directorio de salida
 *   @param {number} params.timeout    — timeout Puppeteer (ms)
 * @returns {Promise<string>} ruta absoluta del PDF generado
 */
async function generatePDF({ meta, fichas, outputDir = "./output", timeout = 30000 }) {
  // Validar inputs
  if (!meta?.target) throw new Error("meta.target es requerido")
  if (!Array.isArray(fichas)) throw new Error("fichas debe ser un array")

  // Crear directorio de output si no existe
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Nombre del archivo
  const timestamp  = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
  const safeTarget = meta.target.replace(/[^a-zA-Z0-9.-]/g, "_")
  const filename   = `condor_report_${safeTarget}_${timestamp}.pdf`
  const outputPath = path.join(outputDir, filename)

  console.log(`[pdf] Generando informe para: ${meta.target}`)
  console.log(`[pdf] Fichas: ${fichas.length} | Output: ${outputPath}`)

  // Construir HTML
  const html = buildFullHTML(meta, fichas)

  // Lanzar Puppeteer
  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-web-security",
    ],
  })

  try {
    const page = await browser.newPage()

    // Configurar timeout
    page.setDefaultTimeout(timeout)

    // Cargar HTML
    await page.setContent(html, {
      waitUntil: "networkidle0",  // Esperar fuentes de Google Fonts
      timeout,
    })

    // Generar PDF
    await page.pdf({
      path:           outputPath,
      format:         "A4",
      printBackground: true,      // Incluir fondos (portada oscura)
      preferCSSPageSize: true,
      margin: {
        top:    "20mm",
        right:  "18mm",
        bottom: "22mm",
        left:   "18mm",
      },
      displayHeaderFooter: true,
      headerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;text-align:right;padding-right:18mm;font-family:sans-serif;">
        Cóndor Framework · ${escapeHtml(meta.target)} · CONFIDENCIAL
      </div>`,
      footerTemplate: `<div style="font-size:8px;color:#94a3b8;width:100%;text-align:center;font-family:sans-serif;">
        Página <span class="pageNumber"></span> de <span class="totalPages"></span>
      </div>`,
    })

    console.log(`[pdf] PDF generado exitosamente: ${outputPath}`)
    return outputPath

  } finally {
    await browser.close()
  }
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = {
  generatePDF,
  buildFullHTML,   // Exportado para preview en el frontend
}