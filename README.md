<div align="center">

```
 ██████╗ ██████╗ ███╗   ██╗██████╗  ██████╗ ██████╗
██╔════╝██╔═══██╗████╗  ██║██╔══██╗██╔═══██╗██╔══██╗
██║     ██║   ██║██╔██╗ ██║██║  ██║██║   ██║██████╔╝
██║     ██║   ██║██║╚██╗██║██║  ██║██║   ██║██╔══██╗
╚██████╗╚██████╔╝██║ ╚████║██████╔╝╚██████╔╝██║  ██║
 ╚═════╝ ╚═════╝ ╚═╝  ╚═══╝╚═════╝  ╚═════╝ ╚═╝  ╚═╝

███████╗██████╗  █████╗ ███╗   ███╗███████╗██╗    ██╗ ██████╗ ██████╗ ██╗  ██╗
██╔════╝██╔══██╗██╔══██╗████╗ ████║██╔════╝██║    ██║██╔═══██╗██╔══██╗██║ ██╔╝
█████╗  ██████╔╝███████║██╔████╔██║█████╗  ██║ █╗ ██║██║   ██║██████╔╝█████╔╝
██╔══╝  ██╔══██╗██╔══██║██║╚██╔╝██║██╔══╝  ██║███╗██║██║   ██║██╔══██╗██╔═██╗
██║     ██║  ██║██║  ██║██║ ╚═╝ ██║███████╗╚███╔███╔╝╚██████╔╝██║  ██║██║  ██╗
╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝╚═╝     ╚═╝╚══════╝ ╚══╝╚══╝  ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
```

**Reconocimiento Pasivo de Extremo a Extremo**

