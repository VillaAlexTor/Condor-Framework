<template>
  <div class="app">

    <!-- ── Header global ── -->
    <header class="app-header">
      <div class="header-left">
        <div class="logo">
          <span class="logo-icon">🦅</span>
          <div>
            <div class="logo-title">CÓNDOR</div>
            <div class="logo-sub">Report Generator</div>
          </div>
        </div>

        <div class="target-badge" v-if="reportMeta.target">
          <span class="target-label">Target</span>
          <span class="target-value">{{ reportMeta.target }}</span>
        </div>
      </div>

      <!-- Stepper de navegación -->
      <nav class="stepper">
        <button
          v-for="(s, i) in STEPS"
          :key="s.id"
          class="step-btn"
          :class="{
            active:    step === s.id,
            completed: stepIndex(s.id) < stepIndex(step),
            disabled:  s.id !== 'import' && fichas.length === 0,
          }"
          @click="goToStep(s.id)"
        >
          <span class="step-number">{{ i + 1 }}</span>
          <span class="step-label">{{ s.label }}</span>
          <span v-if="s.id === 'edit' && fichas.length > 0" class="step-count">
            {{ fichas.length }}
          </span>
        </button>
      </nav>

      <!-- API status -->
      <div class="api-status" :class="apiStatus">
        <span class="status-dot" />
        {{ apiStatusLabel }}
      </div>
    </header>

    <!-- ── Contenido por step ── -->
    <main class="app-main">

      <!-- ══════════════════════════════ -->
      <!-- STEP 1: Import                -->
      <!-- ══════════════════════════════ -->
      <div v-if="step === 'import'" class="step-import">
        <ImportPanel
          @imported="onImported"
          @manual-start="onManualStart"
          :api-base="API_BASE"
        />
      </div>

      <!-- ══════════════════════════════ -->
      <!-- STEP 2: Edit fichas            -->
      <!-- ══════════════════════════════ -->
      <div v-else-if="step === 'edit'" class="step-edit">

        <div class="edit-toolbar">
          <div class="edit-toolbar-info">
            <span class="info-item">{{ fichas.length }} fichas</span>
            <span class="info-sep">·</span>
            <span class="info-item crit" v-if="stats.critico">{{ stats.critico }} críticas</span>
            <span class="info-item alto" v-if="stats.alto">{{ stats.alto }} altas</span>
          </div>

          <div class="edit-toolbar-actions">
            <select v-model="sortBy" class="sort-select">
              <option value="prioridad">Ordenar: Prioridad</option>
              <option value="score">Ordenar: CVSS score</option>
              <option value="categoria">Ordenar: Categoría</option>
              <option value="fuente">Ordenar: Fuente</option>
            </select>

            <button class="toolbar-btn" @click="addManualFicha">
              + Ficha manual
            </button>

            <button
              class="toolbar-btn primary"
              @click="step = 'preview'"
              :disabled="fichas.length === 0"
            >
              Ir a preview →
            </button>
          </div>
        </div>

        <!-- Filtro por severidad -->
        <div class="severity-filters">
          <button
            v-for="f in severityFilters"
            :key="f.id"
            class="sev-filter"
            :class="[`sf-${f.id.toLowerCase()}`, { active: activeSeverityFilter === f.id }]"
            @click="activeSeverityFilter = activeSeverityFilter === f.id ? 'all' : f.id"
          >
            {{ f.label }} ({{ f.count }})
          </button>
        </div>

        <!-- Lista de fichas -->
        <div class="fichas-list" v-if="filteredFichas.length > 0">
          <FichaEditor
            v-for="(ficha, i) in filteredFichas"
            :key="ficha.id"
            :ficha="ficha"
            :index="i"
            @update="updateFicha"
            @delete="deleteFicha"
            @duplicate="duplicateFicha"
          />
        </div>

        <!-- Sin fichas que mostrar (filtro) -->
        <div class="empty-filter" v-else-if="fichas.length > 0">
          <p>Sin fichas con severidad <strong>{{ activeSeverityFilter }}</strong></p>
          <button class="toolbar-btn" @click="activeSeverityFilter = 'all'">Ver todas</button>
        </div>

        <!-- Sin fichas en absoluto -->
        <div class="empty-state" v-else>
          <div class="empty-icon">📋</div>
          <p>Sin fichas todavía</p>
          <button class="toolbar-btn primary" @click="addManualFicha">+ Crear primera ficha</button>
          <button class="toolbar-btn" @click="step = 'import'">← Importar JSON de condor-cli</button>
        </div>
      </div>

      <!-- ══════════════════════════════ -->
      <!-- STEP 3: Preview + Export       -->
      <!-- ══════════════════════════════ -->
      <div v-else-if="step === 'preview'" class="step-preview">
        <ReportPreview
          :fichas="fichas"
          :report-meta="reportMeta"
          @export-success="onExportSuccess"
          @edit-ficha="onEditFicha"
        />
      </div>

    </main>

    <!-- ── Toast de notificaciones ── -->
    <transition name="toast">
      <div v-if="toast" class="toast" :class="`toast-${toast.type}`">
        <span class="toast-icon">{{ toast.icon }}</span>
        {{ toast.message }}
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue"
import ImportPanel    from "./components/ImportPanel.vue"
import FichaEditor    from "./components/FichaEditor.vue"
import ReportPreview  from "./components/ReportPreview.vue"

