<!--
╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — ImportPanel.vue                  ║
║  Panel de importación de JSON condor-cli             ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Pantalla inicial de condor-report. Permite:
    - Drag & drop o selección de archivo JSON de condor-cli
    - Envío a POST /api/report/import → genera fichas
    - Validación básica del JSON antes de enviar
    - Alternativa: empezar desde cero con fichas manuales

PROPS:
  apiBase — URL base del backend (ej: http://localhost:3001)

EMITS:
  imported     — { fichas, report_meta, informe_meta, stats }
  manual-start — target (string) — usuario eligió empezar manualmente
-->

<template>
  <div class="import-panel">

    <!-- ── Header ── -->
    <div class="panel-header">
      <pre class="ascii-logo">
  ██████╗ ██████╗ ███╗   ██╗██████╗  ██████╗ ██████╗
 ██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔═══██╗██╔══██╗
 ██║     ██║   ██║██╔██╗ ██║██║  ██║██║   ██║██████╔╝
 ██║     ██║   ██║██║╚██╗██║██║  ██║██║   ██║██╔══██╗
 ╚██████╗╚██████╔╝██║ ╚████║██████╔╝╚██████╔╝██║  ██║
  ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝
      </pre>
      <div class="panel-subtitle">Report Generator — Fichas CVSS 3.1 + Export PDF</div>
    </div>

    <!-- ── Drop zone ── -->
    <div
      class="dropzone"
      :class="{ dragging, error: !!error, loading: isLoading }"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="handleDrop"
      @click="!isLoading && triggerFileInput()"
    >
      <input
        ref="fileInput"
        type="file"
        accept=".json"
        class="hidden-input"
        @change="handleFileSelect"
      />

      <!-- Loading -->
      <div v-if="isLoading" class="dz-content">
        <div class="spinner" />
        <div class="dz-text">Procesando reporte...</div>
        <div class="dz-sub">Extrayendo hallazgos y calculando CVSS</div>
      </div>

      <!-- Normal -->
      <div v-else class="dz-content">
        <div class="dz-icon" :class="{ active: dragging }">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
        </div>
        <div class="dz-text">
          {{ dragging ? "Suelta el archivo aquí" : "Arrastrar reporte JSON de condor-cli" }}
        </div>
        <div class="dz-sub">o hacer clic para seleccionar archivo</div>

        <div class="dz-example">
          <span class="dz-cmd">python condor.py --target objetivo.bo --format json</span>
          <span class="dz-arrow">→</span>
          <span class="dz-file">scan.json</span>
        </div>
      </div>
    </div>

    <!-- ── Error ── -->
    <transition name="fade">
      <div v-if="error" class="error-box">
        <span class="error-icon">⚠</span>
        <div class="error-content">
          <div class="error-title">{{ error.title }}</div>
          <div class="error-detail">{{ error.detail }}</div>
        </div>
        <button class="error-dismiss" @click="error = null">✕</button>
      </div>
    </transition>

    <!-- ── Preview del archivo cargado (antes de confirmar) ── -->
    <transition name="fade">
      <div v-if="filePreview" class="file-preview">
        <div class="fp-header">
          <span class="fp-icon">📄</span>
          <div class="fp-info">
            <div class="fp-name">{{ filePreview.filename }}</div>
            <div class="fp-meta">
              Target: <span class="mono">{{ filePreview.target }}</span> ·
              {{ filePreview.modules }} módulos ·
              {{ filePreview.sizeKB }} KB
            </div>
          </div>
          <button class="fp-remove" @click="clearPreview">✕</button>
        </div>

        <!-- Resumen de módulos detectados -->
        <div class="fp-modules">
          <span
            v-for="mod in filePreview.modulesList"
            :key="mod.name"
            class="fp-module"
            :class="`fm-${mod.status}`"
          >
            <span class="fp-module-dot" />
            {{ mod.name }}
          </span>
        </div>

        <button class="confirm-btn" @click="confirmImport" :disabled="isLoading">
          {{ isLoading ? "Procesando..." : `Generar fichas desde este reporte →` }}
        </button>
      </div>
    </transition>

    <!-- ── Separador ── -->
    <div class="divider">
      <span class="divider-line" />
      <span class="divider-text">o</span>
      <span class="divider-line" />
    </div>

    <!-- ── Opción manual ── -->
    <div class="manual-section">
      <div class="manual-text">
        <div class="manual-title">Empezar desde cero</div>
        <div class="manual-sub">Crear fichas manualmente sin importar un reporte de condor-cli</div>
      </div>
      <div class="manual-input-group">
        <input
          v-model="manualTarget"
          class="manual-input mono"
          placeholder="objetivo.bo (opcional)"
          @keyup.enter="startManual"
        />
        <button class="manual-btn" @click="startManual">
          Crear ficha manual →
        </button>
      </div>
    </div>

    <!-- ── Reportes anteriores ── -->
    <div class="previous-section" v-if="previousReports.length > 0">
      <div class="previous-title">PDFs generados anteriormente</div>
      <div class="previous-list">
        <div v-for="file in previousReports" :key="file.filename" class="previous-item">
          <span class="prev-icon">📑</span>
          <div class="prev-info">
            <a :href="`${apiBase}${file.downloadUrl}`" target="_blank" class="prev-name">
              {{ file.filename }}
            </a>
            <div class="prev-meta">{{ file.sizeKB }} KB · {{ formatDate(file.createdAt) }}</div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"

// ─────────────────────────────────────────────
//  Props y emits
// ─────────────────────────────────────────────
const props = defineProps({
  apiBase: { type: String, default: "http://localhost:3001" },
})

const emit = defineEmits(["imported", "manual-start"])

// ─────────────────────────────────────────────
//  Estado
// ─────────────────────────────────────────────
const fileInput      = ref(null)
const dragging       = ref(false)
const isLoading      = ref(false)
const error          = ref(null)
const filePreview    = ref(null)   // { filename, target, modules, sizeKB, modulesList, rawJson }
const manualTarget   = ref("")
const previousReports = ref([])

// Módulos esperados en el JSON de condor-cli
const EXPECTED_MODULES = ["dns", "whois", "wayback", "censys", "shodan", "hunter"]

// ─────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────
function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString("es-BO", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    })
  } catch { return iso }
}

