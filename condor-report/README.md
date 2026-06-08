# condor-report

> **Módulo 3 del Cóndor Framework** — Generador de fichas de vulnerabilidad con CVSS 3.1 y export PDF profesional.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Vue.js](https://img.shields.io/badge/Vue.js-3-41B883?style=flat-square&logo=vue.js&logoColor=white)](https://vuejs.org)
[![Express](https://img.shields.io/badge/Express-4-000000?style=flat-square&logo=express)](https://expressjs.com)
[![Puppeteer](https://img.shields.io/badge/Puppeteer-22-40B5A4?style=flat-square&logo=puppeteer)](https://pptr.dev)

---

## ¿Qué es condor-report?

`condor-report` convierte los hallazgos del reconocimiento pasivo en **informes de auditoría profesionales**. Toma el JSON generado por `condor-cli` (o los hallazgos seleccionados en `condor-dashboard`) y produce fichas de vulnerabilidad documentadas, con scoring CVSS 3.1 calculado automáticamente y recomendaciones predefinidas por categoría.

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
│   ├── src/
│   │   ├── server.js           ← Entrypoint del servidor
│   │   ├── routes/
│   │   │   ├── report.js       ← POST /api/report/generate
│   │   │   ├── ficha.js        ← CRUD de fichas
│   │   │   └── cvss.js         ← GET /api/cvss/calculate
│   │   ├── generators/
│   │   │   ├── pdf.js          ← Puppeteer → PDF
│   │   │   ├── docx.js         ← docx library → DOCX (fase 2)
│   │   │   └── html.js         ← Template HTML standalone
│   │   ├── cvss/
│   │   │   ├── calculator.js   ← Motor CVSS 3.1
│   │   │   └── vectors.js      ← Definiciones AV/AC/PR/UI/S/C/I/A
│   │   ├── templates/
│   │   │   ├── report.html     ← Template Puppeteer (PDF)
│   │   │   └── ficha.html      ← Template ficha individual
│   │   └── lib/
│   │       ├── importer.js     ← Parser del JSON de condor-cli
│   │       └── recommender.js  ← Motor de recomendaciones
│   └── package.json
│
└── frontend/                   ← UI Vue.js 3
    ├── src/
    │   ├── main.js
    │   ├── App.vue
    │   ├── components/
    │   │   ├── FichaEditor.vue     ← Formulario de ficha
    │   │   ├── CvssCalculator.vue  ← Calculadora CVSS 3.1 interactiva
    │   │   ├── ReportPreview.vue   ← Preview del informe
    │   │   ├── FichaList.vue       ← Lista de fichas del reporte
    │   │   └── ImportPanel.vue     ← Importar JSON de condor-cli
    │   └── views/
    │       ├── HomeView.vue        ← Dashboard principal
    │       └── EditorView.vue      ← Editor de fichas
    └── package.json
```

---

## Flujo de trabajo

```
┌─────────────────────────────────────────────────────────┐
│                    FLUJO DE DATOS                        │
│                                                          │
│  condor-cli output          condor-dashboard             │
│  (scan.json)                (hallazgos seleccionados)    │
│       │                            │                     │
│       └──────────┬─────────────────┘                     │
│                  ▼                                       │
│         ImportPanel.vue                                  │
│         (carga y parsea el JSON)                         │
│                  │                                       │
│                  ▼                                       │
│         importer.js                                      │
│         (extrae hallazgos automáticamente)               │
│                  │                                       │
│         ┌────────┴────────┐                              │
│         ▼                 ▼                              │
│    Auto-fichas        Manual                             │
│    (desde CVEs,       (el analista                       │
│     ports, etc.)       crea fichas)                      │
│         │                 │                              │
│         └────────┬────────┘                              │
│                  ▼                                       │
│         FichaEditor.vue                                  │
│         + CvssCalculator.vue                             │
│         (editar, completar, calcular CVSS)               │
│                  │                                       │
│                  ▼                                       │
│         ReportPreview.vue                                │
│         (preview antes de exportar)                      │
│                  │                                       │
│                  ▼                                       │
│         POST /api/report/generate                        │
│                  │                                       │
│         ┌────────┴────────┐                              │
│         ▼                 ▼                              │
│       pdf.js           html.js                           │
│     (Puppeteer)       (standalone)                       │
│         │                                                │
│         ▼                                                │
│    informe_final.pdf  ← ENTREGABLE                       │
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

El módulo implementa el estándar CVSS 3.1 completo:

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

| Categoría | Descripción |
|-----------|-------------|
| `exposicion_servicio` | Puertos/servicios expuestos públicamente |
| `cve_critico` | CVE con CVSS ≥ 9.0 detectado por Shodan/Censys |
| `tls_issue` | Certificado expirado o autofirmado |
| `email_spoofing` | Ausencia de SPF/DMARC/DKIM |
| `archivo_sensible` | Archivo sensible en historial Wayback |
| `panel_admin` | Panel de administración expuesto |
| `whois_expiracion` | Dominio próximo a expirar |
| `email_expuesto` | Emails corporativos expuestos via Hunter |
| `backup_expuesto` | Archivos de backup accesibles |
| `api_expuesta` | Endpoint de API sin autenticación aparente |

---

## Instalación

```bash
# Backend
cd condor-report/backend
npm install
npm run dev        # Puerto 3001

# Frontend
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

| Método | Ruta | Descripción |
|--------|------|-------------|
| `POST` | `/api/report/generate` | Genera PDF/DOCX/HTML del reporte |
| `POST` | `/api/report/import` | Importa JSON de condor-cli |
| `GET`  | `/api/cvss/calculate` | Calcula score desde vector string |
| `POST` | `/api/cvss/calculate` | Calcula score desde métricas individuales |

### POST /api/report/generate

```json
{
  "meta": {
    "titulo":        "Informe de Auditoría OSINT",
    "target":        "objetivo.bo",
    "analista":      "Alexander Villarroel",
    "clasificacion": "CONFIDENCIAL",
    "fecha":         "2026-06-08"
  },
  "fichas":  [ { ...ficha1 }, { ...ficha2 } ],
  "formato": "pdf"
}
```

### GET /api/cvss/calculate?vector=CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H

```json
{
  "score":    9.8,
  "severity": "CRÍTICO",
  "vector":   "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"
}
```

---

## Roadmap

- [ ] `cvss/calculator.js` — Motor CVSS 3.1 completo
- [ ] `cvss/vectors.js` — Definiciones y pesos
- [ ] `lib/importer.js` — Parser de JSON condor-cli
- [ ] `lib/recommender.js` — Motor de recomendaciones
- [ ] `generators/pdf.js` — Export PDF con Puppeteer
- [ ] `templates/report.html` — Template HTML del informe
- [ ] `routes/` — API Express completa
- [ ] `frontend/CvssCalculator.vue` — UI calculadora
- [ ] `frontend/FichaEditor.vue` — Editor de fichas
- [ ] `frontend/ReportPreview.vue` — Preview antes de exportar
- [ ] `generators/docx.js` — Export DOCX (fase 2)

---

## Autor

**Alexander Villarroel Torrico**
Estudiante de Ingeniería Informática — UMSA, La Paz, Bolivia
[![GitHub](https://img.shields.io/badge/GitHub-villaalextor-181717?style=flat-square&logo=github)](https://github.com/villaalextor)

---

*Parte del [Cóndor Framework](../README.md) — Pipeline de reconocimiento pasivo OSINT*