// ─────────────────────────────────────────────
//  Configuración
// ─────────────────────────────────────────────
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"

const STEPS = [
  { id: "import",  label: "Importar"  },
  { id: "edit",    label: "Editar fichas" },
  { id: "preview", label: "Preview & Export" },
]

// ─────────────────────────────────────────────
//  Estado global
// ─────────────────────────────────────────────
const step    = ref("import")
const fichas  = ref([])
const toast   = ref(null)
const sortBy  = ref("prioridad")
const activeSeverityFilter = ref("all")

const apiStatus = ref("checking")  // checking | online | offline

const reportMeta = ref({
  target:        "",
  titulo:        "",
  analista:      "",
  clasificacion: "CONFIDENCIAL",
  fecha:         new Date().toISOString().split("T")[0],
  version:       "1.0",
})

// ─────────────────────────────────────────────
//  Computados
// ─────────────────────────────────────────────
const stats = computed(() => ({
  total:   fichas.value.length,
  critico: fichas.value.filter(f => f.cvss?.severity === "CRÍTICO").length,
  alto:    fichas.value.filter(f => f.cvss?.severity === "ALTO").length,
  medio:   fichas.value.filter(f => f.cvss?.severity === "MEDIO").length,
  bajo:    fichas.value.filter(f => f.cvss?.severity === "BAJO").length,
}))

const severityFilters = computed(() => [
  { id: "all",     label: "Todas",   count: fichas.value.length },
  { id: "CRÍTICO", label: "Crítico", count: stats.value.critico },
  { id: "ALTO",    label: "Alto",    count: stats.value.alto    },
  { id: "MEDIO",   label: "Medio",   count: stats.value.medio   },
  { id: "BAJO",    label: "Bajo",    count: stats.value.bajo    },
].filter(f => f.id === "all" || f.count > 0))

const filteredFichas = computed(() => {
  let result = [...fichas.value]

  // Filtro por severidad
  if (activeSeverityFilter.value !== "all") {
    result = result.filter(f => f.cvss?.severity === activeSeverityFilter.value)
  }

  // Ordenamiento
  result.sort((a, b) => {
    switch (sortBy.value) {
      case "score":
        return (b.cvss?.score || 0) - (a.cvss?.score || 0)
      case "categoria":
        return (a.categoria || "").localeCompare(b.categoria || "")
      case "fuente":
        return (a.fuente || "").localeCompare(b.fuente || "")
      case "prioridad":
      default:
        if (a.prioridad !== b.prioridad) return (a.prioridad || 5) - (b.prioridad || 5)
        return (b.cvss?.score || 0) - (a.cvss?.score || 0)
    }
  })

  return result
})

const apiStatusLabel = computed(() => ({
  checking: "Verificando API...",
  online:   "API conectada",
  offline:  "API desconectada",
}[apiStatus.value]))

// ─────────────────────────────────────────────
//  Métodos — navegación
// ─────────────────────────────────────────────
function stepIndex(id) {
  return STEPS.findIndex(s => s.id === id)
}

function goToStep(id) {
  if (id !== "import" && fichas.value.length === 0) {
    showToast("Importa un reporte o crea una ficha manual primero", "warning", "⚠")
    return
  }
  step.value = id
}

// ─────────────────────────────────────────────
//  Métodos — import
// ─────────────────────────────────────────────
function onImported({ fichas: importedFichas, report_meta, informe_meta, stats: importStats }) {
  fichas.value = importedFichas

  reportMeta.value = {
    target:        informe_meta?.target        || report_meta?.target || "",
    titulo:        informe_meta?.titulo        || `Informe de Auditoría OSINT — ${report_meta?.target || ""}`,
    analista:      informe_meta?.analista      || "",
    clasificacion: informe_meta?.clasificacion || "CONFIDENCIAL",
    fecha:         informe_meta?.fecha         || new Date().toISOString().split("T")[0],
    version:       informe_meta?.version       || "1.0",
  }

  showToast(
    `${importedFichas.length} fichas generadas (${importStats?.critico || 0} críticas)`,
    "success",
    "✓"
  )

  step.value = "edit"
}