function triggerFileInput() {
  fileInput.value?.click()
}

function clearPreview() {
  filePreview.value = null
  error.value = null
  if (fileInput.value) fileInput.value.value = ""
}

// ─────────────────────────────────────────────
//  Validación y preview del archivo
// ─────────────────────────────────────────────
function validateAndPreview(file) {
  error.value = null

  if (!file.name.endsWith(".json")) {
    error.value = {
      title:  "Formato inválido",
      detail: "Solo se aceptan archivos .json generados por condor-cli (--format json)",
    }
    return
  }

  if (file.size > 20 * 1024 * 1024) {
    error.value = {
      title:  "Archivo muy grande",
      detail: "El archivo supera 20MB. Verifica que sea un reporte válido de condor-cli.",
    }
    return
  }

  const reader = new FileReader()

  reader.onload = (e) => {
    try {
      const json = JSON.parse(e.target.result)

      // Validar estructura básica
      if (!json.meta || !json.results) {
        error.value = {
          title:  "Estructura inválida",
          detail: "El JSON debe tener las claves 'meta' y 'results' generadas por condor-cli.",
        }
        return
      }

      if (!json.meta.target) {
        error.value = {
          title:  "Falta el target",
          detail: "El JSON no especifica meta.target — verifica que sea un reporte completo.",
        }
        return
      }

      // Construir lista de módulos con su estado
      const modulesList = EXPECTED_MODULES.map(name => {
        const moduleData = json.results[name]
        let status = "missing"

        if (!moduleData) status = "missing"
        else if (moduleData.status === "ok")       status = "ok"
        else if (moduleData.status === "skipped")  status = "skipped"
        else if (moduleData.status === "error")    status = "error"
        else if (moduleData.status === "not_implemented") status = "missing"

        return { name, status }
      })

      const okModules = modulesList.filter(m => m.status === "ok").length

      if (okModules === 0) {
        error.value = {
          title:  "Sin datos para procesar",
          detail: "Ningún módulo tiene status 'ok'. Verifica que el escaneo se ejecutó correctamente.",
        }
        return
      }

      filePreview.value = {
        filename:    file.name,
        target:      json.meta.target,
        modules:     okModules,
        sizeKB:      Math.round(file.size / 1024),
        modulesList,
        rawJson:     json,
      }

    } catch {
      error.value = {
        title:  "JSON inválido",
        detail: "El archivo no se pudo parsear. Verifica que sea un JSON válido generado por condor-cli.",
      }
    }
  }

  reader.onerror = () => {
    error.value = {
      title:  "Error de lectura",
      detail: "No se pudo leer el archivo. Intenta de nuevo.",
    }
  }

  reader.readAsText(file)
}

