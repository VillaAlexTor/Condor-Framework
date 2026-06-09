<!--
╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — ReportPreview.vue                ║
║  Preview del informe + exportación PDF               ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Vista final del flujo condor-report. Muestra un preview
  completo del informe antes de exportar y permite:
    - Editar la metadata del informe (título, analista, etc.)
    - Ver resumen de fichas con distribución CVSS
    - Preview de la portada del informe
    - Exportar a PDF via API backend
    - Descargar el PDF generado

PROPS:
  fichas     — array de fichas enriquecidas
  reportMeta — metadata del reporte original de condor-cli

EMITS:
  export-success — ruta del PDF generado
  edit-ficha     — navegar a editar una ficha específica
-->

<template>
  <div class="report-preview">

    <!-- ══════════════════════════════════════ -->
    <!-- Panel izquierdo: configuración        -->
    <!-- ══════════════════════════════════════ -->
    <div class="config-panel">

      <!-- ── Header ── -->
      <div class="config-header">
        <div class="config-title">
          <span>📄</span> Exportar informe
        </div>
        <div class="config-subtitle">
          Configurar metadata y generar PDF
        </div>
      </div>

      <!-- ── Metadata del informe ── -->
      <div class="config-section">
        <div class="section-label">Información del informe</div>

        <div class="field-group">
          <label class="field-label">Título del informe</label>
          <input
            v-model="meta.titulo"
            class="field-input"
            placeholder="Informe de Auditoría OSINT — objetivo.bo"
          />
        </div>

        <div class="field-group">
          <label class="field-label">Dominio / Target</label>
          <input
            v-model="meta.target"
            class="field-input mono"
            placeholder="objetivo.bo"
            readonly
          />
        </div>

        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Analista</label>
            <input
              v-model="meta.analista"
              class="field-input"
              placeholder="Nombre del analista"
            />
          </div>
          <div class="field-group">
            <label class="field-label">Fecha</label>
            <input
              v-model="meta.fecha"
              class="field-input"
              type="date"
            />
          </div>
        </div>

        <div class="field-row">
          <div class="field-group">
            <label class="field-label">Clasificación</label>
            <select v-model="meta.clasificacion" class="field-select">
              <option value="CONFIDENCIAL">CONFIDENCIAL</option>
              <option value="RESERVADO">RESERVADO</option>
              <option value="INTERNO">INTERNO</option>
              <option value="PÚBLICO">PÚBLICO</option>
            </select>
          </div>
          <div class="field-group">
            <label class="field-label">Versión</label>
            <input
              v-model="meta.version"
              class="field-input"
              placeholder="1.0"
            />
          </div>
        </div>
      </div>

      <!-- ── Opciones de exportación ── -->
      <div class="config-section">
        <div class="section-label">Opciones de exportación</div>

        <div class="export-options">
          <label class="option-item" v-for="opt in exportOptions" :key="opt.id">
            <input type="checkbox" v-model="opt.enabled" class="option-checkbox" />
            <span class="option-icon">{{ opt.icon }}</span>
            <div class="option-info">
              <div class="option-label">{{ opt.label }}</div>
              <div class="option-desc">{{ opt.desc }}</div>
            </div>
          </label>
        </div>
      </div>

      <!-- ── Estadísticas del reporte ── -->
      <div class="config-section">
        <div class="section-label">Resumen del informe</div>

        <div class="stats-grid">
          <div class="stat-item" :class="`stat-critico`">
            <div class="stat-value">{{ stats.critico }}</div>
            <div class="stat-label">Crítico</div>
          </div>
          <div class="stat-item stat-alto">
            <div class="stat-value">{{ stats.alto }}</div>
            <div class="stat-label">Alto</div>
          </div>
          <div class="stat-item stat-medio">
            <div class="stat-value">{{ stats.medio }}</div>
            <div class="stat-label">Medio</div>
          </div>
          <div class="stat-item stat-bajo">
            <div class="stat-value">{{ stats.bajo }}</div>
            <div class="stat-label">Bajo</div>
          </div>
        </div>

        <!-- Barra de distribución -->
        <div class="dist-bar">
          <div
            v-for="seg in distSegments"
            :key="seg.sev"
            class="dist-seg"
            :class="`seg-${seg.class}`"
            :style="{ width: seg.pct + '%' }"
            :title="`${seg.sev}: ${seg.count}`"
          />
        </div>
        <div class="dist-legend">
          <span v-for="seg in distSegments" :key="seg.sev" class="legend-item" :class="`lc-${seg.class}`">
            {{ seg.count }} {{ seg.sev }}
          </span>
        </div>
      </div>

      <!-- ── Botón de exportación ── -->
      <div class="export-section">
        <button
          class="export-btn"
          :class="{ loading: isGenerating, success: exportSuccess }"
          @click="generatePDF"
          :disabled="isGenerating || fichas.length === 0"
        >
          <span class="export-icon">{{ exportBtnIcon }}</span>
          <span class="export-label">{{ exportBtnLabel }}</span>
        </button>

        <!-- Descarga disponible -->
        <div class="download-ready" v-if="pdfUrl">
          <a :href="pdfUrl" download class="download-link">
            <span>⬇</span>
            Descargar PDF — {{ pdfFilename }}
          </a>
        </div>

        <!-- Error -->
        <div class="export-error" v-if="exportError">
          <span>⚠</span> {{ exportError }}
        </div>

        <!-- Sin fichas -->
        <div class="no-fichas" v-if="fichas.length === 0">
          Sin fichas para exportar — importar un reporte de condor-cli o crear fichas manualmente.
        </div>
      </div>

    </div>

    <!-- ══════════════════════════════════════ -->
    <!-- Panel derecho: preview del informe    -->
    <!-- ══════════════════════════════════════ -->
    <div class="preview-panel">

      <div class="preview-toolbar">
        <div class="preview-title">Vista previa del informe</div>
        <div class="preview-pages">{{ fichas.length + 5 }} páginas estimadas</div>
      </div>

      <!-- ── Simulación de páginas del informe ── -->
      <div class="preview-scroll">

        <!-- Portada simulada -->
        <div class="preview-page cover-page">
          <div class="cover-accent-bar" />
          <div class="cover-grid-bg" />
          <div class="cover-content">
            <div class="cover-tag-preview">🦅 CÓNDOR FRAMEWORK · OSINT AUDIT</div>
            <div class="cover-title-preview">{{ meta.titulo || "Informe de Auditoría OSINT" }}</div>
            <div class="cover-target-preview">{{ meta.target || "objetivo.bo" }}</div>
            <div class="cover-meta-preview">
              <div class="cmp-item">
                <div class="cmp-label">Analista</div>
                <div class="cmp-value">{{ meta.analista || "—" }}</div>
              </div>
              <div class="cmp-item">
                <div class="cmp-label">Fecha</div>
                <div class="cmp-value">{{ meta.fecha || today }}</div>
              </div>
              <div class="cmp-item">
                <div class="cmp-label">Hallazgos</div>
                <div class="cmp-value" style="color: #fca5a5;">{{ fichas.length }} ({{ stats.critico }} críticos)</div>
              </div>
              <div class="cmp-item">
                <div class="cmp-label">Versión</div>
                <div class="cmp-value">{{ meta.version || "1.0" }}</div>
              </div>
            </div>
          </div>
          <div class="cover-footer-preview">
            <span class="cover-class-badge">{{ meta.clasificacion }}</span>
            <span class="cover-tool-badge">condor-framework v0.1.0</span>
          </div>
        </div>

        <!-- Resumen ejecutivo simulado -->
        <div class="preview-page">
          <div class="preview-section-tag">1 · Resumen Ejecutivo</div>
          <div class="preview-metrics-row">
            <div class="pm-item pm-critico"><span class="pm-val">{{ stats.critico }}</span><span class="pm-lbl">CRÍTICO</span></div>
            <div class="pm-item pm-alto">   <span class="pm-val">{{ stats.alto    }}</span><span class="pm-lbl">ALTO</span></div>
            <div class="pm-item pm-medio">  <span class="pm-val">{{ stats.medio   }}</span><span class="pm-lbl">MEDIO</span></div>
            <div class="pm-item pm-bajo">   <span class="pm-val">{{ stats.bajo    }}</span><span class="pm-lbl">BAJO</span></div>
          </div>
          <div class="preview-table-mock">
            <div class="ptm-header">
              <span>ID</span><span>Título</span><span>CVSS</span><span>Sev.</span>
            </div>
            <div
              v-for="ficha in fichas.slice(0, 8)"
              :key="ficha.id"
              class="ptm-row"
              @click="$emit('edit-ficha', ficha.id)"
            >
              <span class="ptm-id">{{ ficha.id }}</span>
              <span class="ptm-title">{{ ficha.titulo?.slice(0, 45) }}{{ ficha.titulo?.length > 45 ? '...' : '' }}</span>
              <span class="ptm-score" :class="`ptms-${severityToClass(ficha.cvss?.severity)}`">
                {{ (ficha.cvss?.score || 0).toFixed(1) }}
              </span>
              <span class="ptm-sev" :class="`ptms-${severityToClass(ficha.cvss?.severity)}`">
                {{ ficha.cvss?.severity }}
              </span>
            </div>
            <div v-if="fichas.length > 8" class="ptm-more">
              + {{ fichas.length - 8 }} hallazgos más...
            </div>
          </div>
        </div>

        <!-- Preview de fichas individuales (primeras 3) -->
        <div
          v-for="ficha in fichas.slice(0, 3)"
          :key="ficha.id"
          class="preview-page ficha-page"
          @click="$emit('edit-ficha', ficha.id)"
          :class="`ficha-border-${severityToClass(ficha.cvss?.severity)}`"
        >
          <div class="preview-section-tag">Ficha · {{ ficha.id }}</div>

          <!-- Header de ficha -->
          <div class="pf-header" :class="`pfh-${severityToClass(ficha.cvss?.severity)}`">
            <div class="pf-id">{{ ficha.id }} · {{ ficha.fuente }}</div>
            <div class="pf-title">{{ ficha.titulo }}</div>
            <div class="pf-badges">
              <span class="pf-badge-sev" :class="`pfbs-${severityToClass(ficha.cvss?.severity)}`">
                {{ ficha.cvss?.severity }}
              </span>
              <span v-if="ficha.cve_id" class="pf-badge-cve">{{ ficha.cve_id }}</span>
            </div>
          </div>

          <!-- Score CVSS -->
          <div class="pf-score-row">
            <div class="pf-score" :class="`pfs-${severityToClass(ficha.cvss?.severity)}`">
              {{ (ficha.cvss?.score || 0).toFixed(1) }}
            </div>
            <div class="pf-score-info">
              <div class="pf-score-label">CVSS v3.1 Base Score</div>
              <div class="pf-vector">{{ ficha.cvss?.vector }}</div>
            </div>
          </div>

          <!-- Campos resumidos -->
          <div class="pf-field">
            <div class="pf-field-label">Descripción</div>
            <div class="pf-field-text">
              {{ ficha.descripcion?.slice(0, 200) }}{{ ficha.descripcion?.length > 200 ? '...' : '' }}
            </div>
          </div>

          <div class="pf-field">
            <div class="pf-field-label">Evidencia</div>
            <div class="pf-field-mono">{{ ficha.evidencia?.slice(0, 150) }}</div>
          </div>

          <div class="pf-field">
            <div class="pf-field-label">Recomendación</div>
            <div class="pf-field-rec">
              {{ (ficha.remediacion?.immediate || ficha.recomendacion)?.slice(0, 200) }}...
            </div>
          </div>

          <!-- Click hint -->
          <div class="ficha-click-hint">Clic para editar esta ficha</div>
        </div>

        <!-- Indicador de más fichas -->
        <div class="preview-page more-pages" v-if="fichas.length > 3">
          <div class="more-pages-content">
            <div class="more-icon">📋</div>
            <div class="more-text">
              + {{ fichas.length - 3 }} fichas más en el informe
            </div>
            <div class="more-sub">
              {{ fichas.slice(3).map(f => f.id).join(" · ") }}
            </div>
          </div>
        </div>

        <!-- Página de conclusiones -->
        <div class="preview-page">
          <div class="preview-section-tag">6 · Conclusiones</div>
          <div class="conclusions-preview">
            <p>
              El reconocimiento pasivo realizado sobre
              <strong>{{ meta.target }}</strong> reveló
              <strong>{{ fichas.length }} hallazgos</strong>
              de seguridad, de los cuales
              <strong>{{ stats.critico }}</strong>
              son de severidad crítica y requieren atención inmediata.
            </p>
            <p v-if="stats.critico > 0" class="conclusions-warning">
              ⚠ Se detectaron {{ stats.critico }} hallazgo(s) crítico(s).
              Iniciar remediación en las próximas 24-72 horas.
            </p>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, computed, reactive } from "vue"