[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)
[![Status](https://img.shields.io/badge/Status-En%20Desarrollo-orange?style=flat-square)]()
[![OSINT](https://img.shields.io/badge/Tipo-OSINT%20Pasivo-red?style=flat-square)]()

</div>

---

## ¿Qué es Cóndor Framework?

**Cóndor Framework** es un monorepo de reconocimiento pasivo (OSINT) compuesto por tres módulos integrados que cubren todo el ciclo de un análisis de seguridad: desde la recolección automatizada de inteligencia, pasando por la visualización interactiva de resultados, hasta la generación de informes profesionales con scoring CVSS 3.1.

Está diseñado para profesionales de ciberseguridad, pentesters y analistas que necesitan un flujo de trabajo estructurado, reproducible y documentado - sin depender de herramientas comerciales ni exponer el objetivo a tráfico activo.

```
┌─────────────────────────────────────────────────────────────────┐
│                      CÓNDOR FRAMEWORK                          │
│                                                                 │
│  ┌──────────────┐    JSON/API    ┌──────────────┐              │
│  │   condor-    │ ─────────────► │   condor-    │              │
│  │   cli        │                │   dashboard  │              │
│  │              │                │              │              │
│  │ Recolección  │                │ Visualización│              │
│  │ automatizada │                │ interactiva  │              │
│  └──────────────┘                └──────┬───────┘              │
│                                         │ Export                │
│                                         ▼                       │
│                                  ┌──────────────┐              │
│                                  │   condor-    │              │
│                                  │   report     │              │
│                                  │              │              │
│                                  │ Fichas vuln. │              │
│                                  │ CVSS 3.1     │              │
│                                  └──────────────┘              │
└─────────────────────────────────────────────────────────────────┘
```

---

## ¿Por qué existe este proyecto?

Durante el desarrollo de auditorías de seguridad reales en entornos académicos y profesionales, se identificó un problema recurrente: **el reconocimiento pasivo es tedioso, fragmentado y difícil de documentar**.

Las herramientas actuales como Maltego, Shodan o FOCA son poderosas pero aisladas. El analista termina copiando datos entre ventanas, construyendo informes a mano y sin trazabilidad del proceso. Cóndor Framework resuelve esto al unificar la cadena completa en un ecosistema cohesionado, open source y extensible.

**Casos de uso:**
- Auditorías de seguridad en organizaciones (pre-engagement)
- Ejercicios académicos de ethical hacking
- Bug bounty (reconocimiento inicial)
- Monitoreo de exposición de activos propios

---

## Módulos

### `condor-cli` — OSINT Automator CLI

Motor de recolección pasiva de inteligencia. Script Python con interfaz de línea de comandos que consulta múltiples fuentes públicas y APIs sin generar tráfico directo al objetivo.

**Fuentes consultadas:**
- DNS pasivo (registros A, MX, NS, TXT, CNAME)
- WHOIS histórico y actual
- Censys.io (puertos, servicios, certificados TLS)
- Shodan (banners, tecnologías expuestas)
- Hunter.io (emails corporativos filtrados)
- FOCA-like (metadatos de documentos públicos vía Google Dorks)
- Have I Been Pwned API (brechas asociadas al dominio)
- Wayback Machine / Archive.org (URLs históricas)
- Certificate Transparency Logs (subdominios via crt.sh)

**Output:** JSON estructurado, listo para ser consumido por el dashboard o exportado directamente.

```bash
# Uso básico
python condor.py --target ejemplo.bo --output recon_ejemplo.json

# Con módulos específicos
python condor.py --target ejemplo.bo --modules dns,whois,censys,crt

# Output HTML standalone
python condor.py --target ejemplo.bo --format html --output reporte.html

# Verbose + guardar logs
python condor.py --target ejemplo.bo --verbose --log condor.log
```

**Tecnologías:** Python 3.11+, `argparse`, `dnspython`, `python-whois`, `requests`, `rich` (CLI styling), `jinja2` (HTML output)

---

###  `condor-dashboard` — Passive Recon Dashboard

Interfaz web interactiva que consume el JSON generado por `condor-cli` y presenta los resultados de forma visual y navegable.

**Características:**
- Carga de archivos JSON desde el CLI o ingesta directa vía API local
- Mapa de red interactivo (nodos: dominio → subdominios → IPs → puertos)
- Timeline de cambios históricos (Wayback + DNS pasivo)
- Tabla de puertos y servicios con filtros
- Heatmap de exposición por categoría de riesgo
- Exportación de vistas seleccionadas hacia `condor-report`

**Tecnologías:** React 18, D3.js (grafos de red), Recharts (charts), Tailwind CSS, Vite

---

###  `condor-report` — Vulnerability Ficha Generator

Generador de informes de auditoría. Toma los datos del dashboard y produce fichas de vulnerabilidad formateadas con scoring CVSS 3.1 automático y recomendaciones.

**Características:**
- Fichas individuales por hallazgo con campos: descripción, evidencia, impacto, vector CVSS 3.1
- Calculadora CVSS 3.1 integrada (AV, AC, PR, UI, S, C, I, A)
- Clasificación automática: Crítico / Alto / Medio / Bajo / Informativo
- Recomendaciones predefinidas por categoría de vulnerabilidad
- Export a PDF, DOCX y HTML
- Portada, índice, resumen ejecutivo y fichas técnicas generados automáticamente

**Tecnologías:** Node.js / Express, Puppeteer (PDF), `docx` library, Vue.js 3 (frontend del generador)

---

## Estructura del Monorepo

```
condor-framework/
├── README.md                   ← Este archivo
├── LICENSE
├── .gitignore
├── docker-compose.yml          ← Levantar todo el stack
│
├── condor-cli/                 ← Módulo 1: CLI Python
│   ├── condor.py               ← Entrypoint principal
│   ├── modules/
│   │   ├── censys_query.py
│   │   ├── dns_recon.py 
│   │   ├── metadata_hunter.py
│   │   ├── shodan_query.py
│   │   ├── wayback.py
│   │   ├── whois_lookup.py 
│   ├── output/
│   │   ├── templates/          ← Jinja2 HTML templates
│   │   └── schemas/            ← JSON schemas de output
│   ├── requirements.txt
│   └── README.md
│
├── condor-dashboard/           ← Módulo 2: Dashboard React
│   ├── src/
│   │   ├── App.jsx
│   │   ├── components/
│   │   │   ├── Overview.jsx
│   │   │   ├── DnsView.jsx
│   │   │   ├── WhoisView.jsx
│   │   │   ├── WaybackView.jsx
│   │   │   ├── ShodanView.jsx
│   │   │   ├── HunterView.jsx
│   │   │   └── Timeline/
│   │   ├── pages/
│   │   ├── hooks/
│   │   └── utils/
│   ├── public/
│   ├── package.json
│   └── README.md
│
├── condor-report/              ← Módulo 3: Report Generator
│   ├── backend/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   ├── generators/     ← PDF, DOCX, HTML
│   │   │   └── cvss/           ← Calculadora CVSS 3.1
│   │   └── package.json
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── FichaEditor/
│   │   │   │   ├── CvssCalculator/
│   │   │   │   └── ReportPreview/
│   │   │   └── views/
│   │   └── package.json
│   └── README.md
│
└── docs/
    ├── arquitectura.md
    ├── guia-uso.md
    └── screenshots/
```

---
condor-framework/
├── .gitignore                    ✅
├── docker-compose.yml            ✅
├── README.md                     ✅
│
├── condor-cli/
│   ├── condor.py                 ✅ FUNCIONA (lo viste corriendo)
│   ├── requirements.txt          ✅
│   ├── .env.example              ✅
│   └── modules/
│       ├── dns_recon.py          ✅
│       ├── whois_lookup.py       ✅
│       ├── wayback.py            ✅
│       ├── censys_query.py       ✅
│       ├── shodan_query.py       ✅
│       └── hunter_lookup.py      ✅
│
├── condor-dashboard/
│   ├── package.json              ✅
│   ├── vite.config.js            ✅
│   ├── tailwind.config.js        ✅
│   ├── index.html                ✅ (recién generado)
│   └── src/
│       ├── main.jsx              ✅ (recién generado)
│       ├── index.css             ✅ (recién generado)
│       ├── App.jsx               ✅
│       └── components/
│           ├── Overview.jsx      ✅
│           ├── DnsView.jsx       ✅
│           ├── WhoisView.jsx     ✅
│           ├── WaybackView.jsx   ✅
│           ├── CensysView.jsx    ✅
│           ├── ShodanView.jsx    ✅
│           └── HunterView.jsx    ✅
│
└── condor-report/
    ├── README.md                 ✅
    ├── backend/
    │   ├── package.json          ✅
    │   └── src/
    │       ├── server.js         ✅
    │       ├── cvss/
    │       │   ├── calculator.js ✅
    │       │   └── vectors.js    ✅
    │       ├── lib/
    │       │   ├── importer.js   ✅
    │       │   └── recommender.js✅
    │       ├── generators/
    │       │   └── pdf.js        ✅
    │       └── routes/
    │           ├── report.js     ✅
    │           ├── cvss.js       ✅
    │           └── ficha.js      ✅
    └── frontend/
        ├── package.json          ✅
        ├── vite.config.js        ✅
        ├── index.html            ✅ (recién generado)
        ├── main.js               ✅
        ├── App.vue               ✅
        └── components/
            ├── ImportPanel.vue   ✅
            ├── FichaEditor.vue   ✅
            ├── CvssCalculator.vue✅
            └── ReportPreview.vue ✅
---
---

## Flujo de trabajo completo

```
1. OBJETIVO DEFINIDO
        │
        ▼
2. condor-cli --target objetivo.bo --output scan.json
   • Consulta DNS, WHOIS, Censys, crt.sh, Wayback...
   • Genera: scan.json
        │
        ▼
3. condor-dashboard (carga scan.json)
   • Visualiza red de activos, puertos, tecnologías
   • Analista revisa, filtra, selecciona hallazgos
   • Exporta: hallazgos_seleccionados.json
        │
        ▼
4. condor-report (carga hallazgos)
   • Genera fichas por vulnerabilidad
   • Calcula CVSS 3.1 automáticamente
   • Produce: informe_final.pdf / .docx
        │
        ▼
5. INFORME ENTREGADO AL CLIENTE
```

---

## Instalación

### Requisitos previos
- Python 3.11+
- Node.js 20+
- npm o yarn
- Docker (opcional, para levantar todo el stack)

### Opción A — Con Docker (recomendado)

```bash
git clone https://github.com/villaalextor/condor-framework.git
cd condor-framework
docker-compose up -d
```

### Opción B — Manual por módulo

```bash
# Clonar repositorio
git clone https://github.com/villaalextor/condor-framework.git
cd condor-framework

# --- condor-cli ---
cd condor-cli
pip install -r requirements.txt
python condor.py --help

# --- condor-dashboard ---
cd ../condor-dashboard
npm install
npm run dev

# --- condor-report ---
cd ../condor-report/backend
npm install
npm run start

cd ../frontend
npm install
npm run dev
```

### Variables de entorno

Copiar `.env.example` en cada módulo y completar las API keys:

```env
# condor-cli/.env
CENSYS_API_ID=tu_api_id
CENSYS_API_SECRET=tu_api_secret
SHODAN_API_KEY=tu_shodan_key
HUNTER_API_KEY=tu_hunter_key
HIBP_API_KEY=tu_hibp_key
```

> **Todas las APIs tienen tier gratuito suficiente para uso académico.** Censys ofrece 250 queries/mes gratis. Shodan tiene plan académico gratuito.

---

## Consideraciones éticas y legales

> **ADVERTENCIA:** Esta herramienta está diseñada exclusivamente para reconocimiento **pasivo**. No genera tráfico directo al objetivo más allá de consultas a APIs y bases de datos públicas.

- ✅ Usar únicamente en dominios propios o con autorización escrita del propietario
- ✅ El uso académico debe enmarcarse en prácticas supervisadas
- ❌ Prohibido usar contra objetivos sin consentimiento
- ❌ No usar para actividades ilegales o maliciosas

El autor no se responsabiliza por el uso indebido de esta herramienta. Ver [LICENSE](LICENSE) y [ÉTICA.md](docs/etica.md).

---

## Roadmap

- [x] Diseño de arquitectura y monorepo
- [ ] `condor-cli` v0.1 — DNS + WHOIS + crt.sh
- [ ] `condor-cli` v0.2 — Censys + Shodan + Wayback
- [ ] `condor-dashboard` v0.1 — Carga JSON + tabla básica
- [ ] `condor-dashboard` v0.2 — Network graph D3.js
- [ ] `condor-report` v0.1 — Fichas CVSS + export PDF
- [ ] `condor-report` v0.2 — Export DOCX + portada automática
- [ ] Docker Compose completo
- [ ] Documentación en GitHub Pages

---

## Autor

**Alexander Villarroel Torrico**
Estudiante de Ingeniería Informática — Universidad Mayor de San Andrés (UMSA)
La Paz, Bolivia

[![GitHub](https://img.shields.io/badge/GitHub-villaalextor-181717?style=flat-square&logo=github)](https://github.com/villaalextor)
[![Portfolio](https://img.shields.io/badge/Portfolio-villaalextor.github.io-0A66C2?style=flat-square&logo=github-pages)](https://villaalextor.github.io)
[![Email](https://img.shields.io/badge/Email-alexvillarroeltorrico%40gmail.com-EA4335?style=flat-square&logo=gmail)](mailto:alexvillarroeltorrico@gmail.com)

---

## Licencia

MIT License — ver [LICENSE](LICENSE) para detalles.

---