// ─────────────────────────────────────────────
//  Handlers de drag & drop / selección
// ─────────────────────────────────────────────
function handleDrop(e) {
  dragging.value = false
  const file = e.dataTransfer.files[0]
  if (file) validateAndPreview(file)
}

function handleFileSelect(e) {
  const file = e.target.files[0]
  if (file) validateAndPreview(file)
}

// ─────────────────────────────────────────────
//  Confirmar import — enviar al backend
// ─────────────────────────────────────────────
async function confirmImport() {
  if (!filePreview.value || isLoading.value) return

  isLoading.value = true
  error.value     = null

  try {
    const response = await fetch(`${props.apiBase}/api/report/import`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(filePreview.value.rawJson),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({}))
      throw new Error(err.message || `HTTP ${response.status}`)
    }

    const data = await response.json()

    if (!data.success) {
      throw new Error(data.message || "Error desconocido al importar")
    }

    if (data.fichas.length === 0) {
      error.value = {
        title:  "Sin hallazgos detectados",
        detail: "El reporte fue procesado pero no se generaron fichas. Puedes crear fichas manualmente.",
      }
      isLoading.value = false
      return
    }

    emit("imported", {
      fichas:       data.fichas,
      report_meta:  data.report_meta,
      informe_meta: data.informe_meta,
      stats:        data.stats,
    })

  } catch (err) {
    error.value = {
      title:  "Error al procesar el reporte",
      detail: err.message?.includes("fetch")
        ? `No se pudo conectar con el backend (${props.apiBase}). ¿Está corriendo 'npm run dev' en condor-report/backend?`
        : err.message,
    }
  } finally {
    isLoading.value = false
  }
}

// ─────────────────────────────────────────────
//  Modo manual
// ─────────────────────────────────────────────
function startManual() {
  emit("manual-start", manualTarget.value.trim() || "objetivo")
}

// ─────────────────────────────────────────────
//  Cargar reportes PDF anteriores
// ─────────────────────────────────────────────
async function loadPreviousReports() {
  try {
    const res  = await fetch(`${props.apiBase}/api/report/list`, { signal: AbortSignal.timeout(3000) })
    const data = await res.json()
    if (data.success) {
      previousReports.value = data.files.slice(0, 5)
    }
  } catch {
    // Silencioso — no es crítico
  }
}

onMounted(() => {
  loadPreviousReports()
})
</script>

<style scoped>
.import-panel {
  width: 100%;
  max-width: 640px;
  font-family: 'Inter', -apple-system, sans-serif;
}