// ─────────────────────────────────────────────
//  Props y emits
// ─────────────────────────────────────────────
const props = defineProps({
  fichas:     { type: Array,  required: true },
  reportMeta: { type: Object, default: () => ({}) },
})

const emit = defineEmits(["export-success", "edit-ficha"])

// ─────────────────────────────────────────────
//  Estado
// ─────────────────────────────────────────────
const today = new Date().toISOString().split("T")[0]

const meta = reactive({
  titulo:        props.reportMeta?.titulo        || `Informe de Auditoría OSINT — ${props.reportMeta?.target || "objetivo"}`,
  target:        props.reportMeta?.target        || "",
  analista:      props.reportMeta?.analista      || "",
  fecha:         props.reportMeta?.fecha         || today,
  clasificacion: props.reportMeta?.clasificacion || "CONFIDENCIAL",
  version:       props.reportMeta?.version       || "1.0",
})

const exportOptions = reactive([
  { id: "portada",   label: "Portada",             desc: "Página de título con metadata",       icon: "🎨", enabled: true  },
  { id: "toc",       label: "Índice",               desc: "Tabla de contenidos automática",      icon: "📑", enabled: true  },
  { id: "executive", label: "Resumen ejecutivo",    desc: "Métricas y top hallazgos",            icon: "📊", enabled: true  },
  { id: "method",    label: "Metodología",          desc: "Fuentes y herramientas utilizadas",   icon: "🔬", enabled: true  },
  { id: "fichas",    label: "Fichas técnicas",      desc: "Una página por vulnerabilidad",       icon: "📋", enabled: true  },
  { id: "recs",      label: "Recomendaciones",      desc: "Acciones generales de mejora",        icon: "✅", enabled: true  },
  { id: "conclus",   label: "Conclusiones",         desc: "Resumen final y próximos pasos",      icon: "🏁", enabled: true  },
])

