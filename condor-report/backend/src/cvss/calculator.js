"use strict"

// ─────────────────────────────────────────────
//  Pesos numéricos de cada métrica
//  Fuente: CVSS v3.1 Specification, Tabla 14
// ─────────────────────────────────────────────

/**
 * AV — Attack Vector
 * Define desde dónde puede el atacante explotar la vulnerabilidad.
 * Mayor valor = más fácil de alcanzar = mayor riesgo.
 */
const AV_WEIGHTS = {
  N: 0.85,   // Network    — explotable remotamente vía internet
  A: 0.62,   // Adjacent   — requiere acceso a la misma red/segmento
  L: 0.55,   // Local      — requiere acceso local al sistema
  P: 0.20,   // Physical   — requiere acceso físico al hardware
}

/**
 * AC — Attack Complexity
 * Condiciones fuera del control del atacante que deben existir.
 */
const AC_WEIGHTS = {
  L: 0.77,   // Low  — sin condiciones especiales requeridas
  H: 0.44,   // High — requieren condiciones específicas difíciles
}

/**
 * PR — Privileges Required
 * Nivel de privilegios que el atacante necesita tener previamente.
 * Nota: los pesos varían según el valor de Scope (S).
 */
const PR_WEIGHTS = {
  UNCHANGED: { N: 0.85, L: 0.62, H: 0.27 },  // S:U
  CHANGED:   { N: 0.85, L: 0.68, H: 0.50 },  // S:C — privilegios "valen menos" si scope cambia
}

/**
 * UI — User Interaction
 * Si la explotación requiere que un usuario tome alguna acción.
 */
const UI_WEIGHTS = {
  N: 0.85,   // None     — no requiere interacción del usuario
  R: 0.62,   // Required — requiere acción del usuario (ej: abrir archivo)
}

/**
 * C, I, A — Impact metrics (Confidentiality, Integrity, Availability)
 * Impacto sobre cada pilar de la tríada CIA.
 * Estos pesos son los mismos para las tres métricas.
 */
const CIA_WEIGHTS = {
  N: 0.00,   // None — sin impacto
  L: 0.22,   // Low  — impacto limitado
  H: 0.56,   // High — impacto total/severo
}

// Scope no tiene peso propio — afecta la fórmula de Score
// U = Unchanged (el impacto se limita al componente vulnerable)
// C = Changed   (el impacto se propaga a otros componentes)

// ─────────────────────────────────────────────
//  Rangos de severidad — CVSS v3.1 Tabla 15
// ─────────────────────────────────────────────
const SEVERITY_RANGES = [
  { label: "CRÍTICO", min: 9.0,  max: 10.0 },
  { label: "ALTO",    min: 7.0,  max: 8.9  },
  { label: "MEDIO",   min: 4.0,  max: 6.9  },
  { label: "BAJO",    min: 0.1,  max: 3.9  },
  { label: "NINGUNO", min: 0.0,  max: 0.0  },
]

// ─────────────────────────────────────────────
//  Valores válidos por métrica
// ─────────────────────────────────────────────
const VALID_METRICS = {
  AV: ["N", "A", "L", "P"],
  AC: ["L", "H"],
  PR: ["N", "L", "H"],
  UI: ["N", "R"],
  S:  ["U", "C"],
  C:  ["N", "L", "H"],
  I:  ["N", "L", "H"],
  A:  ["N", "L", "H"],
}

// ─────────────────────────────────────────────
//  Helpers matemáticos
// ─────────────────────────────────────────────

/**
 * Roundup — función de redondeo especial del estándar CVSS 3.1.
 *
 * CVSS usa su propio método de redondeo (siempre hacia arriba
 * al primer decimal) para evitar que scores bajen por redondeo.
 *
 * Fórmula oficial: Roundup(x) = ceil(x * 10) / 10
 *
 * Ejemplo:
 *   Roundup(4.02) → 4.1  (no 4.0)
 *   Roundup(9.75) → 9.8
 */
function roundup(value) {
  // Multiplicar por 100000, redondear al entero, dividir por 100000
  // Esto evita errores de punto flotante en JavaScript
  const intInput = Math.round(value * 100000)
  if (intInput % 10000 === 0) {
    return intInput / 100000
  }
  return (Math.floor(intInput / 10000) + 1) / 10
}

/**
 * Determina la severidad según el score calculado.
 */
function getSeverity(score) {
  for (const range of SEVERITY_RANGES) {
    if (score >= range.min && score <= range.max) {
      return range.label
    }
  }
  return "NINGUNO"
}

/**
 * Construye el vector string canónico desde las métricas.
 * Formato: CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H
 */
function buildVector(metrics) {
  const { AV, AC, PR, UI, S, C, I, A } = metrics
  return `CVSS:3.1/AV:${AV}/AC:${AC}/PR:${PR}/UI:${UI}/S:${S}/C:${C}/I:${I}/A:${A}`
}

// ─────────────────────────────────────────────
//  Validación de métricas
// ─────────────────────────────────────────────

