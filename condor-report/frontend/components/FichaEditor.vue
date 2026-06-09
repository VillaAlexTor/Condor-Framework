<!--
╔══════════════════════════════════════════════════════╗
║  CÓNDOR FRAMEWORK — FichaEditor.vue                  ║
║  Editor completo de fichas de vulnerabilidad         ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Editor principal de fichas de vulnerabilidad.
  Permite crear y editar cada campo de una ficha,
  con la calculadora CVSS 3.1 integrada.

  Campos editables:
    - Título, categoría, fuente, CVE ID
    - Descripción, evidencia, impacto
    - Vector CVSS 3.1 (via CvssCalculator)
    - Recomendación de remediación
    - Referencias, estado, prioridad

PROPS:
  ficha    — ficha a editar (objeto completo)
  index    — índice en la lista de fichas

EMITS:
  update   — ficha actualizada
  delete   — eliminar esta ficha
  duplicate — duplicar esta ficha
-->

<template>
  <div class="ficha-editor" :class="{ expanded: isExpanded }">

    <!-- ── Header colapsable ── -->
    <div
      class="editor-header"
      :class="`header-${severityClass}`"
      @click="isExpanded = !isExpanded"
    >
      <div class="header-left">
        <!-- Drag handle -->
        <div class="drag-handle" @click.stop title="Arrastrar para reordenar">⠿</div>

        <!-- ID + severidad -->
        <div class="header-id-badge">
          <span class="ficha-id">{{ localFicha.id }}</span>
          <span class="severity-badge" :class="`sev-${severityClass}`">
            {{ localFicha.cvss?.severity || "—" }}
          </span>
          <span class="score-badge" :class="`score-${severityClass}`">
            {{ (localFicha.cvss?.score || 0).toFixed(1) }}
          </span>
        </div>

        <!-- Título -->
        <div class="header-title" :class="{ empty: !localFicha.titulo }">
          {{ localFicha.titulo || "Sin título — hacer clic para editar" }}
        </div>
      </div>

      <div class="header-right" @click.stop>
        <!-- Acciones -->
        <button class="action-btn" @click="$emit('duplicate', localFicha)" title="Duplicar ficha">
          ⧉
        </button>
        <button class="action-btn danger" @click="confirmDelete" title="Eliminar ficha">
          ✕
        </button>
        <span class="expand-icon" :class="{ rotated: isExpanded }">▼</span>
      </div>
    </div>

    <!-- ── Cuerpo del editor ── -->
    <transition name="slide">
      <div class="editor-body" v-if="isExpanded">

        <!-- ── Tabs de navegación ── -->
        <div class="editor-tabs">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            class="tab-btn"
            :class="{ active: activeTab === tab.id }"
            @click="activeTab = tab.id"
          >
            <span class="tab-icon">{{ tab.icon }}</span>
            {{ tab.label }}
            <span v-if="tab.id === 'cvss'" class="tab-score" :class="`ts-${severityClass}`">
              {{ (localFicha.cvss?.score || 0).toFixed(1) }}
            </span>
          </button>
        </div>

        <!-- ══════════════════════════════════ -->
        <!-- Tab: Información general           -->
        <!-- ══════════════════════════════════ -->
        <div class="tab-content" v-if="activeTab === 'info'">

          <!-- Título -->
          <div class="field-group">
            <label class="field-label required">Título</label>
            <input
              v-model="localFicha.titulo"
              class="field-input"
              placeholder="Ej: Servidor MySQL expuesto públicamente en 190.x.x.x"
              @input="emitUpdate"
            />
            <div class="field-hint">Descripción corta y específica del hallazgo</div>
          </div>

          <!-- Categoría + Fuente en grid -->
          <div class="field-row">
            <div class="field-group">
              <label class="field-label required">Categoría</label>
              <select v-model="localFicha.categoria" class="field-select" @change="applyRecommendation">
                <option value="">Seleccionar categoría...</option>
                <option v-for="cat in CATEGORIES" :key="cat.id" :value="cat.id">
                  {{ cat.label }}
                </option>
              </select>
            </div>

            <div class="field-group">
              <label class="field-label">Fuente</label>
              <select v-model="localFicha.fuente" class="field-select" @change="emitUpdate">
                <option value="">Seleccionar...</option>
                <option v-for="s in SOURCES" :key="s" :value="s">{{ s }}</option>
              </select>
            </div>
          </div>

          <!-- CVE ID + Estado -->
          <div class="field-row">
            <div class="field-group">
              <label class="field-label">CVE ID</label>
              <input
                v-model="localFicha.cve_id"
                class="field-input mono"
                placeholder="Ej: CVE-2023-21980"
                @input="emitUpdate"
              />
            </div>

            <div class="field-group">
              <label class="field-label">Estado</label>
              <select v-model="localFicha.estado" class="field-select" @change="emitUpdate">
                <option value="abierto">🔴 Abierto</option>
                <option value="en_remediacion">🟡 En remediación</option>
                <option value="cerrado">🟢 Cerrado</option>
              </select>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════ -->
        <!-- Tab: Descripción técnica           -->
        <!-- ══════════════════════════════════ -->
        <div class="tab-content" v-if="activeTab === 'descripcion'">

          <!-- Descripción -->
          <div class="field-group">
            <label class="field-label required">Descripción</label>
            <textarea
              v-model="localFicha.descripcion"
              class="field-textarea"
              rows="5"
              placeholder="Descripción detallada de la vulnerabilidad, su causa y contexto técnico..."
              @input="emitUpdate"
            />
            <div class="field-hint">
              Explicar qué es la vulnerabilidad, por qué existe y en qué componente se encuentra.
            </div>
          </div>

          <!-- Evidencia -->
          <div class="field-group">
            <label class="field-label required">Evidencia técnica</label>
            <textarea
              v-model="localFicha.evidencia"
              class="field-textarea mono"
              rows="5"
              placeholder="IP: 190.x.x.x&#10;Puerto: 3306&#10;Banner: MySQL 5.7.38&#10;Fuente: Shodan"
              @input="emitUpdate"
            />
            <div class="field-hint">
              Datos técnicos que demuestran el hallazgo: IPs, puertos, URLs, outputs de herramientas.
            </div>
          </div>

          <!-- Impacto -->
          <div class="field-group">
            <label class="field-label">Impacto</label>
            <textarea
              v-model="localFicha.impacto"
              class="field-textarea"
              rows="4"
              placeholder="Describir el impacto potencial si la vulnerabilidad es explotada..."
              @input="emitUpdate"
            />
          </div>
        </div>

        <!-- ══════════════════════════════════ -->
        <!-- Tab: CVSS 3.1                      -->
        <!-- ══════════════════════════════════ -->
        <div class="tab-content" v-if="activeTab === 'cvss'">
          <div class="cvss-info-bar">
            <div class="cvss-current">
              <span class="cvss-current-label">Score actual:</span>
              <span class="cvss-current-score" :class="`score-${severityClass}`">
                {{ (localFicha.cvss?.score || 0).toFixed(1) }}
              </span>
              <span class="cvss-current-sev" :class="`sev-${severityClass}`">
                {{ localFicha.cvss?.severity || "NINGUNO" }}
              </span>
            </div>
            <div class="cvss-current-vector mono">
              {{ localFicha.cvss?.vector || "Sin vector" }}
            </div>
          </div>

          <!-- Calculadora integrada -->
          <CvssCalculator
            :initial-vector="localFicha.cvss?.vector || ''"
            :compact="false"
            @update:vector="onCvssUpdate"
          />
        </div>

        <!-- ══════════════════════════════════ -->
        <!-- Tab: Remediación                   -->
        <!-- ══════════════════════════════════ -->
        <div class="tab-content" v-if="activeTab === 'remediacion'">

          <!-- Recomendación principal -->
          <div class="field-group">
            <div class="field-label-row">
              <label class="field-label required">Recomendación de remediación</label>
              <button
                v-if="localFicha.categoria"
                class="auto-fill-btn"
                @click="applyRecommendation"
                title="Autocompletar desde la categoría seleccionada"
              >
                ✨ Autocompletar
              </button>
            </div>
            <textarea
              v-model="localFicha.recomendacion"
              class="field-textarea"
              rows="5"
              placeholder="Pasos específicos para remediar la vulnerabilidad..."
              @input="emitUpdate"
            />
          </div>

          <!-- Hardening adicional -->
          <div class="field-group" v-if="autoRec?.hardening?.length">
            <label class="field-label">Acciones de hardening adicionales</label>
            <div class="hardening-list">
              <div
                v-for="(item, i) in autoRec.hardening"
                :key="i"
                class="hardening-item"
              >
                <span class="hardening-bullet">→</span>
                <span class="hardening-text">{{ item }}</span>
              </div>
            </div>
            <div class="field-hint">Generadas automáticamente desde la categoría. Incluir las relevantes en el informe.</div>
          </div>

          <!-- SLA -->
          <div class="field-row">
            <div class="field-group">
              <label class="field-label">SLA de remediación</label>
              <div class="sla-display" v-if="autoRec?.sla">
                <span
                  v-for="(val, sev) in autoRec.sla"
                  :key="sev"
                  class="sla-item"
                  :class="`sla-${sev.toLowerCase()}`"
                >
                  <span class="sla-sev">{{ sev }}</span>
                  <span class="sla-val">{{ val }}</span>
                </span>
              </div>
              <div v-else class="field-hint">Seleccionar categoría para ver SLA sugerido</div>
            </div>

            <div class="field-group">
              <label class="field-label">Dificultad</label>
              <div class="difficulty-display" v-if="autoRec">
                <span class="diff-badge" :class="`diff-${autoRec.difficulty}`">
                  {{ autoRec.difficulty?.toUpperCase() || "—" }}
                </span>
                <span class="diff-effort">{{ autoRec.effort }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- ══════════════════════════════════ -->
        <!-- Tab: Referencias                   -->
        <!-- ══════════════════════════════════ -->
        <div class="tab-content" v-if="activeTab === 'referencias'">

          <div class="field-group">
            <label class="field-label">Referencias técnicas</label>
            <div class="refs-list">
              <div
                v-for="(ref, i) in localFicha.referencias"
                :key="i"
                class="ref-item"
              >
                <input
                  v-model="localFicha.referencias[i]"
                  class="field-input mono ref-input"
                  placeholder="https://nvd.nist.gov/vuln/detail/CVE-..."
                  @input="emitUpdate"
                />
                <button class="ref-remove" @click="removeRef(i)">✕</button>
              </div>
            </div>
            <button class="add-ref-btn" @click="addRef">+ Agregar referencia</button>
          </div>

          <!-- Referencias automáticas si hay categoría -->
          <div class="field-group" v-if="autoRec?.references?.length">
            <label class="field-label">Referencias sugeridas para esta categoría</label>
            <div class="suggested-refs">
              <div
                v-for="ref in autoRec.references"
                :key="ref"
                class="suggested-ref"
              >
                <span class="suggested-ref-url mono">{{ ref }}</span>
                <button
                  class="suggested-ref-add"
                  @click="addSuggestedRef(ref)"
                  :disabled="localFicha.referencias?.includes(ref)"
                >
                  {{ localFicha.referencias?.includes(ref) ? "✓" : "+ Agregar" }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- ── Footer del editor ── -->
        <div class="editor-footer">
          <div class="footer-meta">
            <span class="meta-item">Fuente: <span class="mono">{{ localFicha.fuente || "—" }}</span></span>
            <span class="meta-item">Categoría: <span class="mono">{{ localFicha.categoria || "—" }}</span></span>
            <span class="meta-item" v-if="localFicha.cve_id">
              CVE: <span class="mono cve-link">{{ localFicha.cve_id }}</span>
            </span>
          </div>
          <div class="footer-actions">
            <button class="footer-btn save" @click="emitUpdate">
              ✓ Guardar cambios
            </button>
          </div>
        </div>

      </div>
    </transition>

    <!-- ── Confirmación de borrado ── -->
    <transition name="fade">
      <div class="delete-confirm" v-if="showDeleteConfirm">
        <span>¿Eliminar ficha <strong>{{ localFicha.id }}</strong>?</span>
        <button class="confirm-yes" @click="$emit('delete', localFicha.id)">Sí, eliminar</button>
        <button class="confirm-no"  @click="showDeleteConfirm = false">Cancelar</button>
      </div>
    </transition>

  </div>
</template>

<script setup>
import { ref, computed, watch, reactive } from "vue"
import CvssCalculator from "./CvssCalculator.vue"

// ─────────────────────────────────────────────
//  Props y emits
// ─────────────────────────────────────────────
const props = defineProps({
  ficha: { type: Object, required: true },
  index: { type: Number, default: 0 },
})

const emit = defineEmits(["update", "delete", "duplicate"])

// ─────────────────────────────────────────────
//  Constantes
// ─────────────────────────────────────────────
const TABS = [
  { id: "info",        label: "Información",  icon: "📋" },
  { id: "descripcion", label: "Descripción",  icon: "📝" },
  { id: "cvss",        label: "CVSS 3.1",     icon: "🛡" },
  { id: "remediacion", label: "Remediación",  icon: "🔧" },
  { id: "referencias", label: "Referencias",  icon: "🔗" },
]

const CATEGORIES = [
  { id: "exposicion_servicio", label: "Exposición de servicio" },
  { id: "cve_critico",         label: "CVE detectado"          },
  { id: "tls_issue",           label: "Issue de TLS"           },
  { id: "email_spoofing",      label: "Email spoofing"         },
  { id: "archivo_sensible",    label: "Archivo sensible"       },
  { id: "backup_expuesto",     label: "Backup expuesto"        },
  { id: "panel_admin",         label: "Panel de administración"},
  { id: "whois_expiracion",    label: "Expiración de dominio"  },
  { id: "email_expuesto",      label: "Emails expuestos"       },
  { id: "api_expuesta",        label: "API expuesta"           },
  { id: "otro",                label: "Otro"                   },
]

const SOURCES = ["dns", "whois", "wayback", "censys", "shodan", "hunter", "manual"]

// Recomendaciones inline (simplificadas — el backend tiene las completas)
const RECOMMENDATIONS_INLINE = {
  exposicion_servicio: {
    immediate:  "Restringir acceso al puerto mediante firewall. Solo permitir desde IPs autorizadas o VPN.",
    hardening:  ["Bloquear el puerto desde internet en el firewall perimetral", "Usar VPN corporativa para acceso remoto", "Implementar fail2ban para bloquear IPs con múltiples intentos fallidos", "Configurar MFA en todos los servicios de acceso remoto"],
    references: ["https://owasp.org/www-project-top-ten/", "https://www.cisecurity.org/controls/"],
    difficulty: "media", effort: "4-8 horas",
    sla: { "CRÍTICO": "24-72h", "ALTO": "7 días", "MEDIO": "30 días" },
  },
  cve_critico: {
    immediate:  "Aplicar el parche oficial del fabricante de forma inmediata. Si no existe parche, aislar el sistema.",
    hardening:  ["Actualizar a la versión parcheada", "Verificar si el sistema fue comprometido antes de parchear", "Implementar programa de patch management mensual", "Suscribirse a advisories de seguridad del fabricante"],
    references: ["https://nvd.nist.gov/", "https://cve.mitre.org/", "https://www.first.org/cvss/"],
    difficulty: "media", effort: "Variable",
    sla: { "CRÍTICO": "24-48h", "ALTO": "7 días", "MEDIO": "30 días" },
  },
  tls_issue: {
    immediate:  "Renovar o reemplazar el certificado TLS. Usar Let's Encrypt para certificados gratuitos con renovación automática.",
    hardening:  ["Configurar renovación automática con Certbot", "Deshabilitar TLS 1.0 y 1.1, usar solo TLS 1.2+", "Implementar HSTS con max-age mínimo de 1 año", "Activar alertas de expiración con 30 días de antelación"],
    references: ["https://letsencrypt.org/", "https://ssl-config.mozilla.org/", "https://www.ssllabs.com/ssltest/"],
    difficulty: "baja", effort: "1-3 horas",
    sla: { "CRÍTICO": "24h", "ALTO": "7 días", "MEDIO": "30 días" },
  },
  email_spoofing: {
    immediate:  "Configurar registros SPF, DMARC y DKIM en el DNS del dominio.",
    hardening:  ["Publicar SPF con política -all (rechazo explícito)", "Crear DMARC con p=reject y monitoreo activo", "Implementar DKIM con clave de 2048 bits", "Monitorear informes DMARC semanalmente"],
    references: ["https://tools.ietf.org/html/rfc7208", "https://tools.ietf.org/html/rfc7489", "https://dmarc.org/"],
    difficulty: "baja", effort: "2-4 horas",
    sla: { "CRÍTICO": "24h", "ALTO": "7 días", "MEDIO": "30 días" },
  },
  archivo_sensible: {
    immediate:  "Eliminar el archivo del servidor y rotar TODAS las credenciales que pudieran estar expuestas.",
    hardening:  ["Eliminar archivo de producción si aún existe", "Rotar todas las credenciales expuestas", "Agregar el archivo a .gitignore y .htaccess deny", "Solicitar eliminación a Wayback Machine"],
    references: ["https://owasp.org/www-project-top-ten/2017/A3_2017-Sensitive_Data_Exposure", "https://help.archive.org/"],
    difficulty: "media", effort: "4-8 horas",
    sla: { "CRÍTICO": "Inmediato", "ALTO": "24-48h", "MEDIO": "7 días" },
  },
  backup_expuesto: {
    immediate:  "Eliminar archivos de backup del directorio web público. Los backups nunca deben ser accesibles vía HTTP.",
    hardening:  ["Mover backups fuera del DocumentRoot", "Cifrar backups en reposo con AES-256", "Bloquear extensiones .zip .sql .tar en servidor web", "Revisar logs para detectar descargas previas"],
    references: ["https://owasp.org/www-community/vulnerabilities/Backup_file_artifact"],
    difficulty: "baja", effort: "1-2 horas",
    sla: { "CRÍTICO": "Inmediato", "ALTO": "24h", "MEDIO": "7 días" },
  },
  panel_admin: {
    immediate:  "Restringir acceso al panel admin mediante IP whitelist y agregar MFA.",
    hardening:  ["Cambiar ruta del panel a URL no predecible", "Implementar IP whitelist para acceso", "Agregar autenticación HTTP Basic como capa adicional", "Configurar rate limiting en el endpoint de login"],
    references: ["https://owasp.org/www-project-top-ten/2021/A07_2021-Identification_and_Authentication_Failures"],
    difficulty: "media", effort: "4-8 horas",
    sla: { "CRÍTICO": "24h", "ALTO": "7 días", "MEDIO": "30 días" },
  },
  whois_expiracion: {
    immediate:  "Renovar el dominio inmediatamente. Habilitar auto-renovación en el registrar.",
    hardening:  ["Activar auto-renovación en el panel del registrar", "Configurar alertas a 90, 60, 30 y 15 días", "Actualizar datos de contacto y método de pago", "Considerar Registry Lock para proteger contra transferencias"],
    references: ["https://www.icann.org/resources/pages/renewal-2013-05-03-en"],
    difficulty: "baja", effort: "30 minutos",
    sla: { "CRÍTICO": "Inmediato", "ALTO": "24-48h", "MEDIO": "7 días" },
  },
  email_expuesto: {
    immediate:  "Capacitar al personal expuesto en identificación de phishing. Activar MFA en cuentas de correo corporativo.",
    hardening:  ["Habilitar MFA en todas las cuentas de email", "Implementar simulaciones de phishing periódicas", "Configurar filtros anti-phishing en el gateway de email", "Solicitar eliminación en Hunter.io opt-out"],
    references: ["https://hunter.io/opt-out", "https://haveibeenpwned.com/", "https://getgophish.com/"],
    difficulty: "media", effort: "Continua",
    sla: { "CRÍTICO": "48h", "ALTO": "7 días", "MEDIO": "30 días" },
  },
  api_expuesta: {
    immediate:  "Verificar si el endpoint requiere autenticación. Si está desprotegido, implementar JWT o API Key.",
    hardening:  ["Implementar autenticación en todos los endpoints", "Aplicar rate limiting por IP y usuario", "Habilitar CORS restrictivo con orígenes de confianza", "Configurar logging de todas las llamadas al API"],
    references: ["https://owasp.org/www-project-api-security/"],
    difficulty: "media", effort: "8-24 horas",
    sla: { "CRÍTICO": "24h", "ALTO": "7 días", "MEDIO": "30 días" },
  },
}

// ─────────────────────────────────────────────
//  Estado
// ─────────────────────────────────────────────
const isExpanded      = ref(props.index === 0)
const activeTab       = ref("info")
const showDeleteConfirm = ref(false)

// Copia local de la ficha para edición
const localFicha = reactive({ ...props.ficha, referencias: [...(props.ficha.referencias || [])] })

// Recomendación automática según categoría actual
const autoRec = computed(() => {
  return RECOMMENDATIONS_INLINE[localFicha.categoria] || null
})

// ─────────────────────────────────────────────
//  Computados
// ─────────────────────────────────────────────
const severityClass = computed(() => ({
  "CRÍTICO": "critico",
  "ALTO":    "alto",
  "MEDIO":   "medio",
  "BAJO":    "bajo",
  "NINGUNO": "ninguno",
}[localFicha.cvss?.severity] || "ninguno"))

// ─────────────────────────────────────────────
//  Métodos
// ─────────────────────────────────────────────
function emitUpdate() {
  emit("update", { ...localFicha })
}

function onCvssUpdate({ vector, score, severity, metrics }) {
  localFicha.cvss = {
    version:  "3.1",
    vector,
    score,
    severity,
    metrics,
  }
  // Recalcular prioridad
  localFicha.prioridad = { "CRÍTICO": 1, "ALTO": 2, "MEDIO": 3, "BAJO": 4, "NINGUNO": 5 }[severity] || 5
  emitUpdate()
}

function applyRecommendation() {
  const rec = autoRec.value
  if (!rec) return
  if (!localFicha.recomendacion) {
    localFicha.recomendacion = rec.immediate
  }
  if (!localFicha.referencias?.length && rec.references?.length) {
    localFicha.referencias = [...rec.references]
  }
  emitUpdate()
}

function addRef() {
  if (!localFicha.referencias) localFicha.referencias = []
  localFicha.referencias.push("")
}

function removeRef(i) {
  localFicha.referencias.splice(i, 1)
  emitUpdate()
}

function addSuggestedRef(ref) {
  if (!localFicha.referencias) localFicha.referencias = []
  if (!localFicha.referencias.includes(ref)) {
    localFicha.referencias.push(ref)
    emitUpdate()
  }
}

function confirmDelete() {
  showDeleteConfirm.value = true
  setTimeout(() => { showDeleteConfirm.value = false }, 5000)
}

// Sync con props externos
watch(() => props.ficha, (newFicha) => {
  Object.assign(localFicha, newFicha)
  if (newFicha.referencias) {
    localFicha.referencias = [...newFicha.referencias]
  }
}, { deep: true })
</script>

<style scoped>
/* ── Layout general ── */
.ficha-editor {
  font-family: 'Inter', -apple-system, sans-serif;
  background: #0f172a;
  border-radius: 12px;
  border: 1px solid #1e293b;
  overflow: hidden;
  transition: border-color 0.2s;
}
.ficha-editor.expanded { border-color: #334155; }

/* ── Header ── */
.editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  cursor: pointer;
  transition: background 0.15s;
  gap: 12px;
}
.editor-header:hover { background: rgba(255,255,255,0.02); }

.header-critico { border-left: 3px solid #ef4444; }
.header-alto    { border-left: 3px solid #f97316; }
.header-medio   { border-left: 3px solid #eab308; }
.header-bajo    { border-left: 3px solid #22c55e; }
.header-ninguno { border-left: 3px solid #475569; }

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex: 1;
  min-width: 0;
}
.drag-handle {
  color: #334155;
  cursor: grab;
  font-size: 14px;
  user-select: none;
  padding: 0 2px;
}
.drag-handle:hover { color: #64748b; }

.header-id-badge {
  display: flex;
  align-items: center;
  gap: 6px;
  shrink: 0;
}
.ficha-id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  color: #475569;
  font-weight: 600;
}
.severity-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  letter-spacing: 0.05em;
}
.score-badge {
  font-family: monospace;
  font-size: 11px;
  font-weight: 800;
}

.header-title {
  font-size: 12px;
  font-weight: 600;
  color: #e2e8f0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
}
.header-title.empty { color: #334155; font-style: italic; }

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
  shrink: 0;
}
.action-btn {
  width: 24px;
  height: 24px;
  border-radius: 4px;
  border: 1px solid #1e293b;
  background: transparent;
  color: #475569;
  cursor: pointer;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.action-btn:hover { border-color: #64748b; color: #94a3b8; }
.action-btn.danger:hover { border-color: #ef4444; color: #ef4444; }
.expand-icon {
  color: #475569;
  font-size: 10px;
  transition: transform 0.2s;
}
.expand-icon.rotated { transform: rotate(180deg); }

/* ── Severidad colores ── */
.sev-critico, .score-critico { color: #ef4444; }
.sev-alto,    .score-alto    { color: #f97316; }
.sev-medio,   .score-medio   { color: #eab308; }
.sev-bajo,    .score-bajo    { color: #22c55e; }
.sev-ninguno, .score-ninguno { color: #64748b; }

.severity-badge.sev-critico { background: rgba(239,68,68,0.2);  color: #fca5a5; }
.severity-badge.sev-alto    { background: rgba(249,115,22,0.2); color: #fdba74; }
.severity-badge.sev-medio   { background: rgba(234,179,8,0.2);  color: #fde047; }
.severity-badge.sev-bajo    { background: rgba(34,197,94,0.2);  color: #86efac; }
.severity-badge.sev-ninguno { background: rgba(71,85,105,0.2);  color: #94a3b8; }

/* ── Cuerpo editor ── */
.editor-body { border-top: 1px solid #1e293b; }

/* ── Tabs ── */
.editor-tabs {
  display: flex;
  background: #070b12;
  border-bottom: 1px solid #1e293b;
  overflow-x: auto;
}
.tab-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  font-size: 11px;
  font-weight: 500;
  color: #475569;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  white-space: nowrap;
  font-family: inherit;
  transition: all 0.15s;
}
.tab-btn:hover { color: #94a3b8; }
.tab-btn.active { color: #e2e8f0; border-bottom-color: #3b82f6; }
.tab-icon { font-size: 12px; }
.tab-score {
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  background: #1e293b;
}
.ts-critico { color: #ef4444; }
.ts-alto    { color: #f97316; }
.ts-medio   { color: #eab308; }
.ts-bajo    { color: #22c55e; }

/* ── Tab content ── */
.tab-content { padding: 20px; }

/* ── Campos de formulario ── */
.field-group { margin-bottom: 18px; }
.field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 18px;
}

.field-label {
  display: block;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  color: #64748b;
  margin-bottom: 6px;
}
.field-label.required::after {
  content: " *";
  color: #ef4444;
}
.field-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

.field-input, .field-select, .field-textarea {
  width: 100%;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 8px;
  padding: 10px 12px;
  color: #e2e8f0;
  font-size: 12px;
  font-family: inherit;
  transition: border-color 0.15s;
  outline: none;
}
.field-input:focus, .field-select:focus, .field-textarea:focus {
  border-color: #3b82f6;
}
.field-input::placeholder, .field-textarea::placeholder {
  color: #334155;
}
.field-select option { background: #1e293b; }
.field-textarea { resize: vertical; line-height: 1.6; }
.field-input.mono, .field-textarea.mono {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
}
.field-hint {
  font-size: 9px;
  color: #334155;
  margin-top: 4px;
}

/* ── Auto-fill button ── */
.auto-fill-btn {
  font-size: 10px;
  padding: 4px 10px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: #1e293b;
  color: #94a3b8;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
}
.auto-fill-btn:hover {
  border-color: #7c3aed;
  color: #a78bfa;
  background: rgba(124,58,237,0.1);
}

/* ── CVSS info bar ── */
.cvss-info-bar {
  background: #1e293b;
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}
.cvss-current {
  display: flex;
  align-items: center;
  gap: 10px;
}
.cvss-current-label { font-size: 10px; color: #475569; }
.cvss-current-score { font-size: 22px; font-weight: 900; font-family: monospace; }
.cvss-current-sev   { font-size: 12px; font-weight: 700; letter-spacing: 0.05em; }
.cvss-current-vector {
  font-size: 9px;
  color: #475569;
  word-break: break-all;
}

/* ── Hardening list ── */
.hardening-list { space-y: 6px; }
.hardening-item {
  display: flex;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid #1e293b;
  font-size: 11px;
}
.hardening-bullet { color: #22c55e; shrink: 0; margin-top: 1px; }
.hardening-text   { color: #94a3b8; line-height: 1.5; }

/* ── SLA display ── */
.sla-display { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 6px; }
.sla-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 6px 10px;
  border-radius: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  min-width: 80px;
}
.sla-sev { font-size: 8px; font-weight: 700; text-transform: uppercase; color: #64748b; }
.sla-val { font-size: 10px; font-weight: 600; color: #e2e8f0; margin-top: 2px; }

/* ── Difficulty ── */
.difficulty-display { display: flex; align-items: center; gap: 8px; margin-top: 6px; }
.diff-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 4px;
  letter-spacing: 0.1em;
}
.diff-baja   { background: rgba(34,197,94,0.2);  color: #86efac; }
.diff-media  { background: rgba(234,179,8,0.2);  color: #fde047; }
.diff-alta   { background: rgba(239,68,68,0.2);  color: #fca5a5; }
.diff-effort { font-size: 10px; color: #64748b; }

/* ── Referencias ── */
.refs-list { space-y: 6px; margin-bottom: 10px; }
.ref-item {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}
.ref-input { flex: 1; }
.ref-remove {
  width: 28px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid #334155;
  background: transparent;
  color: #475569;
  cursor: pointer;
  font-size: 10px;
  shrink: 0;
  transition: all 0.15s;
}
.ref-remove:hover { border-color: #ef4444; color: #ef4444; }

.add-ref-btn {
  font-size: 11px;
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px dashed #334155;
  background: transparent;
  color: #475569;
  cursor: pointer;
  font-family: inherit;
  transition: all 0.15s;
  width: 100%;
}
.add-ref-btn:hover { border-color: #3b82f6; color: #3b82f6; }

.suggested-refs { space-y: 6px; }
.suggested-ref {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 6px;
  background: #1e293b;
  border: 1px solid #334155;
  margin-bottom: 6px;
}
.suggested-ref-url { font-size: 9px; color: #64748b; flex: 1; truncate: ellipsis; }
.suggested-ref-add {
  font-size: 9px;
  padding: 3px 8px;
  border-radius: 4px;
  border: 1px solid #334155;
  background: transparent;
  color: #3b82f6;
  cursor: pointer;
  font-family: inherit;
  shrink: 0;
  transition: all 0.15s;
}
.suggested-ref-add:hover:not(:disabled) { background: rgba(59,130,246,0.1); }
.suggested-ref-add:disabled { color: #22c55e; cursor: default; }

/* ── Footer ── */
.editor-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-top: 1px solid #1e293b;
  background: #070b12;
  flex-wrap: wrap;
  gap: 8px;
}
.footer-meta {
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
}
.meta-item {
  font-size: 10px;
  color: #475569;
}
.mono { font-family: 'JetBrains Mono', monospace; }
.cve-link { color: #7c3aed; }

.footer-actions { display: flex; gap: 8px; }
.footer-btn {
  font-size: 11px;
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-family: inherit;
  font-weight: 600;
  transition: all 0.15s;
}
.footer-btn.save {
  background: #1d4ed8;
  color: white;
}
.footer-btn.save:hover { background: #2563eb; }

/* ── Confirmación de borrado ── */
.delete-confirm {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: rgba(239,68,68,0.1);
  border-top: 1px solid rgba(239,68,68,0.3);
  font-size: 12px;
  color: #fca5a5;
  flex-wrap: wrap;
}
.confirm-yes {
  padding: 4px 12px;
  border-radius: 4px;
  background: #dc2626;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
}
.confirm-no {
  padding: 4px 12px;
  border-radius: 4px;
  background: #1e293b;
  color: #94a3b8;
  border: 1px solid #334155;
  cursor: pointer;
  font-size: 11px;
  font-family: inherit;
}

/* ── Transiciones ── */
.slide-enter-active, .slide-leave-active {
  transition: all 0.2s ease;
  overflow: hidden;
}
.slide-enter-from, .slide-leave-to {
  opacity: 0;
  max-height: 0;
}
.slide-enter-to, .slide-leave-from {
  opacity: 1;
  max-height: 2000px;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>