const isGenerating  = ref(false)
const exportSuccess = ref(false)
const exportError   = ref("")
const pdfUrl        = ref("")
const pdfFilename   = ref("")

// ─────────────────────────────────────────────
//  Computados
// ─────────────────────────────────────────────
const stats = computed(() => ({
  total:   props.fichas.length,
  critico: props.fichas.filter(f => f.cvss?.severity === "CRÍTICO").length,
  alto:    props.fichas.filter(f => f.cvss?.severity === "ALTO").length,
  medio:   props.fichas.filter(f => f.cvss?.severity === "MEDIO").length,
  bajo:    props.fichas.filter(f => f.cvss?.severity === "BAJO").length,
}))

const distSegments = computed(() => {
  const total = stats.value.total || 1
  return [
    { sev: "CRÍTICO", count: stats.value.critico, class: "critico", pct: (stats.value.critico / total) * 100 },
    { sev: "ALTO",    count: stats.value.alto,    class: "alto",    pct: (stats.value.alto    / total) * 100 },
    { sev: "MEDIO",   count: stats.value.medio,   class: "medio",   pct: (stats.value.medio   / total) * 100 },
    { sev: "BAJO",    count: stats.value.bajo,    class: "bajo",    pct: (stats.value.bajo    / total) * 100 },
  ].filter(s => s.count > 0)
})