/**
 * Valida que todas las métricas tengan valores permitidos.
 * Lanza Error con mensaje descriptivo si algo está mal.
 *
 * @param {object} metrics — { AV, AC, PR, UI, S, C, I, A }
 * @throws {Error} si alguna métrica es inválida o falta
 */
function validateMetrics(metrics) {
  const errors = []

  for (const [metric, validValues] of Object.entries(VALID_METRICS)) {
    const value = metrics[metric]

    if (value === undefined || value === null || value === "") {
      errors.push(`Métrica '${metric}' es requerida`)
      continue
    }

    if (!validValues.includes(String(value).toUpperCase())) {
      errors.push(
        `Métrica '${metric}' tiene valor inválido: '${value}'. ` +
        `Valores válidos: ${validValues.join(", ")}`
      )
    }
  }

  if (errors.length > 0) {
    throw new Error(`CVSS validation errors:\n${errors.join("\n")}`)
  }
}

// ─────────────────────────────────────────────
//  Parser de vector string
// ─────────────────────────────────────────────

/**
 * Parsea un vector string CVSS 3.1 a objeto de métricas.
 *
 * Acepta:
 *   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
 *   "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"   (sin prefijo)
 *
 * @param {string} vectorString
 * @returns {{ AV, AC, PR, UI, S, C, I, A }}
 * @throws {Error} si el formato es inválido
 */
function parseVector(vectorString) {
  if (!vectorString || typeof vectorString !== "string") {
    throw new Error("Vector string inválido: debe ser un string no vacío")
  }

  // Normalizar — eliminar prefijo CVSS:3.1/ si existe
  let str = vectorString.trim().toUpperCase()
  if (str.startsWith("CVSS:3.1/")) {
    str = str.slice("CVSS:3.1/".length)
  } else if (str.startsWith("CVSS:3.0/")) {
    throw new Error("Solo se soporta CVSS 3.1 — el vector proporcionado es CVSS 3.0")
  }

  // Parsear pares métrica:valor
  const parts  = str.split("/")
  const metrics = {}

  for (const part of parts) {
    const [key, val] = part.split(":")
    if (key && val) {
      metrics[key] = val
    }
  }

  // Verificar que estén todas las métricas requeridas
  const required = ["AV", "AC", "PR", "UI", "S", "C", "I", "A"]
  const missing  = required.filter(m => !metrics[m])

  if (missing.length > 0) {
    throw new Error(`Vector incompleto. Métricas faltantes: ${missing.join(", ")}`)
  }

  return metrics
}

// ─────────────────────────────────────────────
//  Motor de cálculo CVSS 3.1
// ─────────────────────────────────────────────

/**
 * Calcula el Base Score CVSS 3.1 desde métricas individuales.
 *
 * FÓRMULA OFICIAL (FIRST CVSS v3.1 Specification):
 *
 * ISCBase = 1 - [(1-C_weight) × (1-I_weight) × (1-A_weight)]
 *
 * Si S = Unchanged:
 *   Impact  = 6.42 × ISCBase
 *
 * Si S = Changed:
 *   Impact  = 7.52 × [ISCBase - 0.029] - 3.25 × [ISCBase - 0.02]^15
 *
 * Exploitability = 8.22 × AV_weight × AC_weight × PR_weight × UI_weight
 *
 * Si Impact ≤ 0:
 *   Score = 0
 * Else si S = Unchanged:
 *   Score = Roundup(min(Impact + Exploitability, 10))
 * Else:
 *   Score = Roundup(min(1.08 × (Impact + Exploitability), 10))
 *
 * @param {object} metrics — { AV, AC, PR, UI, S, C, I, A } (valores en mayúsculas)
 * @returns {object} resultado completo del cálculo
 */
