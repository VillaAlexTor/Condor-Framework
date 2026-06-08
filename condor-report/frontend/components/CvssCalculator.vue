<!--
╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — CvssCalculator.vue               ║
║  Calculadora CVSS 3.1 interactiva                    ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Componente Vue 3 que implementa la calculadora CVSS 3.1
  interactiva. El analista selecciona el valor de cada
  métrica con botones y el score se calcula en tiempo real.

  Funcionalidades:
    - 8 métricas con botones de selección
    - Score calculado en tiempo real (fórmula CVSS 3.1)
    - Vector string generado automáticamente
    - Descripción de cada opción al hacer hover
    - Presets de vectores comunes
    - Emit del vector seleccionado al componente padre

PROPS:
  initialVector  — vector CVSS inicial (opcional)
  compact        — modo compacto para el FichaEditor

EMITS:
  update:vector  — { vector, score, severity, metrics }
-->

<template>
  <div class="cvss-calc" :class="{ compact }">

    <!-- ── Header ── -->
    <div class="calc-header" v-if="!compact">
      <div class="calc-title">
        <span class="calc-icon">🛡</span>
        Calculadora CVSS 3.1
      </div>
      <a
        href="https://www.first.org/cvss/v3.1/specification-document"
        target="_blank"
        class="calc-ref-link"
      >
        Especificación FIRST ↗
      </a>
    </div>

    <!-- ── Score display ── -->
    <div class="score-display" :class="`score-${severityClass}`">
      <div class="score-left">
        <div class="score-number">{{ result.score.toFixed(1) }}</div>
        <div class="score-label">CVSS v3.1</div>
      </div>

      <div class="score-center">
        <div class="score-severity" :class="`sev-${severityClass}`">
          {{ result.severity }}
        </div>
        <!-- Barra de score -->
        <div class="score-bar-track">
          <div
            class="score-bar-fill"
            :class="`bar-${severityClass}`"
            :style="{ width: scoreBarWidth }"
          />
        </div>
        <div class="score-range-labels">
          <span>0</span>
          <span>4</span>
          <span>7</span>
          <span>9</span>
          <span>10</span>
        </div>
      </div>

      <div class="score-right">
        <div class="score-subscores" v-if="result.subscores">
          <div class="subscore-item">
            <span class="subscore-label">Impact</span>
            <span class="subscore-value">{{ result.subscores.impact.toFixed(2) }}</span>
          </div>
          <div class="subscore-item">
            <span class="subscore-label">Exploit</span>
            <span class="subscore-value">{{ result.subscores.exploitability.toFixed(2) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Vector string ── -->
    <div class="vector-display">
      <div class="vector-label">Vector string</div>
      <div class="vector-string">
        <span class="vector-prefix">CVSS:3.1/</span>
        <span
          v-for="(part, i) in vectorParts"
          :key="i"
          class="vector-part"
          :class="`vp-${part.metric.toLowerCase()}`"
        >
          {{ part.metric }}:<span class="vector-value">{{ part.value }}</span>
          <span v-if="i < vectorParts.length - 1" class="vector-sep">/</span>
        </span>
      </div>
      <button class="copy-btn" @click="copyVector" :class="{ copied: justCopied }">
        {{ justCopied ? "✓ Copiado" : "Copiar" }}
      </button>
    </div>

    <!-- ── Presets ── -->
    <div class="presets-section" v-if="!compact">
      <div class="presets-label">Presets comunes</div>
      <div class="presets-grid">
        <button
          v-for="preset in PRESETS"
          :key="preset.id"
          class="preset-btn"
          :class="`preset-${severityToClass(preset.severity)}`"
          @click="applyPreset(preset)"
          :title="preset.description"
        >
          <span class="preset-score">{{ preset.score }}</span>
          <span class="preset-name">{{ preset.name }}</span>
        </button>
      </div>
    </div>

    <!-- ── Métricas ── -->
    <div class="metrics-section">

      <!-- Grupo: Explotabilidad -->
      <div class="metric-group">
        <div class="group-label">
          <span class="group-dot dot-exploit" />
          Explotabilidad
        </div>

        <div
          v-for="metricId in ['AV', 'AC', 'PR', 'UI']"
          :key="metricId"
          class="metric-row"
        >
          <div class="metric-name-col">
            <div class="metric-code">{{ metricId }}</div>
            <div class="metric-name">{{ METRICS[metricId].shortName }}</div>
          </div>
          <div class="metric-options">
            <button
              v-for="opt in METRICS[metricId].options"
              :key="opt.value"
              class="metric-btn"
              :class="[
                `btn-${opt.color}`,
                { active: selected[metricId] === opt.value }
              ]"
              @click="selectMetric(metricId, opt.value)"
              @mouseenter="hovered = { metric: metricId, option: opt }"
              @mouseleave="hovered = null"
            >
              {{ opt.shortLabel }}
            </button>
          </div>
        </div>
      </div>

      <!-- Grupo: Alcance -->
      <div class="metric-group">
        <div class="group-label">
          <span class="group-dot dot-scope" />
          Alcance
        </div>
        <div class="metric-row">
          <div class="metric-name-col">
            <div class="metric-code">S</div>
            <div class="metric-name">{{ METRICS.S.shortName }}</div>
          </div>
          <div class="metric-options">
            <button
              v-for="opt in METRICS.S.options"
              :key="opt.value"
              class="metric-btn"
              :class="[
                `btn-${opt.color}`,
                { active: selected.S === opt.value }
              ]"
              @click="selectMetric('S', opt.value)"
              @mouseenter="hovered = { metric: 'S', option: opt }"
              @mouseleave="hovered = null"
            >
              {{ opt.shortLabel }}
            </button>
          </div>
        </div>
      </div>

      <!-- Grupo: Impacto CIA -->
      <div class="metric-group">
        <div class="group-label">
          <span class="group-dot dot-impact" />
          Impacto (CIA Triad)
        </div>
        <div
          v-for="metricId in ['C', 'I', 'A']"
          :key="metricId"
          class="metric-row"
        >
          <div class="metric-name-col">
            <div class="metric-code">{{ metricId }}</div>
            <div class="metric-name">{{ METRICS[metricId].shortName }}</div>
          </div>
          <div class="metric-options">
            <button
              v-for="opt in METRICS[metricId].options"
              :key="opt.value"
              class="metric-btn"
              :class="[
                `btn-${opt.color}`,
                { active: selected[metricId] === opt.value }
              ]"
              @click="selectMetric(metricId, opt.value)"
              @mouseenter="hovered = { metric: metricId, option: opt }"
              @mouseleave="hovered = null"
            >
              {{ opt.shortLabel }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ── Tooltip de descripción ── -->
    <transition name="fade">
      <div class="metric-tooltip" v-if="hovered">
        <div class="tooltip-header">
          <span class="tooltip-metric">{{ hovered.metric }}</span>
          <span class="tooltip-option">{{ hovered.option.label }}</span>
          <span class="tooltip-weight">peso: {{ hovered.option.weight ?? "—" }}</span>
        </div>
        <div class="tooltip-desc">{{ hovered.option.description }}</div>
        <div class="tooltip-example" v-if="hovered.option.example">
          <span class="tooltip-example-label">Ejemplo:</span>
          {{ hovered.option.example }}
        </div>
      </div>
    </transition>

    <!-- ── Reset ── -->
    <div class="calc-footer">
      <button class="reset-btn" @click="resetMetrics">
        Resetear métricas
      </button>
      <div class="calc-footer-note">
        Basado en FIRST CVSS v3.1 Specification
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from "vue"

// ─────────────────────────────────────────────
//  Props y emits
// ─────────────────────────────────────────────
const props = defineProps({
  initialVector: { type: String, default: "" },
  compact:       { type: Boolean, default: false },
})

const emit = defineEmits(["update:vector"])

// ─────────────────────────────────────────────
//  Definición de métricas (inline — no depende
//  de vectors.js para evitar imports en Vue SFC)
// ─────────────────────────────────────────────
const METRICS = {
  AV: {
    shortName: "Attack Vector",
    options: [
      { value: "N", shortLabel: "Network",   label: "Network",   color: "red",    weight: 0.85, description: "Explotable remotamente vía internet sin acceso físico ni adyacencia de red.", example: "CVE-2021-44228 (Log4Shell) — explotable desde internet" },
      { value: "A", shortLabel: "Adjacent",  label: "Adjacent",  color: "orange", weight: 0.62, description: "El atacante debe estar en la misma red local o segmento de broadcast.", example: "Vulnerabilidades en ARP, DHCP — requieren estar en la misma LAN" },
      { value: "L", shortLabel: "Local",     label: "Local",     color: "yellow", weight: 0.55, description: "Requiere acceso local al sistema (sesión interactiva o ejecutar archivo).", example: "Escalación de privilegios local con cuenta de usuario estándar" },
      { value: "P", shortLabel: "Physical",  label: "Physical",  color: "green",  weight: 0.20, description: "Requiere acceso físico al hardware del sistema.", example: "Cold Boot Attack, Evil Maid — requieren tocar el dispositivo" },
    ],
  },
  AC: {
    shortName: "Attack Complexity",
    options: [
      { value: "L", shortLabel: "Low",  label: "Low",  color: "red",   weight: 0.77, description: "Sin condiciones especiales. El ataque puede repetirse a voluntad.", example: "SQL Injection básico — no requiere condiciones del entorno" },
      { value: "H", shortLabel: "High", label: "High", color: "green", weight: 0.44, description: "Requiere condiciones específicas difíciles o conocimiento previo del objetivo.", example: "Race condition — sincronizar ataque con ventana de tiempo precisa" },
    ],
  },
  PR: {
    shortName: "Privileges Required",
    options: [
      { value: "N", shortLabel: "None", label: "None", color: "red",    weight: 0.85, description: "No se requieren privilegios. El atacante actúa como usuario anónimo.", example: "RCE pre-autenticación — cualquiera en internet puede atacar" },
      { value: "L", shortLabel: "Low",  label: "Low",  color: "orange", weight: 0.62, description: "Requiere cuenta de usuario estándar sin permisos especiales.", example: "IDOR — usuario autenticado accede a recursos de otros usuarios" },
      { value: "H", shortLabel: "High", label: "High", color: "green",  weight: 0.27, description: "Requiere privilegios administrativos sobre el componente vulnerable.", example: "Vulnerabilidad que solo puede explotarse siendo administrador" },
    ],
  },
  UI: {
    shortName: "User Interaction",
    options: [
      { value: "N", shortLabel: "None",     label: "None",     color: "red",   weight: 0.85, description: "No requiere que ningún usuario interactúe. Explotación completamente autónoma.", example: "WannaCry — se propaga automáticamente sin que nadie haga clic" },
      { value: "R", shortLabel: "Required", label: "Required", color: "green", weight: 0.62, description: "Requiere que una víctima tome una acción específica.", example: "Phishing con macro — la víctima debe abrir el documento" },
    ],
  },
  S: {
    shortName: "Scope",
    options: [
      { value: "U", shortLabel: "Unchanged", label: "Unchanged", color: "slate", description: "El impacto se limita al componente vulnerable. Sin efecto en otros sistemas.", example: "Vulnerabilidad en una app que solo afecta esa app" },
      { value: "C", shortLabel: "Changed",   label: "Changed",   color: "red",   description: "La vulnerabilidad permite impactar recursos más allá del componente original.", example: "VM escape — atacante dentro de VM compromete el hipervisor" },
    ],
  },
  C: {
    shortName: "Confidentiality",
    options: [
      { value: "N", shortLabel: "None", label: "None", color: "green",  weight: 0.00, description: "Sin impacto en confidencialidad. El atacante no puede obtener información." },
      { value: "L", shortLabel: "Low",  label: "Low",  color: "yellow", weight: 0.22, description: "Acceso limitado a información. Solo algunos datos de bajo impacto.", example: "Lectura de archivos de configuración no críticos" },
      { value: "H", shortLabel: "High", label: "High", color: "red",    weight: 0.56, description: "Pérdida total de confidencialidad. El atacante lee todos los datos.", example: "Dump completo de base de datos con credenciales" },
    ],
  },
  I: {
    shortName: "Integrity",
    options: [
      { value: "N", shortLabel: "None", label: "None", color: "green",  weight: 0.00, description: "Sin impacto en integridad. El atacante no puede modificar nada." },
      { value: "L", shortLabel: "Low",  label: "Low",  color: "yellow", weight: 0.22, description: "Modificación limitada. El atacante puede cambiar algunos datos pero sin control total.", example: "Modificar archivos en un directorio específico" },
      { value: "H", shortLabel: "High", label: "High", color: "red",    weight: 0.56, description: "Pérdida total de integridad. El atacante puede modificar cualquier dato.", example: "RCE — puede escribir y ejecutar código arbitrario" },
    ],
  },
  A: {
    shortName: "Availability",
    options: [
      { value: "N", shortLabel: "None", label: "None", color: "green",  weight: 0.00, description: "Sin impacto en disponibilidad. El sistema sigue funcionando normalmente." },
      { value: "L", shortLabel: "Low",  label: "Low",  color: "yellow", weight: 0.22, description: "Impacto reducido. El atacante degrada el rendimiento pero no detiene el servicio.", example: "Aumento de CPU que degrada rendimiento sin tumbar el servicio" },
      { value: "H", shortLabel: "High", label: "High", color: "red",    weight: 0.56, description: "Pérdida total de disponibilidad. El servicio queda completamente inaccesible.", example: "DoS que consume todos los recursos y cae el servicio" },
    ],
  },
}

const PRESETS = [
  { id: "rce_network",  name: "RCE Remoto",      score: 9.8,  severity: "CRÍTICO", description: "RCE sin autenticación vía red",           vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
  { id: "db_exposed",   name: "BD Expuesta",      score: 9.8,  severity: "CRÍTICO", description: "Base de datos accesible desde internet",   vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
  { id: "email_spoof",  name: "Email Spoofing",   score: 6.5,  severity: "MEDIO",   description: "Sin SPF/DMARC — spoofing posible",         vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:L/I:H/A:N" },
  { id: "tls_expired",  name: "TLS Expirado",     score: 4.2,  severity: "MEDIO",   description: "Certificado TLS expirado",                 vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N" },
  { id: "admin_panel",  name: "Panel Admin",      score: 6.5,  severity: "MEDIO",   description: "Panel admin expuesto en internet",         vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:L/A:N" },
  { id: "sens_file",    name: "Archivo Sensible", score: 7.5,  severity: "ALTO",    description: ".env/.bak en historial Wayback",           vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N" },
]

// ─────────────────────────────────────────────
//  Estado
// ─────────────────────────────────────────────
const DEFAULT_METRICS = { AV: "N", AC: "L", PR: "N", UI: "N", S: "U", C: "N", I: "N", A: "N" }

const selected    = ref({ ...DEFAULT_METRICS })
const hovered     = ref(null)
const justCopied  = ref(false)

// ─────────────────────────────────────────────
//  Calculadora CVSS 3.1 (implementación inline)
// ─────────────────────────────────────────────
const AV_W  = { N: 0.85, A: 0.62, L: 0.55, P: 0.20 }
const AC_W  = { L: 0.77, H: 0.44 }
const PR_W  = { UNCHANGED: { N: 0.85, L: 0.62, H: 0.27 }, CHANGED: { N: 0.85, L: 0.68, H: 0.50 } }
const UI_W  = { N: 0.85, R: 0.62 }
const CIA_W = { N: 0.00, L: 0.22, H: 0.56 }

function roundup(v) {
  const i = Math.round(v * 100000)
  return i % 10000 === 0 ? i / 100000 : (Math.floor(i / 10000) + 1) / 10
}

function cvssCalc(m) {
  const wAV = AV_W[m.AV] || 0
  const wAC = AC_W[m.AC] || 0
  const wPR = PR_W[m.S === "C" ? "CHANGED" : "UNCHANGED"][m.PR] || 0
  const wUI = UI_W[m.UI] || 0
  const wC  = CIA_W[m.C] || 0
  const wI  = CIA_W[m.I] || 0
  const wA  = CIA_W[m.A] || 0

  const ISCBase = 1 - (1 - wC) * (1 - wI) * (1 - wA)

  let impact
  if (m.S === "U") {
    impact = 6.42 * ISCBase
  } else {
    impact = 7.52 * (ISCBase - 0.029) - 3.25 * Math.pow(ISCBase - 0.02, 15)
  }

  const exploit = 8.22 * wAV * wAC * wPR * wUI

  let score = 0
  if (impact > 0) {
    score = m.S === "U"
      ? roundup(Math.min(impact + exploit, 10))
      : roundup(Math.min(1.08 * (impact + exploit), 10))
  }

  const severity =
    score >= 9.0 ? "CRÍTICO" :
    score >= 7.0 ? "ALTO"    :
    score >= 4.0 ? "MEDIO"   :
    score >  0.0 ? "BAJO"    : "NINGUNO"

  return {
    score,
    severity,
    subscores: {
      impact:          parseFloat(impact.toFixed(3)),
      exploitability:  parseFloat(exploit.toFixed(3)),
      iscBase:         parseFloat(ISCBase.toFixed(3)),
    },
  }
}

// ─────────────────────────────────────────────
//  Computados
// ─────────────────────────────────────────────
const result = computed(() => {
  try {
    return cvssCalc(selected.value)
  } catch {
    return { score: 0, severity: "NINGUNO", subscores: { impact: 0, exploitability: 0 } }
  }
})

const vectorString = computed(() => {
  const m = selected.value
  return `CVSS:3.1/AV:${m.AV}/AC:${m.AC}/PR:${m.PR}/UI:${m.UI}/S:${m.S}/C:${m.C}/I:${m.I}/A:${m.A}`
})

const vectorParts = computed(() => {
  const m = selected.value
  return [
    { metric: "AV", value: m.AV },
    { metric: "AC", value: m.AC },
    { metric: "PR", value: m.PR },
    { metric: "UI", value: m.UI },
    { metric: "S",  value: m.S  },
    { metric: "C",  value: m.C  },
    { metric: "I",  value: m.I  },
    { metric: "A",  value: m.A  },
  ]
})

const severityClass = computed(() => {
  return {
    "CRÍTICO": "critico",
    "ALTO":    "alto",
    "MEDIO":   "medio",
    "BAJO":    "bajo",
    "NINGUNO": "ninguno",
  }[result.value.severity] || "ninguno"
})

const scoreBarWidth = computed(() => {
  return `${(result.value.score / 10) * 100}%`
})

// ─────────────────────────────────────────────
//  Métodos
// ─────────────────────────────────────────────
function selectMetric(metric, value) {
  selected.value = { ...selected.value, [metric]: value }
}

function resetMetrics() {
  selected.value = { ...DEFAULT_METRICS }
}

function applyPreset(preset) {
  const parts = preset.vector.replace("CVSS:3.1/", "").split("/")
  const metrics = {}
  parts.forEach(p => {
    const [k, v] = p.split(":")
    metrics[k] = v
  })
  selected.value = { ...DEFAULT_METRICS, ...metrics }
}

function parseInitialVector(vectorStr) {
  if (!vectorStr) return
  try {
    const str   = vectorStr.replace("CVSS:3.1/", "")
    const parts = str.split("/")
    const metrics = {}
    parts.forEach(p => {
      const [k, v] = p.split(":")
      if (k && v) metrics[k] = v
    })
    selected.value = { ...DEFAULT_METRICS, ...metrics }
  } catch { /* mantener defaults */ }
}

async function copyVector() {
  try {
    await navigator.clipboard.writeText(vectorString.value)
    justCopied.value = true
    setTimeout(() => { justCopied.value = false }, 2000)
  } catch { /* fallback silencioso */ }
}

function severityToClass(sev) {
  return { "CRÍTICO": "critico", "ALTO": "alto", "MEDIO": "medio", "BAJO": "bajo" }[sev] || "ninguno"
}

// ─────────────────────────────────────────────
//  Watchers
// ─────────────────────────────────────────────
watch(
  [selected, result, vectorString],
  () => {
    emit("update:vector", {
      vector:   vectorString.value,
      score:    result.value.score,
      severity: result.value.severity,
      metrics:  { ...selected.value },
    })
  },
  { deep: true }
)

// ─────────────────────────────────────────────
//  Lifecycle
// ─────────────────────────────────────────────
onMounted(() => {
  if (props.initialVector) {
    parseInitialVector(props.initialVector)
  }
})
</script>

<style scoped>
/* ── Layout general ── */
.cvss-calc {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #0f172a;
  border-radius: 16px;
  overflow: hidden;
  color: #e2e8f0;
  border: 1px solid #1e293b;
}
.cvss-calc.compact { border-radius: 8px; }

/* ── Header ── */
.calc-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid #1e293b;
  background: #070b12;
}
.calc-title {
  font-size: 13px;
  font-weight: 700;
  color: #f1f5f9;
  display: flex;
  align-items: center;
  gap: 8px;
}
.calc-icon { font-size: 16px; }
.calc-ref-link {
  font-size: 10px;
  color: #3b82f6;
  text-decoration: none;
  opacity: 0.7;
  transition: opacity 0.15s;
}
.calc-ref-link:hover { opacity: 1; }

/* ── Score display ── */
.score-display {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 20px;
  background: #070b12;
  border-bottom: 1px solid #1e293b;
}
.score-left { text-align: center; shrink: 0; }
.score-number {
  font-size: 40px;
  font-weight: 900;
  font-family: 'JetBrains Mono', monospace;
  line-height: 1;
  transition: color 0.3s;
}
.score-label { font-size: 9px; color: #475569; text-transform: uppercase; letter-spacing: 0.1em; }

.score-center { flex: 1; }
.score-severity {
  font-size: 20px;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin-bottom: 8px;
  transition: color 0.3s;
}
.score-bar-track {
  height: 8px;
  background: #1e293b;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 4px;
}
.score-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.4s ease, background 0.3s;
}
.score-range-labels {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: #475569;
  font-family: monospace;
}

.score-right { shrink: 0; }
.score-subscores { display: flex; flex-direction: column; gap: 6px; }
.subscore-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #1e293b;
  border-radius: 6px;
  padding: 6px 10px;
  min-width: 64px;
}
.subscore-label { font-size: 8px; color: #64748b; text-transform: uppercase; letter-spacing: 0.08em; }
.subscore-value { font-size: 13px; font-weight: 700; font-family: monospace; color: #94a3b8; }

/* ── Colores por severidad ── */
.score-critico .score-number, .score-critico .score-severity { color: #ef4444; }
.score-alto    .score-number, .score-alto    .score-severity { color: #f97316; }
.score-medio   .score-number, .score-medio   .score-severity { color: #eab308; }
.score-bajo    .score-number, .score-bajo    .score-severity { color: #22c55e; }
.score-ninguno .score-number, .score-ninguno .score-severity { color: #64748b; }

.bar-critico { background: #ef4444; }
.bar-alto    { background: #f97316; }
.bar-medio   { background: #eab308; }
.bar-bajo    { background: #22c55e; }
.bar-ninguno { background: #475569; }

/* ── Vector string ── */
.vector-display {
  padding: 12px 20px;
  background: #070b12;
  border-bottom: 1px solid #1e293b;
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.vector-label {
  font-size: 9px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  shrink: 0;
}
.vector-string {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #94a3b8;
  word-break: break-all;
}
.vector-prefix { color: #475569; }
.vector-part   { }
.vector-value  { color: #00d4ff; font-weight: 700; }
.vector-sep    { color: #334155; margin: 0 1px; }

.copy-btn {
  shrink: 0;
  font-size: 10px;
  padding: 4px 10px;
  border-radius: 4px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #94a3b8;
  cursor: pointer;
  transition: all 0.15s;
  font-family: inherit;
}
.copy-btn:hover { border-color: #00d4ff; color: #00d4ff; }
.copy-btn.copied { border-color: #22c55e; color: #22c55e; background: #052e16; }

/* ── Presets ── */
.presets-section {
  padding: 12px 20px;
  border-bottom: 1px solid #1e293b;
  background: #0a0f1a;
}
.presets-label {
  font-size: 9px;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 8px;
}
.presets-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.preset-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 6px;
  border: 1px solid;
  cursor: pointer;
  font-family: inherit;
  font-size: 10px;
  transition: all 0.15s;
}
.preset-score {
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  font-size: 11px;
}
.preset-name { font-weight: 500; }

.preset-critico { background: rgba(239,68,68,0.1);  border-color: rgba(239,68,68,0.3);  color: #fca5a5; }
.preset-critico:hover { background: rgba(239,68,68,0.2); border-color: #ef4444; }
.preset-alto    { background: rgba(249,115,22,0.1); border-color: rgba(249,115,22,0.3); color: #fdba74; }
.preset-alto:hover    { background: rgba(249,115,22,0.2); }
.preset-medio   { background: rgba(234,179,8,0.1);  border-color: rgba(234,179,8,0.3);  color: #fde047; }
.preset-medio:hover   { background: rgba(234,179,8,0.2); }

/* ── Grupos de métricas ── */
.metrics-section { padding: 16px 20px; }
.metric-group    { margin-bottom: 20px; }
.metric-group:last-child { margin-bottom: 0; }

.group-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 9px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: #64748b;
  margin-bottom: 10px;
}
.group-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.dot-exploit { background: #3b82f6; }
.dot-scope   { background: #8b5cf6; }
.dot-impact  { background: #ef4444; }

.metric-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}
.metric-name-col {
  width: 110px;
  shrink: 0;
}
.metric-code {
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  font-weight: 700;
  color: #00d4ff;
}
.metric-name {
  font-size: 9px;
  color: #64748b;
  margin-top: 1px;
}
.metric-options {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

/* ── Botones de métrica ── */
.metric-btn {
  padding: 5px 12px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.15s;
  border: 1px solid transparent;
  background: #1e293b;
  color: #64748b;
}
.metric-btn:hover { border-color: #334155; color: #94a3b8; }

.metric-btn.active { color: white; font-weight: 700; }

/* Colores activos por semántica de riesgo */
.btn-red.active    { background: #dc2626; border-color: #dc2626; box-shadow: 0 0 8px rgba(220,38,38,0.4); }
.btn-orange.active { background: #ea580c; border-color: #ea580c; box-shadow: 0 0 8px rgba(234,88,12,0.4); }
.btn-yellow.active { background: #ca8a04; border-color: #ca8a04; box-shadow: 0 0 8px rgba(202,138,4,0.4); }
.btn-green.active  { background: #16a34a; border-color: #16a34a; box-shadow: 0 0 8px rgba(22,163,74,0.4); }
.btn-slate.active  { background: #475569; border-color: #475569; }

/* ── Tooltip ── */
.metric-tooltip {
  margin: 0 20px 16px;
  padding: 12px 16px;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 10px;
  font-size: 11px;
}
.tooltip-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}
.tooltip-metric { font-family: monospace; font-weight: 700; color: #00d4ff; }
.tooltip-option { font-weight: 600; color: #f1f5f9; }
.tooltip-weight { font-size: 9px; color: #475569; margin-left: auto; }
.tooltip-desc   { color: #94a3b8; line-height: 1.6; }
.tooltip-example {
  margin-top: 6px;
  font-size: 10px;
  color: #64748b;
  border-top: 1px solid #1e293b;
  padding-top: 6px;
}
.tooltip-example-label { font-weight: 600; color: #475569; margin-right: 4px; }

/* ── Footer ── */
.calc-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #1e293b;
  background: #070b12;
}
.reset-btn {
  font-size: 10px;
  padding: 5px 12px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.reset-btn:hover { border-color: #ef4444; color: #ef4444; }
.calc-footer-note { font-size: 9px; color: #334155; }

/* ── Transición tooltip ── */
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s, transform 0.15s; }
.fade-enter-from, .fade-leave-to { opacity: 0; transform: translateY(-4px); }
</style>