/* ── Header ── */
.panel-header { text-align: center; margin-bottom: 32px; }
.ascii-logo {
  font-size: 9px;
  line-height: 1.2;
  color: #00ff88;
  font-family: 'JetBrains Mono', monospace;
  margin-bottom: 12px;
}
.panel-subtitle {
  font-size: 11px;
  color: #475569;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

/* ── Dropzone ── */
.dropzone {
  border: 2px dashed #334155;
  border-radius: 16px;
  padding: 40px 24px;
  text-align: center;
  cursor: pointer;
  transition: all 0.25s;
  background: #0f172a;
  margin-bottom: 16px;
}
.dropzone:hover { border-color: #475569; background: #131c2e; }
.dropzone.dragging {
  border-color: #00ff88;
  background: rgba(0,255,136,0.05);
  transform: scale(1.01);
}
.dropzone.error { border-color: #ef4444; }
.dropzone.loading { cursor: wait; border-color: #3b82f6; }

.hidden-input { display: none; }

.dz-content { display: flex; flex-direction: column; align-items: center; gap: 8px; }
.dz-icon { color: #475569; transition: color 0.2s, transform 0.2s; }
.dz-icon.active { color: #00ff88; transform: translateY(-4px); }
.dz-text { font-size: 13px; font-weight: 600; color: #cbd5e1; }
.dz-sub  { font-size: 11px; color: #475569; }

.dz-example {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
}
.dz-cmd   { color: #00ff88; padding: 4px 8px; background: #1e293b; border-radius: 4px; }
.dz-arrow { color: #334155; }
.dz-file  { color: #00d4ff; padding: 4px 8px; background: #1e293b; border-radius: 4px; }

/* ── Spinner ── */
.spinner {
  width: 32px; height: 32px;
  border: 3px solid #1e293b;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }

/* ── Error box ── */
.error-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: rgba(239,68,68,0.08);
  border: 1px solid rgba(239,68,68,0.3);
  border-radius: 10px;
  margin-bottom: 16px;
}
.error-icon { font-size: 16px; color: #ef4444; shrink: 0; }
.error-content { flex: 1; }
.error-title  { font-size: 12px; font-weight: 700; color: #fca5a5; }
.error-detail { font-size: 11px; color: #94a3b8; margin-top: 2px; line-height: 1.5; }
.error-dismiss {
  background: none; border: none; color: #475569;
  cursor: pointer; font-size: 12px; shrink: 0;
}
.error-dismiss:hover { color: #ef4444; }

/* ── File preview ── */
.file-preview {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
}
.fp-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.fp-icon { font-size: 24px; }
.fp-info { flex: 1; }
.fp-name { font-size: 13px; font-weight: 700; color: #e2e8f0; }
.fp-meta { font-size: 10px; color: #475569; margin-top: 2px; }
.mono { font-family: 'JetBrains Mono', monospace; color: #00d4ff; }
.fp-remove {
  background: none; border: none; color: #475569;
  cursor: pointer; font-size: 12px;
}
.fp-remove:hover { color: #ef4444; }

.fp-modules { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.fp-module {
  display: flex; align-items: center; gap: 5px;
  font-size: 10px; font-family: monospace; font-weight: 600;
  padding: 4px 10px; border-radius: 12px;
  background: #1e293b; color: #64748b;
}
.fp-module-dot { width: 6px; height: 6px; border-radius: 50%; }
.fm-ok      .fp-module-dot { background: #22c55e; }
.fm-ok      { color: #86efac; }
.fm-skipped .fp-module-dot { background: #eab308; }
.fm-skipped { color: #fde047; }
.fm-error   .fp-module-dot { background: #ef4444; }
.fm-error   { color: #fca5a5; }
.fm-missing .fp-module-dot { background: #334155; }
.fm-missing { color: #475569; }

.confirm-btn {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: none;
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  color: white;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.2s;
}
.confirm-btn:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e40af, #2563eb);
  transform: translateY(-1px);
}
.confirm-btn:disabled { opacity: 0.6; cursor: wait; }

/* ── Divider ── */
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 20px 0;
}
.divider-line { flex: 1; height: 1px; background: #1e293b; }
.divider-text { font-size: 10px; color: #475569; text-transform: uppercase; letter-spacing: 0.2em; }

/* ── Manual section ── */
.manual-section {
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 12px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.manual-title { font-size: 12px; font-weight: 700; color: #cbd5e1; }
.manual-sub   { font-size: 10px; color: #475569; margin-top: 2px; }

.manual-input-group { display: flex; gap: 8px; }
.manual-input {
  flex: 1;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 8px 10px;
  color: #e2e8f0;
  font-size: 11px;
  font-family: inherit;
  outline: none;
}
.manual-input:focus { border-color: #3b82f6; }
.manual-btn {
  padding: 8px 16px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #94a3b8;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  white-space: nowrap;
  transition: all 0.15s;
}
.manual-btn:hover { border-color: #00ff88; color: #00ff88; }

/* ── Reportes anteriores ── */
.previous-section { margin-top: 24px; }
.previous-title {
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.15em;
  color: #334155;
  margin-bottom: 8px;
}
.previous-list { display: flex; flex-direction: column; gap: 6px; }
.previous-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  background: #0f172a;
  border: 1px solid #1e293b;
  border-radius: 8px;
}
.prev-icon { font-size: 14px; }
.prev-info { flex: 1; }
.prev-name {
  font-size: 11px;
  color: #00d4ff;
  text-decoration: none;
  font-family: monospace;
}
.prev-name:hover { text-decoration: underline; }
.prev-meta { font-size: 9px; color: #475569; margin-top: 1px; }

/* ── Transiciones ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>