function calculate(metrics) {
  // Normalizar a mayúsculas
  const m = {}
  for (const [k, v] of Object.entries(metrics)) {
    m[k] = String(v).toUpperCase()
  }

  // Validar
  validateMetrics(m)

  const { AV, AC, PR, UI, S, C, I, A } = m

  // ── Obtener pesos ────────────────────────
  const w_AV = AV_WEIGHTS[AV]
  const w_AC = AC_WEIGHTS[AC]
  const w_PR = PR_WEIGHTS[S === "C" ? "CHANGED" : "UNCHANGED"][PR]
  const w_UI = UI_WEIGHTS[UI]
  const w_C  = CIA_WEIGHTS[C]
  const w_I  = CIA_WEIGHTS[I]
  const w_A  = CIA_WEIGHTS[A]

  // ── ISC Base (Impact Sub-Score Base) ────
  // Mide el impacto combinado sobre CIA
  const ISCBase = 1 - ((1 - w_C) * (1 - w_I) * (1 - w_A))

  // ── Impact Sub-Score ────────────────────
  // Fórmula difiere según si el scope cambia o no
  let impact
  if (S === "U") {
    // Scope Unchanged — impacto solo en el componente vulnerable
    impact = 6.42 * ISCBase
  } else {
    // Scope Changed — impacto se propaga a otros componentes
    // La exponenciación modela la no-linealidad del impacto propagado
    impact = 7.52 * (ISCBase - 0.029) - 3.25 * Math.pow(ISCBase - 0.02, 15)
  }

  // ── Exploitability Sub-Score ─────────────
  // Mide la facilidad de explotación
  const exploitability = 8.22 * w_AV * w_AC * w_PR * w_UI

  // ── Base Score ───────────────────────────
  let score
  if (impact <= 0) {
    // Sin impacto → score 0 (ej: C:N/I:N/A:N)
    score = 0
  } else if (S === "U") {
    score = roundup(Math.min(impact + exploitability, 10))
  } else {
    // Factor 1.08 penaliza más cuando el scope cambia
    score = roundup(Math.min(1.08 * (impact + exploitability), 10))
  }

  // ── Severidad ────────────────────────────
  const severity = getSeverity(score)

  // ── Vector string ─────────────────────────
  const vector = buildVector(m)

  // ── Resultado completo ───────────────────
  return {
    score,
    severity,
    vector,

    // Sub-scores para mostrar en UI
    subscores: {
      impact:         parseFloat(impact.toFixed(3)),
      exploitability: parseFloat(exploitability.toFixed(3)),
      iscBase:        parseFloat(ISCBase.toFixed(3)),
    },

    // Pesos aplicados — útil para debug y para mostrar en UI
    weights: {
      AV: w_AV,
      AC: w_AC,
      PR: w_PR,
      UI: w_UI,
      C:  w_C,
      I:  w_I,
      A:  w_A,
    },

    // Métricas originales normalizadas
    metrics: m,
  }
}

// ─────────────────────────────────────────────
//  Función de conveniencia: calcular desde vector
// ─────────────────────────────────────────────

/**
 * Calcula el score directamente desde un vector string.
 *
 * @param {string} vectorString — "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
 * @returns {object} resultado del cálculo
 */
function calculateFromVector(vectorString) {
  const metrics = parseVector(vectorString)
  return calculate(metrics)
}

// ─────────────────────────────────────────────
//  Función de conveniencia: solo severidad
// ─────────────────────────────────────────────

/**
 * Retorna solo la severidad dado un score numérico.
 * Útil para colorear badges en la UI.
 *
 * @param {number} score
 * @returns {string} "CRÍTICO" | "ALTO" | "MEDIO" | "BAJO" | "NINGUNO"
 */
function scoreToSeverity(score) {
  return getSeverity(parseFloat(score))
}

// ─────────────────────────────────────────────
//  Casos de prueba conocidos (FIRST examples)
// ─────────────────────────────────────────────

/**
 * Verifica el calculador contra casos conocidos del estándar.
 * Usar en tests o para validar la implementación.
 *
 * Casos tomados de la especificación CVSS 3.1 del FIRST:
 * https://www.first.org/cvss/v3.1/examples
 *
 * @returns {Array<{vector, expected, calculated, pass}>}
 */
function runSelfTest() {
  const TEST_CASES = [
    // CVE-2019-9084 — SQL Injection
    {
      vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      expected: 9.8,
      label:    "Network, Low, None, None, Unchanged, High/High/High"
    },
    // CVE-2019-0708 — BlueKeep RDP
    {
      vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H",
      expected: 10.0,
      label:    "Network, Low, None, None, Changed, High/High/High"
    },
    // Ejemplo MEDIO
    {
      vector:   "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:L/A:N",
      expected: 5.4,
      label:    "Network, Low, Low, None, Unchanged, Low/Low/None"
    },
    // Ejemplo BAJO
    {
      vector:   "CVSS:3.1/AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N",
      expected: 1.8,
      label:    "Local, High, High, Required, Unchanged, Low/None/None"
    },
    // Sin impacto
    {
      vector:   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N",
      expected: 0.0,
      label:    "Sin impacto en CIA"
    },
  ]

  const results = TEST_CASES.map(tc => {
    try {
      const result    = calculateFromVector(tc.vector)
      const pass      = result.score === tc.expected
      return {
        label:      tc.label,
        vector:     tc.vector,
        expected:   tc.expected,
        calculated: result.score,
        severity:   result.severity,
        pass,
      }
    } catch (e) {
      return {
        label:      tc.label,
        vector:     tc.vector,
        expected:   tc.expected,
        calculated: null,
        pass:       false,
        error:      e.message,
      }
    }
  })

  const passed = results.filter(r => r.pass).length
  const total  = results.length

  return {
    summary: `${passed}/${total} tests pasados`,
    passed,
    total,
    results,
  }
}

// ─────────────────────────────────────────────
//  Exports
// ─────────────────────────────────────────────
module.exports = {
  calculate,
  calculateFromVector,
  parseVector,
  buildVector,
  validateMetrics,
  scoreToSeverity,
  roundup,
  runSelfTest,

  // Exportar pesos y rangos para uso en frontend/UI
  AV_WEIGHTS,
  AC_WEIGHTS,
  PR_WEIGHTS,
  UI_WEIGHTS,
  CIA_WEIGHTS,
  SEVERITY_RANGES,
  VALID_METRICS,
}