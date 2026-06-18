# condor-report

> **Módulo 3 del Cóndor Framework** — Generador de fichas de vulnerabilidad con CVSS 3.1 y export PDF profesional.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Vue.js](https://img.shields.io/badge/Vue.js-3-41B883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express)](https://expressjs.com)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-22-40B5A4?style=flat-square&logo=puppeteer)](https://pptr.dev)

---

## ¿Qué es condor-report?

`condor-report` convierte los hallazgos del reconocimiento pasivo en **informes de auditoría profesionales**. Toma el JSON generado por `condor-cli` y produce fichas de vulnerabilidad documentadas, con scoring CVSS 3.1 calculado automáticamente y recomendaciones predefinidas por categoría.

El output es un PDF listo para entregar — con portada, índice, resumen ejecutivo y fichas técnicas individuales por hallazgo.

---

## Problema que resuelve

En una auditoría real, el analista pasa horas convirtiendo hallazgos técnicos en documentos formales:

```
Hallazgo bruto:          Puerto 3306 (MySQL) expuesto públicamente
                         CVE-2023-21980 — CVSS 9.8

Lo que el cliente recibe: Ficha formal con:
  - Nombre, descripción, evidencia
  - Vector CVSS 3.1 calculado
  - Impacto (CIA triad)
  - Recomendación específica
  - Referencias CVE
  - Clasificación de riesgo
```

`condor-report` automatiza esa conversión completamente.

---

## Arquitectura

```
condor-report/
│
├── backend/                    ← API Node.js / Express
│   ├── package.json
│   └── src/
│       ├── server.js           ← Entrypoint del servidor (Express + CORS)
│       ├── cvss/
│       │   ├── calculator.js   ← Motor CVSS 3.1 (470 líneas)
│       │   └── vectors.js      ← Definiciones de métricas (657 líneas)
│       ├── lib/
│       │   ├── importer.js     ← Parser JSON condor-cli → fichas (649 líneas)
│       │   └── recommender.js  ← Motor de recomendaciones (540 líneas)
│       ├── generators/
│       │   └── pdf.js          ← Generador PDF con Puppeteer (1095 líneas)
│       └── routes/
│           ├── report.js       ← POST /api/report/import, /generate
│           ├── cvss.js         ← GET/POST /api/cvss/calculate, presets
│           └── ficha.js        ← CRUD de fichas + recomendaciones
│
└── frontend/                   ← UI Vue.js 3 (sin router)
    ├── index.html              ← Entry HTML
    ├── main.js                 ← Montaje de App.vue
    ├── App.vue                 ← Layout principal con stepper (664 líneas)
    ├── vite.config.js          ← Config Vite + proxy /api → backend
    └── components/
        ├── ImportPanel.vue     ← Dropzone para JSON de condor-cli (629 líneas)
        ├── FichaEditor.vue     ← Editor de fichas con tabs (1022 líneas)
        ├── CvssCalculator.vue  ← Calculadora CVSS 3.1 interactiva (836 líneas)
        └── ReportPreview.vue   ← Preview + configuración export PDF (1003 líneas)
```

---

## Flujo de trabajo

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO DE DATOS                        │
│                                                          │
│  condor-cli output                                      │
│  (scan.json)                                            │
│       │                                                  │
│       ▼                                                  │
│  ImportPanel.vue                                        │
│  (drag & drop, validación)                              │
│       │                                                  │
│       ▼                                                  │
│  POST /api/report/import                                │
│       │                                                  │
│       ├── importer.js                                   │
│       │   (extrae hallazgos automáticamente)            │
│       │                                                  │
│       ├── recommender.js                                │
│       │   (enriquece con recomendaciones)               │
│       │                                                  │
│       ▼                                                  │
│  Fichas generadas                                       │
│       │                                                  │
│       ▼                                                  │
│  FichaEditor.vue + CvssCalculator.vue                   │
│  (editar, completar, calcular CVSS)                     │
│       │                                                  │
│       ▼                                                  │
│  ReportPreview.vue                                      │
│  (configurar metadata, preview)                         │
│       │                                                  │
│       ▼                                                  │
│  POST /api/report/generate                              │
│       │                                                  │
│       ▼                                                  │
│  pdf.js (Puppeteer)                                     │
│       │                                                  │
│       ▼                                                  │
│  informe_final.pdf  ← ENTREGABLE                        │
└─────────────────────────────────────────────────────────┘
```

---

## Estructura de una ficha de vulnerabilidad

Cada ficha tiene los siguientes campos:

```json
{
  "id":           "VULN-001",
  "titulo":       "Servidor MySQL expuesto públicamente",
  "categoria":    "exposicion_servicio",
  "fuente":       "shodan",
  "cve_id":       "CVE-2023-21980",

  "descripcion":  "El puerto 3306 (MySQL) se encuentra accesible...",
  "evidencia":    "IP: 190.x.x.x Puerto: 3306 Banner: MySQL 5.7.38",
  "impacto":      "Acceso no autorizado a base de datos...",

  "cvss": {
    "version":    "3.1",
    "vector":     "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
    "score":      9.8,
    "severity":   "CRÍTICO",
    "metrics": {
      "AV": "N",   "AC": "L",   "PR": "N",
      "UI": "N",   "S":  "U",   "C":  "H",
      "I":  "H",   "A":  "H"
    }
  },

  "recomendacion": "Restringir acceso al puerto 3306 mediante firewall...",
  "referencias":   ["https://nvd.nist.gov/vuln/detail/CVE-2023-21980"],
  "estado":        "abierto",
  "prioridad":     1
}
```

---

## Calculadora CVSS 3.1

El módulo implementa el estándar CVSS 3.1 completo según la especificación FIRST.

### Métricas del vector base

| Métrica | Código | Valores posibles |
|---------|--------|-----------------|
| Attack Vector | AV | Network (N) / Adjacent (A) / Local (L) / Physical (P) |
| Attack Complexity | AC | Low (L) / High (H) |
| Privileges Required | PR | None (N) / Low (L) / High (H) |
| User Interaction | UI | None (N) / Required (R) |
| Scope | S | Unchanged (U) / Changed (C) |
| Confidentiality | C | None (N) / Low (L) / High (H) |
| Integrity | I | None (N) / Low (L) / High (H) |
| Availability | A | None (N) / Low (L) / High (H) |

### Rangos de severidad

| Score | Severidad |
|-------|-----------|
| 9.0 – 10.0 | CRÍTICO |
| 7.0 – 8.9  | ALTO |
| 4.0 – 6.9  | MEDIO |
| 0.1 – 3.9  | BAJO |
| 0.0        | NINGUNO |

### Funciones del motor CVSS

```javascript
// Desde métricas individuales
calculate({ AV:"N", AC:"L", PR:"N", UI:"N", S:"U", C:"H", I:"H", A:"H" })
// → { score: 9.8, severity: "CRÍTICO", vector: "CVSS:3.1/AV:N/..." }

// Desde vector string
calculateFromVector("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H")
// → { score: 9.8, severity: "CRÍTICO", ... }

// Test interno (casos de prueba FIRST)
runSelfTest()
```

---

## Estructura del informe PDF

```
┌─────────────────────────────┐
│  PORTADA                    │
│  Logo · Título · Target     │
│  Fecha · Clasificación      │
├─────────────────────────────┤
│  ÍNDICE                     │
│  1. Resumen Ejecutivo       │
│  2. Metodología             │
│  3. Hallazgos               │
│  4. Fichas de Vulnerabilidad│
│  5. Recomendaciones         │
│  6. Conclusiones            │
├─────────────────────────────┤
│  RESUMEN EJECUTIVO          │
│  Métricas · Gráfico riesgo  │
│  Top 5 hallazgos            │
├─────────────────────────────┤
│  FICHA 001 — VULN-001       │
│  Título · Categoría · CVSS  │
│  Descripción · Evidencia    │
│  Impacto · Recomendación    │
│  Referencias                │
├─────────────────────────────┤
│  FICHA 002 — VULN-002       │
│  ...                        │
├─────────────────────────────┤
│  RECOMENDACIONES GENERALES  │
├─────────────────────────────┤
│  CONCLUSIONES               │
└─────────────────────────────┘
```

---

## Categorías de vulnerabilidad predefinidas

El `recommender.js` tiene recomendaciones para estas categorías:

| Categoría | Descripción | Variantes |
|-----------|-------------|-----------|
| `exposicion_servicio` | Puertos/servicios expuestos públicamente | `database`, `web_server`, `management` |
| `cve_critico` | CVE con CVSS ≥ 9.0 detectado por Shodan/Censys | — |
| `tls_issue` | Certificado expirado o autofirmado | — |
| `email_spoofing` | Ausencia de SPF/DMARC/DKIM | `no_spf_no_dmarc`, `spf_no_dmarc`, `weak_dmarc` |
| `archivo_sensible` | Archivo sensible en historial Wayback | — |
| `panel_admin` | Panel de administración expuesto | — |
| `whois_expiracion` | Dominio próximo a expirar | — |
| `email_expuesto` | Emails corporativos expuestos via Hunter | — |
| `backup_expuesto` | Archivos de backup accesibles | — |
| `api_expuesta` | Endpoint de API sin autenticación aparente | — |

Cada categoría incluye:
- Acción inmediata de remediación
- Acciones de hardening adicionales
- Referencias técnicas (RFC, OWASP, NIST, CVE)
- SLA sugerido según severidad CVSS
- Nivel de dificultad de implementación

---

## Instalación

### Requisitos previos

- Node.js 20+
- npm

### Backend

```bash
cd condor-report/backend
npm install
npm run dev        # Puerto 3001 (nodemon)
```

### Frontend

```bash
cd condor-report/frontend
npm install
npm run dev        # Puerto 5174
```

### Variables de entorno

```env
# backend/.env
PORT=3001
FRONTEND_URL=http://localhost:5174
PDF_TIMEOUT=30000      # ms para Puppeteer
OUTPUT_DIR=./output
```

---

## API endpoints

### Reportes

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/report/import` | Importa JSON de condor-cli, genera fichas |
| `POST` | `/api/report/generate` | Genera PDF desde fichas + metadata |

### CVSS

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/cvss/calculate?vector=CVSS:3.1/...` | Calcula score desde vector string |
| `POST` | `/api/cvss/calculate` | Calcula score desde métricas individuales |
| `GET` | `/api/cvss/presets` | Lista de vectores predefinidos |
| `GET` | `/api/cvss/presets/:id` | Preset específico |
| `GET` | `/api/cvss/suggest` | Sugiere preset por categoría |
| `GET` | `/api/cvss/metrics` | Definiciones de métricas (para UI) |
| `GET` | `/api/cvss/self-test` | Ejecuta tests contra casos del FIRST |

### Fichas

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/ficha/categories` | Categorías disponibles |
| `POST` | `/api/ficha/recommend` | Recomendación por categoría + contexto |
| `POST` | `/api/ficha/enrich` | Enriquece una ficha individual |
| `POST` | `/api/ficha/enrich-all` | Enriquece un array de fichas |
| `POST` | `/api/ficha/general-recommendations` | Recomendaciones generales del informe |
| `POST` | `/api/ficha/new` | Crea ficha vacía lista para editar |

### Ejemplos

**POST /api/report/import**

```json
// Request
{ "results": { "dns": {...}, "shodan": {...}, ... } }

// Response
{
  "success": true,
  "fichas": [ { "id": "VULN-001", "titulo": "...", ... } ],
  "stats": { "total": 12, "by_severity": { "CRITICO": 2, "ALTO": 5 } }
}
```

**POST /api/report/generate**

```json
// Request
{
  "meta": {
    "titulo": "Informe de Auditoría OSINT",
    "target": "objetivo.bo",
    "analista": "Alexander Villarroel",
    "clasificacion": "CONFIDENCIAL",
    "fecha": "2026-06-08"
  },
  "fichas": [ ... ],
  "formato": "pdf"
}

// Response
{
  "success": true,
  "path": "./output/informe_objetivo_bo.pdf",
  "filename": "informe_objetivo_bo.pdf",
  "downloadUrl": "/api/report/download/informe_objetivo_bo.pdf"
}
```

**GET /api/cvss/calculate?vector=CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H**

```json
{
  "score": 9.8,
  "severity": "CRÍTICO",
  "vector": "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
  "description": "...",
  "severity_info": { "color": "#ef4444", "label": "CRÍTICO" }
}
```

---

## Motor de recomendaciones

El `recommender.js` genera recomendaciones contextuales para cada hallazgo:

```javascript
// Obtener recomendación por categoría
const rec = getRecommendation("email_spoofing", { has_spf: true, has_dmarc: false })
// → { immediate: "...", hardening: [...], references: [...], sla: "72 horas" }

// Enriquecer una ficha completa
const fichaEnriquecida = enrichFicha(ficha)

// Enriquecer todas las fichas
const todasEnriquecidas = enrichAll(fichas)

// Recomendaciones generales para el informe
const recomendaciones = generateGeneralRecommendations(fichas)
```

---

## Dependencias

### Backend

| Paquete | Versión | Uso |
|---------|---------|-----|
| `express` | ^4.19.2 | Framework web |
| `cors` | ^2.8.5 | Cross-Origin Resource Sharing |
| `dotenv` | ^16.4.5 | Variables de entorno |
| `puppeteer` | ^22.12.1 | Generación de PDF |
| `nodemon` | ^3.1.4 | Dev server con auto-reload (devDependency) |

### Frontend

| Paquete | Versión | Uso |
|---------|---------|-----|
| `vue` | ^3.4.31 | Framework UI |
| `vite` | ^5.3.1 | Build tool y dev server (devDependency) |
| `@vitejs/plugin-vue` | ^5.0.5 | Plugin Vue para Vite (devDependency) |

> **Nota:** No usa vue-router ni state management. La navegación es manual via stepper en `App.vue`.

---

## Detalle por componente

### calculator.js (470 líneas)

Motor matemático CVSS 3.1 según especificación FIRST. Implementa:
- Pesos por métrica (incluye variación de PR según Scope)
- Redondeo especial CVSS (`roundup` al primer decimal)
- Validación completa de métricas
- Test interno con casos de prueba oficiales

### vectors.js (657 líneas)

Catálogo de las 8 métricas del vector base. Cada opción incluye:
- Valor, label, descripción, ejemplo CVE real, peso, color para UI
- Vectores predefinidos comunes
- Funciones de descripción en lenguaje natural

### importer.js (649 líneas)

Parser que convierte el JSON de `condor-cli` en fichas automáticas:
- Extrae CVEs de Shodan/Censys con CVSS pre-calculado
- Detecta puertos peligrosos y servicios expuestos
- Analiza SPF/DMARC/DKIM para email spoofing
- Identifica archivos sensibles en Wayback
- Genera IDs autoincrementales (VULN-001, VULN-002, ...)

### recommender.js (540 líneas)

Base de conocimiento de 10 categorías de vulnerabilidad:
- Recomendación inmediata + hardening adicional
- Variantes según contexto específico
- SLA por severidad (CRÍTICO: 24h, ALTO: 7d, MEDIO: 30d, BAJO: 90d)
- Referencias técnicas (RFC, OWASP, NIST)

### pdf.js (1095 líneas)

Generador de PDF profesional con Puppeteer:
- Portada con gradiente dark y logo Cóndor
- CSS completo para A4 con tipografía Inter + JetBrains Mono
- Tabla de contenido automática
- Fichas con badges de severidad y barras CVSS
- Recomendaciones generales al final

### ImportPanel.vue (629 líneas)

Pantalla de carga con drag-and-drop:
- Validación de JSON (estructura `meta` + `results`)
- Spinner de loading durante importación
- Comando de ejemplo para generar el JSON
- Alternativa para crear fichas manualmente

### FichaEditor.vue (1022 líneas)

Editor completo de fichas con tabs:
- **Tab Info:** Título, categoría, fuente, CVE ID, descripción, evidencia, impacto
- **Tab CVSS:** Calculadora integrada con score en tiempo real
- **Tab Evidencia:** Campo de evidencia técnica
- **Tab Recomendación:** Recomendación de remediación
- Acciones: duplicar, eliminar, drag para reordenar

### CvssCalculator.vue (836 líneas)

Calculadora CVSS 3.1 interactiva:
- 8 métricas con botones de selección
- Score calculado en tiempo real
- Sub-scores (impacto + exploitability)
- Modo compacto para usar dentro de FichaEditor
- Link a especificación FIRST

### ReportPreview.vue (1003 líneas)

Preview y configuración de export:
- Campos de metadata (título, analista, fecha, clasificación)
- Opciones del informe (portada, TOC, etc.)
- Botón de export PDF con estado de carga
- Link de descarga del PDF generado

---

## Roadmap

- [x] `cvss/calculator.js` — Motor CVSS 3.1 completo
- [x] `cvss/vectors.js` — Definiciones y pesos
- [x] `lib/importer.js` — Parser de JSON condor-cli
- [x] `lib/recommender.js` — Motor de recomendaciones
- [x] `generators/pdf.js` — Export PDF con Puppeteer
- [x] `routes/` — API Express completa
- [x] `frontend/ImportPanel.vue` — Importar JSON
- [x] `frontend/FichaEditor.vue` — Editor de fichas
- [x] `frontend/CvssCalculator.vue` — UI calculadora
- [x] `frontend/ReportPreview.vue` — Preview antes de exportar
- [x] `server.js` — Entrypoint del backend Express
- [ ] `generators/docx.js` — Export DOCX (fase 2)
- [ ] `templates/report.html` — Template HTML externo para PDF

---

## Autor

**Alexander Villarroel Torrico**
Estudiante de Ingeniería Informática — UMSA, La Paz, Bolivia
[![GitHub](https://img.shields.io/badge/GitHub-villaalextor-181717?style=flat-square&logo=github)](https://github.com/villaalextor)

---

*Parte del [Cóndor Framework](../README.md) — Pipeline de reconocimiento pasivo OSINT*