const exportBtnIcon = computed(() => {
  if (isGenerating.value)  return "⏳"
  if (exportSuccess.value) return "✓"
  return "🖨"
})

const exportBtnLabel = computed(() => {
  if (isGenerating.value)  return "Generando PDF..."
  if (exportSuccess.value) return "PDF generado"
  return `Generar PDF (${props.fichas.length} fichas)`
})

// ─────────────────────────────────────────────
//  Métodos
// ─────────────────────────────────────────────
function severityToClass(sev) {
  return { "CRÍTICO": "critico", "ALTO": "alto", "MEDIO": "medio", "BAJO": "bajo" }[sev] || "ninguno"
}

async function generatePDF() {
  if (isGenerating.value || props.fichas.length === 0) return

  isGenerating.value  = true
  exportError.value   = ""
  exportSuccess.value = false
  pdfUrl.value        = ""

  try {
    const response = await fetch("http://localhost:3001/api/report/generate", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        meta:   { ...meta },
        fichas: props.fichas,
        opciones: exportOptions.filter(o => o.enabled).map(o => o.id),
        formato: "pdf",
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ message: "Error desconocido" }))
      throw new Error(err.message || `HTTP ${response.status}`)
    }

    const data = await response.json()

    if (data.success && data.path) {
      exportSuccess.value = true
      pdfFilename.value   = data.filename || "informe.pdf"

      // Si el backend retorna la URL de descarga
      pdfUrl.value = data.downloadUrl || `http://localhost:3001/api/report/download/${data.filename}`

      emit("export-success", data.path)

      // Reset success state después de 5s
      setTimeout(() => { exportSuccess.value = false }, 5000)
    } else {
      throw new Error(data.message || "El backend no retornó la ruta del PDF")
    }

  } catch (err) {
    exportError.value = err.message || "Error al conectar con el backend. ¿Está corriendo en puerto 3001?"
  } finally {
    isGenerating.value = false
  }
}
</script>