function onManualStart(target) {
  reportMeta.value.target = target || "objetivo"
  reportMeta.value.titulo = `Informe de Auditoría OSINT — ${target || "objetivo"}`
  step.value = "edit"

  if (fichas.value.length === 0) {
    addManualFicha()
  }
}

// ─────────────────────────────────────────────
//  Métodos — fichas
// ─────────────────────────────────────────────
async function addManualFicha() {
  try {
    const res  = await fetch(`${API_BASE}/api/ficha/new`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ fuente: "manual" }),
    })
    const data = await res.json()

    if (data.success) {
      fichas.value.unshift(data.ficha)
      showToast("Nueva ficha creada", "success", "+")
    }
  } catch {
    // Fallback local si la API no está disponible
    fichas.value.unshift({
      id: `VULN-MANUAL-${Date.now().toString(36).toUpperCase()}`,
      titulo: "", categoria: "", fuente: "manual", cve_id: null,
      descripcion: "", evidencia: "", impacto: "",
      cvss: {
        version: "3.1",
        vector:  "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N",
        score: 0, severity: "NINGUNO",
        metrics: { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "N" },
      },
      recomendacion: "", referencias: [], estado: "abierto", prioridad: 5,
      _meta: { auto_generated: false, source_module: "manual", raw: {} },
    })
    showToast("Nueva ficha creada (modo offline)", "warning", "+")
  }
}

function updateFicha(updated) {
  const idx = fichas.value.findIndex(f => f.id === updated.id)
  if (idx !== -1) {
    fichas.value[idx] = updated
  }
}

function deleteFicha(id) {
  fichas.value = fichas.value.filter(f => f.id !== id)
  showToast("Ficha eliminada", "info", "🗑")
}

function duplicateFicha(ficha) {
  const copy = JSON.parse(JSON.stringify(ficha))
  copy.id = `${ficha.id}-COPY-${Date.now().toString(36).slice(-4).toUpperCase()}`
  copy.titulo = `${ficha.titulo} (copia)`
  const idx = fichas.value.findIndex(f => f.id === ficha.id)
  fichas.value.splice(idx + 1, 0, copy)
  showToast("Ficha duplicada", "success", "⧉")
}

function onEditFicha(fichaId) {
  step.value = "edit"
  // Scroll a la ficha después de cambiar de step
  setTimeout(() => {
    const el = document.querySelector(`[data-ficha-id="${fichaId}"]`)
    el?.scrollIntoView({ behavior: "smooth", block: "center" })
  }, 100)
}

// ─────────────────────────────────────────────
//  Métodos — export
// ─────────────────────────────────────────────
function onExportSuccess(pdfPath) {
  showToast(`PDF generado: ${pdfPath.split("/").pop()}`, "success", "📄")
}

// ─────────────────────────────────────────────
//  Toast
// ─────────────────────────────────────────────
function showToast(message, type = "info", icon = "ℹ") {
  toast.value = { message, type, icon }
  setTimeout(() => { toast.value = null }, 4000)
}

// ─────────────────────────────────────────────
//  Health check
// ─────────────────────────────────────────────
async function checkApiHealth() {
  try {
    const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(3000) })
    apiStatus.value = res.ok ? "online" : "offline"
  } catch {
    apiStatus.value = "offline"
  }
}

// ─────────────────────────────────────────────
//  Lifecycle
// ─────────────────────────────────────────────
onMounted(() => {
  checkApiHealth()
  setInterval(checkApiHealth, 30000)  // Re-check cada 30s
})
</script>

<style scoped>
/* ── Reset / base ── */
.app {
  min-height: 100vh;
  background: #0a0e17;
  color: #e2e8f0;
  font-family: 'Inter', -apple-system, sans-serif;
  display: flex;
  flex-direction: column;
}