<style scoped>
/* ── Layout principal ── */
.report-preview {
  display: flex;
  height: 100%;
  min-height: 80vh;
  font-family: 'Inter', -apple-system, sans-serif;
  background: #0a0e17;
  color: #e2e8f0;
}

/* ══════════════════════════════════════════ */
/* Panel de configuración (izquierdo)        */
/* ══════════════════════════════════════════ */
.config-panel {
  width: 340px;
  min-width: 300px;
  background: #070b12;
  border-right: 1px solid #1e293b;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
}

.config-header {
  padding: 20px;
  border-bottom: 1px solid #1e293b;
  background: #070b12;
}
.config-title {
  font-size: 14px;
  font-weight: 700;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.config-subtitle { font-size: 11px; color: #475569; }

.config-section {
  padding: 16px 20px;
  border-bottom: 1px solid #1e293b;
}
.section-label {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #475569;
  margin-bottom: 12px;
}

/* ── Campos ── */
.field-group  { margin-bottom: 12px; }
.field-row    { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px; }
.field-label  { display: block; font-size: 10px; color: #475569; margin-bottom: 4px; font-weight: 600; }

.field-input, .field-select {
  width: 100%;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 10px;
  color: #e2e8f0;
  font-size: 11px;
  font-family: inherit;
  outline: none;
  transition: border-color 0.15s;
}
.field-input:focus, .field-select:focus { border-color: #3b82f6; }
.field-input[readonly] { color: #64748b; cursor: default; }
.field-input.mono { font-family: 'JetBrains Mono', monospace; }
.field-select option { background: #1e293b; }

/* ── Opciones de exportación ── */
.export-options { space-y: 6px; }
.option-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid #1e293b;
  cursor: pointer;
  margin-bottom: 6px;
  transition: background 0.15s;
}
.option-item:hover { background: #1e293b; }
.option-checkbox { accent-color: #3b82f6; cursor: pointer; }
.option-icon { font-size: 14px; shrink: 0; }
.option-info { flex: 1; }
.option-label { font-size: 11px; font-weight: 600; color: #e2e8f0; }
.option-desc  { font-size: 9px;  color: #475569; margin-top: 1px; }

/* ── Estadísticas ── */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
  margin-bottom: 10px;
}
.stat-item {
  text-align: center;
  padding: 8px 4px;
  border-radius: 6px;
  border: 1px solid;
}
.stat-value { font-size: 18px; font-weight: 800; font-family: monospace; }
.stat-label { font-size: 8px;  font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-top: 2px; }

.stat-critico { background: rgba(239,68,68,0.1);  border-color: rgba(239,68,68,0.3);  }
.stat-critico .stat-value, .stat-critico .stat-label { color: #ef4444; }
.stat-alto    { background: rgba(249,115,22,0.1); border-color: rgba(249,115,22,0.3); }
.stat-alto    .stat-value, .stat-alto    .stat-label { color: #f97316; }
.stat-medio   { background: rgba(234,179,8,0.1);  border-color: rgba(234,179,8,0.3);  }
.stat-medio   .stat-value, .stat-medio   .stat-label { color: #eab308; }
.stat-bajo    { background: rgba(34,197,94,0.1);  border-color: rgba(34,197,94,0.3);  }
.stat-bajo    .stat-value, .stat-bajo    .stat-label { color: #22c55e; }

/* Barra de distribución */
.dist-bar {
  display: flex;
  height: 8px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 6px;
  gap: 1px;
}
.dist-seg { height: 100%; border-radius: 2px; transition: width 0.5s; }
.seg-critico { background: #ef4444; }
.seg-alto    { background: #f97316; }
.seg-medio   { background: #eab308; }
.seg-bajo    { background: #22c55e; }

.dist-legend { display: flex; flex-wrap: wrap; gap: 8px; }
.legend-item { font-size: 9px; font-weight: 600; }
.lc-critico  { color: #ef4444; }
.lc-alto     { color: #f97316; }
.lc-medio    { color: #eab308; }
.lc-bajo     { color: #22c55e; }

/* ── Exportación ── */
.export-section {
  padding: 20px;
  margin-top: auto;
  border-top: 1px solid #1e293b;
}
.export-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px;
  border-radius: 10px;
  border: none;
  font-size: 13px;
  font-weight: 700;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  color: white;
}
.export-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e40af, #2563eb);
  transform: translateY(-1px);
  box-shadow: 0 4px 16px rgba(59,130,246,0.4);
}
.export-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
.export-btn.loading  { background: linear-gradient(135deg, #475569, #64748b); }
.export-btn.success  { background: linear-gradient(135deg, #15803d, #22c55e); }

.export-icon  { font-size: 16px; }
.export-label { flex: 1; }

.download-ready {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(34,197,94,0.1);
  border: 1px solid rgba(34,197,94,0.3);
  border-radius: 8px;
}
.download-link {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #22c55e;
  text-decoration: none;
  font-size: 12px;
  font-weight: 600;
}
.download-link:hover { color: #4ade80; }

.export-error {
  margin-top: 10px;
  padding: 10px 12px;
  background: rgba(239,68,68,0.1);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 8px;
  font-size: 11px;
  color: #fca5a5;
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.no-fichas {
  margin-top: 10px;
  font-size: 11px;
  color: #475569;
  text-align: center;
  line-height: 1.5;
}

/* ══════════════════════════════════════════ */
/* Panel de preview (derecho)                */
/* ══════════════════════════════════════════ */
.preview-panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #1e293b;
  overflow: hidden;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #0f172a;
  border-bottom: 1px solid #1e293b;
}
.preview-title { font-size: 12px; font-weight: 600; color: #94a3b8; }
.preview-pages { font-size: 10px; color: #475569; font-family: monospace; }

.preview-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  background: #1e293b;
}

/* ── Página simulada ── */
.preview-page {
  width: 100%;
  max-width: 600px;
  background: white;
  border-radius: 4px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.4);
  overflow: hidden;
  color: #1e293b;
  font-size: 10px;
  position: relative;
}

/* ── Portada ── */
.cover-page {
  background: linear-gradient(160deg, #0f172a 0%, #1e3a5f 60%, #0f172a 100%);
  color: white;
  min-height: 320px;
  padding: 0;
  position: relative;
}
.cover-accent-bar {
  height: 4px;
  background: linear-gradient(90deg, #00ff88, #00d4ff, #7c3aed);
}
.cover-grid-bg {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 20px 20px;
}
.cover-content {
  position: relative;
  z-index: 1;
  padding: 24px;
}
.cover-tag-preview {
  font-size: 7px;
  letter-spacing: 0.25em;
  color: #00ff88;
  text-transform: uppercase;
  margin-bottom: 12px;
  font-family: monospace;
}
.cover-title-preview {
  font-size: 16px;
  font-weight: 800;
  color: white;
  margin-bottom: 10px;
  line-height: 1.2;
}
.cover-target-preview {
  font-size: 12px;
  font-family: monospace;
  color: #00d4ff;
  background: rgba(0,212,255,0.08);
  border: 1px solid rgba(0,212,255,0.2);
  border-radius: 4px;
  padding: 6px 10px;
  display: inline-block;
  margin-bottom: 16px;
}
.cover-meta-preview {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.cmp-item {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 4px;
  padding: 6px 8px;
}
.cmp-label { font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.1em; }
.cmp-value { font-size: 9px; font-weight: 600; color: white; margin-top: 2px; }

.cover-footer-preview {
  position: relative;
  z-index: 1;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 24px;
  border-top: 1px solid rgba(255,255,255,0.1);
  margin-top: 8px;
}
.cover-class-badge {
  font-size: 7px;
  font-weight: 700;
  letter-spacing: 0.15em;
  padding: 3px 8px;
  border-radius: 2px;
  background: rgba(239,68,68,0.2);
  color: #fca5a5;
  border: 1px solid rgba(239,68,68,0.3);
}
.cover-tool-badge { font-size: 7px; color: rgba(255,255,255,0.2); font-family: monospace; }

/* ── Página de resumen ── */
.preview-section-tag {
  background: #1e293b;
  color: #94a3b8;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  padding: 6px 16px;
  border-bottom: 1px solid #e2e8f0;
}
.preview-metrics-row {
  display: flex;
  padding: 12px 16px;
  gap: 8px;
  border-bottom: 1px solid #f1f5f9;
}
.pm-item {
  flex: 1;
  text-align: center;
  padding: 8px;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  border: 1px solid;
}
.pm-val { font-size: 20px; font-weight: 800; font-family: monospace; }
.pm-lbl { font-size: 7px; font-weight: 700; text-transform: uppercase; margin-top: 2px; }

.pm-critico { background: #fee2e2; border-color: #fca5a5; color: #dc2626; }
.pm-alto    { background: #ffedd5; border-color: #fdba74; color: #ea580c; }
.pm-medio   { background: #fef9c3; border-color: #fde047; color: #ca8a04; }
.pm-bajo    { background: #dcfce7; border-color: #86efac; color: #16a34a; }

/* ── Tabla mock ── */
.preview-table-mock { padding: 12px 16px; }
.ptm-header {
  display: grid;
  grid-template-columns: 60px 1fr 50px 60px;
  gap: 8px;
  font-size: 7px;
  font-weight: 700;
  text-transform: uppercase;
  color: #64748b;
  padding-bottom: 6px;
  border-bottom: 2px solid #1e293b;
  margin-bottom: 4px;
}
.ptm-row {
  display: grid;
  grid-template-columns: 60px 1fr 50px 60px;
  gap: 8px;
  padding: 5px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 8px;
  cursor: pointer;
  transition: background 0.1s;
  border-radius: 2px;
}
.ptm-row:hover { background: #f8fafc; }
.ptm-id    { font-family: monospace; color: #64748b; font-weight: 600; }
.ptm-title { color: #1e293b; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ptm-score { font-family: monospace; font-weight: 700; text-align: center; }
.ptm-sev   { font-weight: 700; font-size: 7px; text-align: center; }
.ptm-more  { font-size: 8px; color: #94a3b8; text-align: center; padding: 8px 0; }

.ptms-critico { color: #dc2626; }
.ptms-alto    { color: #ea580c; }
.ptms-medio   { color: #ca8a04; }
.ptms-bajo    { color: #16a34a; }
.ptms-ninguno { color: #64748b; }

/* ── Ficha preview ── */
.ficha-page { cursor: pointer; transition: box-shadow 0.15s; }
.ficha-page:hover { box-shadow: 0 8px 32px rgba(0,0,0,0.5); }
.ficha-click-hint {
  text-align: center;
  font-size: 8px;
  color: #94a3b8;
  padding: 6px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  opacity: 0;
  transition: opacity 0.15s;
}
.ficha-page:hover .ficha-click-hint { opacity: 1; }

.ficha-border-critico { border-top: 3px solid #ef4444; }
.ficha-border-alto    { border-top: 3px solid #f97316; }
.ficha-border-medio   { border-top: 3px solid #eab308; }
.ficha-border-bajo    { border-top: 3px solid #22c55e; }

.pf-header { padding: 12px 16px; border-bottom: 1px solid #e2e8f0; }
.pfh-critico { background: #fee2e2; }
.pfh-alto    { background: #ffedd5; }
.pfh-medio   { background: #fef9c3; }
.pfh-bajo    { background: #dcfce7; }
.pfh-ninguno { background: #f1f5f9; }

.pf-id    { font-size: 8px; font-family: monospace; color: #64748b; margin-bottom: 3px; }
.pf-title { font-size: 11px; font-weight: 700; color: #0f172a; margin-bottom: 6px; }
.pf-badges { display: flex; gap: 6px; }
.pf-badge-sev {
  font-size: 8px; font-weight: 700;
  padding: 2px 6px; border-radius: 3px; color: white;
}
.pfbs-critico { background: #dc2626; }
.pfbs-alto    { background: #ea580c; }
.pfbs-medio   { background: #ca8a04; }
.pfbs-bajo    { background: #16a34a; }
.pf-badge-cve {
  font-size: 8px; font-family: monospace;
  padding: 2px 6px; border-radius: 3px;
  background: #ede9fe; color: #5b21b6;
}

.pf-score-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}
.pf-score { font-size: 22px; font-weight: 900; font-family: monospace; }
.pfs-critico { color: #dc2626; }
.pfs-alto    { color: #ea580c; }
.pfs-medio   { color: #ca8a04; }
.pfs-bajo    { color: #16a34a; }
.pfs-ninguno { color: #64748b; }
.pf-score-info { flex: 1; }
.pf-score-label { font-size: 8px; font-weight: 600; color: #64748b; }
.pf-vector { font-size: 7px; font-family: monospace; color: #94a3b8; word-break: break-all; margin-top: 2px; }

.pf-field { padding: 8px 16px; border-bottom: 1px solid #f1f5f9; }
.pf-field:last-of-type { border-bottom: none; }
.pf-field-label { font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 4px; }
.pf-field-text  { font-size: 9px; color: #334155; line-height: 1.5; }
.pf-field-mono  {
  font-size: 8px; font-family: monospace; color: #e2e8f0;
  background: #0f172a; padding: 6px 8px; border-radius: 4px;
  line-height: 1.5; white-space: pre-wrap;
}
.pf-field-rec {
  font-size: 9px; color: #166534; background: #f0fdf4;
  border-left: 2px solid #22c55e; padding: 6px 10px;
  border-radius: 0 4px 4px 0; line-height: 1.5;
}

/* ── Más fichas ── */
.more-pages {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 120px;
  background: #0f172a;
  color: white;
}
.more-pages-content { text-align: center; padding: 24px; }
.more-icon  { font-size: 24px; margin-bottom: 8px; }
.more-text  { font-size: 13px; font-weight: 700; color: #e2e8f0; margin-bottom: 6px; }
.more-sub   { font-size: 9px; color: #475569; font-family: monospace; }

/* ── Conclusiones ── */
.conclusions-preview { padding: 16px; }
.conclusions-preview p { font-size: 9px; color: #334155; line-height: 1.7; margin-bottom: 10px; }
.conclusions-warning {
  background: #fee2e2;
  border-left: 3px solid #ef4444;
  padding: 8px 12px;
  border-radius: 0 4px 4px 0;
  color: #991b1b !important;
  font-weight: 600;
}
</style>