/* ── Header ── */
.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: #070b12;
  border-bottom: 1px solid #1e293b;
  gap: 24px;
  flex-wrap: wrap;
}
.header-left { display: flex; align-items: center; gap: 16px; }
.logo { display: flex; align-items: center; gap: 8px; }
.logo-icon { font-size: 24px; }
.logo-title { font-size: 14px; font-weight: 800; color: #00ff88; letter-spacing: 0.1em; line-height: 1; }
.logo-sub   { font-size: 9px; color: #475569; letter-spacing: 0.15em; text-transform: uppercase; }

.target-badge {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
}
.target-label { font-size: 8px; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; }
.target-value { font-size: 12px; font-family: 'JetBrains Mono', monospace; color: #00d4ff; font-weight: 700; }

/* ── Stepper ── */
.stepper {
  display: flex;
  gap: 4px;
  background: #0f172a;
  border-radius: 10px;
  padding: 4px;
}
.step-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.step-btn:hover:not(.disabled) { color: #94a3b8; }
.step-btn.active { background: #1d4ed8; color: white; }
.step-btn.completed:not(.active) { color: #00ff88; }
.step-btn.disabled { opacity: 0.4; cursor: not-allowed; }

.step-number {
  width: 18px; height: 18px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  display: flex; align-items: center; justify-content: center;
  font-size: 10px;
}
.step-count {
  font-size: 9px;
  padding: 1px 6px;
  border-radius: 8px;
  background: rgba(255,255,255,0.15);
}

/* ── API status ── */
.api-status {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-family: monospace;
  color: #475569;
}
.status-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #475569;
}
.api-status.online .status-dot  { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
.api-status.offline .status-dot { background: #ef4444; }
.api-status.online  { color: #22c55e; }
.api-status.offline { color: #ef4444; }

/* ── Main ── */
.app-main { flex: 1; overflow: hidden; display: flex; flex-direction: column; }

/* ── Step: import ── */
.step-import {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}

/* ── Step: edit ── */
.step-edit {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 16px 24px;
}

.edit-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  flex-wrap: wrap;
  gap: 12px;
}
.edit-toolbar-info {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}
.info-sep { color: #334155; }
.info-item.crit { color: #ef4444; font-weight: 700; }
.info-item.alto { color: #f97316; font-weight: 700; }

.edit-toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sort-select {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 6px;
  color: #94a3b8;
  font-size: 11px;
  padding: 6px 10px;
  font-family: inherit;
}
.toolbar-btn {
  font-size: 11px;
  font-weight: 600;
  padding: 7px 14px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #94a3b8;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  white-space: nowrap;
}
.toolbar-btn:hover:not(:disabled) { border-color: #3b82f6; color: #3b82f6; }
.toolbar-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.toolbar-btn.primary {
  background: linear-gradient(135deg, #1d4ed8, #3b82f6);
  border-color: transparent;
  color: white;
}
.toolbar-btn.primary:hover:not(:disabled) {
  background: linear-gradient(135deg, #1e40af, #2563eb);
}

/* ── Severity filters ── */
.severity-filters {
  display: flex;
  gap: 6px;
  margin-bottom: 12px;
}
.sev-filter {
  font-size: 10px;
  font-weight: 600;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid;
  background: transparent;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.sf-all     { border-color: #334155; color: #94a3b8; }
.sf-crítico { border-color: rgba(239,68,68,0.3);  color: #ef4444; }
.sf-alto    { border-color: rgba(249,115,22,0.3); color: #f97316; }
.sf-medio   { border-color: rgba(234,179,8,0.3);  color: #eab308; }
.sf-bajo    { border-color: rgba(34,197,94,0.3);  color: #22c55e; }

.sev-filter.active.sf-all     { background: #334155; color: white; }
.sev-filter.active.sf-crítico { background: rgba(239,68,68,0.2); }
.sev-filter.active.sf-alto    { background: rgba(249,115,22,0.2); }
.sev-filter.active.sf-medio   { background: rgba(234,179,8,0.2); }
.sev-filter.active.sf-bajo    { background: rgba(34,197,94,0.2); }

/* ── Lista de fichas ── */
.fichas-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-bottom: 24px;
}

/* ── Estados vacíos ── */
.empty-state, .empty-filter {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: #475569;
  text-align: center;
}
.empty-icon { font-size: 40px; opacity: 0.3; }
.empty-state p, .empty-filter p { font-size: 13px; }

/* ── Step: preview ── */
.step-preview { flex: 1; overflow: hidden; }

/* ── Toast ── */
.toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 18px;
  border-radius: 10px;
  font-size: 12px;
  font-weight: 600;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  z-index: 1000;
}
.toast-icon { font-size: 14px; }
.toast-success { background: #052e16; border: 1px solid #22c55e; color: #4ade80; }
.toast-warning { background: #2d1b03; border: 1px solid #f97316; color: #fb923c; }
.toast-info    { background: #0c1929; border: 1px solid #3b82f6; color: #60a5fa; }
.toast-error   { background: #2d0a0a; border: 1px solid #ef4444; color: #f87171; }

.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from, .toast-leave-to {
  opacity: 0;
  transform: translateY(20px);
}
</style>