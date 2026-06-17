# condor-dashboard

> **Módulo 2 del Cóndor Framework** — Panel de visualización interactiva de resultados OSINT con estética terminal/hacker.

[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://reactjs.org)
[![Vite](https://img.shields.io/badge/Vite-6-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev)
[![Tailwind](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)](https://tailwindcss.com)

---

## ¿Qué es condor-dashboard?

`condor-dashboard` es una interfaz web que consume el JSON generado por `condor-cli` y presenta los resultados de reconocimiento pasivo de forma visual, navegable e interactiva.

No consume APIs en tiempo real — carga un archivo `.json` y renderiza los datos del escaneo. Está diseñado como visor de reportes individuales.

---

## Características

- **Drag & Drop** para cargar archivos JSON directamente desde el navegador
- **7 módulos visuales**: Overview, DNS, WHOIS, Wayback, Censys, Shodan, Hunter
- **Estética terminal/OSINT**: fondo oscuro (#0a0e17), verde neón (#00ff88), cyan (#00d4ff)
- **Tipografía JetBrains Mono** para datos técnicos, Inter para UI
- **Secciones colapsables** en cada vista para organizar la información
- **Sin dependencias externas de UI**: todo es React vanilla con Tailwind CSS

---

## Arquitectura

```
condor-dashboard/
│
├── index.html              ← Entry HTML (Vite)
├── index.css               ← Estilos globales (scrollbar, animaciones, reset)
├── main.js                 ← Entry point residual (no usado por Vite)
├── package.json            ← Dependencias y scripts
├── vite.config.js          ← Configuración Vite (puerto 5173)
├── tailwind.config.js      ← Paleta Cóndor + fuentes personalizadas
├── postcss.config.js       ← PostCSS + Autoprefixer
│
└── src/
    ├── main.jsx            ← Entry point de React (el que Vite usa)
    ├── index.css           ← Tailwind directives
    ├── App.jsx             ← Componente raíz: layout, sidebar, dropzone, navegación
    │
    └── components/
        ├── Overview.jsx    ← Panel de control: métricas globales, hallazgos, riesgo
        ├── DnsView.jsx     ← Registros DNS, subdominios, seguridad de email
        ├── WhoisView.jsx   ← Registro WHOIS, expiración, privacy, timeline
        ├── WaybackView.jsx ← URLs históricas, hallazgos, distribución por extensión
        ├── CensysView.jsx  ← Puertos, servicios, certificados TLS
        ├── ShodanView.jsx  ← Banners, CVEs, software expuesto
        └── HunterView.jsx  ← Emails corporativos, patrón, análisis de phishing
```

---

## Flujo de trabajo

```
┌─────────────────────────────────────────────────────┐
│                  FLUJO DE DATOS                      │
│                                                      │
│  condor-cli                                         │
│  python condor.py --target ejemplo.com              │
│       │                                              │
│       ▼                                              │
│  scan.json  ← output del CLI                         │
│       │                                              │
│       ▼                                              │
│  condor-dashboard                                    │
│  (drag & drop del archivo .json)                     │
│       │                                              │
│       ├──────────────────────────────────────┐       │
│       ▼                                      ▼       │
│  DropZone                          (validación)      │
│  (carga y parsea)                                 │
│       │                                              │
│       ▼                                              │
│  App.jsx → Sidebar + TopBar + Vista activa           │
│       │                                              │
│       ├── Overview  → métricas consolidadas          │
│       ├── DNS       → registros + email security     │
│       ├── WHOIS     → registrante + expiración       │
│       ├── Wayback   → URLs + hallazgos sensibles     │
│       ├── Censys    → puertos + TLS                  │
│       ├── Shodan    → CVEs + banners                 │
│       └── Hunter    → emails + phishing              │
└─────────────────────────────────────────────────────┘
```

---

## Paleta de colores

| Nivel | Color | Hex | Uso |
|-------|-------|-----|-----|
| CRÍTICO | Rojo | `#ff3b3b` | CVEs, puertos peligrosos, alertas |
| ALTO | Naranja | `#f97316` | Servicios expuestos, emails IT |
| MEDIO | Amarillo | `#eab308` | TLS issues, configs sensibles |
| BAJO | Verde | `#00ff88` | Informativo, hallazgos menores |
| Fondo | Negro azulado | `#0a0e17` | Fondo principal |
| Panel | Negro profundo | `#070b12` | Sidebar, tarjetas |
| Acento | Cyan | `#00d4ff` | Enlaces, highlights secundarios |

---

## Estados de módulo

Cada vista maneja 4 estados posibles:

| Estado | Descripción | Comportamiento |
|--------|-------------|----------------|
| `ok` | Datos disponibles | Renderiza la vista completa |
| `skipped` | Sin API key configurada | Muestra dónde registrarse |
| `error` | Error durante el escaneo | Muestra mensaje de error |
| `not_implemented` | Módulo no ejecutado | Muestra instrucción para ejecutar |

---

## Instalación

### Requisitos previos

- Node.js 20+
- npm

### Instalar y ejecutar

```bash
cd condor-dashboard
npm install
npm run dev
```

El servidor de desarrollo arranca en **http://localhost:5173**.

### Scripts disponibles

| Script | Comando | Descripción |
|--------|---------|-------------|
| `dev` | `vite` | Servidor de desarrollo con HMR |
| `build` | `vite build` | Build de producción en `dist/` |
| `preview` | `vite preview` | Preview del build de producción |

---

## Uso

1. Generar un reporte con `condor-cli`:

```bash
cd condor-cli
python condor.py --target ejemplo.com --output scan.json
```

2. Abrir **http://localhost:5173** en el navegador

3. Arrastrar `scan.json` sobre la zona de carga (o hacer click para seleccionar)

4. Navegar entre módulos usando el sidebar izquierdo

---

## Formato del JSON esperado

El dashboard espera un JSON con esta estructura:

```json
{
  "meta": {
    "target": "ejemplo.bo",
    "timestamp": "2024-01-01T00:00:00Z",
    "duration_seconds": 45,
    "modules_run": ["dns", "whois", "wayback", "censys", "shodan", "hunter"]
  },
  "results": {
    "dns":     { "status": "ok", "records": {...}, "subdomains": [...] },
    "whois":   { "status": "ok", "registrar": "...", "owner": {...} },
    "wayback": { "status": "ok", "findings": {...}, "urls": {...} },
    "censys":  { "status": "ok", "hosts": [...], "summary": {...} },
    "shodan":  { "status": "ok", "hosts": [...], "vulns": [...] },
    "hunter":  { "status": "ok", "emails": [...], "risk_emails": {...} }
  },
  "errors": {}
}
```

---

## Detalle por componente

### App.jsx (438 líneas)

Componente raíz que orquesta toda la aplicación. Contiene:

- **DropZone**: Pantalla de carga con drag-and-drop, validación de JSON y mensajes de error
- **Sidebar**: Navegación lateral con logo, target, riesgo global e indicadores de estado por módulo
- **TopBar**: Header con nombre de vista activa, módulos ejecutados y duración
- **PlaceholderView**: Vista genérica para módulos sin implementación visual

### Overview.jsx (522 líneas)

Panel de control principal. Consolida métricas de todos los módulos:

- 8 tarjetas de métricas (subdominios, puertos, CVEs, emails, URLs, archivos sensibles, etc.)
- 6 tarjetas de módulo con estado, riesgo y resumen (clickeables para navegar)
- Hallazgos críticos consolidados de todos los módulos

### DnsView.jsx (473 líneas)

Visualización de registros DNS y seguridad de email:

- Registros por tipo (A, MX, NS, TXT, CNAME) con resaltado para SPF/DMARC/DKIM
- Análisis de riesgo de email spoofing
- Tabla paginada de subdominios vía crt.sh

### WhoisView.jsx (443 líneas)

Información WHOIS del dominio:

- Barra visual de vida útil del dominio (registrado → expiración)
- Timeline de fechas (registro, actualización, expiración)
- Detalle de registrante y estados EPP
- Detección de WHOIS Privacy

### WaybackView.jsx (558 líneas)

URLs históricas vía Wayback Machine:

- Detección automática de severidad por URL (.env, .bak, .sql, .pem, etc.)
- Gráfico de barras por tipo de archivo
- Distribución de códigos HTTP históricos
- Lista completa con búsqueda y filtros

### CensysView.jsx (560 líneas)

Puertos, servicios y certificados TLS vía Censys:

- Clasificación semántica de puertos (peligrosos, web, bases de datos)
- Tarjetas de certificados TLS con análisis de validez
- Mapa de calor de puertos por host

### ShodanView.jsx (627 líneas)

Banners, software y CVEs vía Shodan:

- Alerta de CVEs críticos (CVSS ≥ 9.0)
- Distribución de vulnerabilidades por severidad
- Tarjetas de hosts con servicios, banners y CPEs
- Tags de host (honeypot, scanner, tor, cloud)

### HunterView.jsx (661 líneas)

Emails corporativos y análisis de phishing:

- Detección de patrón de email corporativo
- Clasificación: IT/Seguridad, Ejecutivos, Genéricos
- Emails de alto valor resaltados (superficie de spear phishing)
- Distribución por departamento con gráfico de barras

---

## Dependencias

### Producción

| Paquete | Versión | Uso |
|---------|---------|-----|
| `react` | ^18.3.1 | Framework UI |
| `react-dom` | ^18.3.1 | Renderer DOM |

### Desarrollo

| Paquete | Versión | Uso |
|---------|---------|-----|
| `vite` | ^6.0.5 | Build tool y dev server |
| `@vitejs/plugin-react` | ^4.3.4 | Plugin React para Vite |
| `tailwindcss` | ^3.4.17 | Framework CSS utility-first |
| `postcss` | ^8.4.49 | Procesador CSS |
| `autoprefixer` | ^10.4.20 | Prefijos CSS automáticos |

> **Nota:** No usa react-router, zustand, redux ni librerías de gráficos. Navegación por estado interno con `useState`.

---

## Configuración personalizada

### tailwind.config.js

Fuentes y colores personalizados para la estética Cóndor:

```js
theme: {
  extend: {
    fontFamily: {
      sans: ['Inter', 'sans-serif'],
      mono: ['JetBrains Mono', 'Fira Code', 'monospace'],
    },
    colors: {
      'condor-bg':      '#0a0e17',
      'condor-panel':   '#070b12',
      'condor-green':   '#00ff88',
      'condor-cyan':    '#00d4ff',
    }
  }
}
```

### vite.config.js

- Puerto fijo: `5173`
- Sin sourcemaps en producción
- `chunkSizeWarningLimit: 1000` (para JSONs grandes de condor-cli)
- Alias `@` → `/src`

---

## Autor

**Alexander Villarroel Torrico**
Estudiante de Ingeniería Informática — UMSA, La Paz, Bolivia
[![GitHub](https://img.shields.io/badge/GitHub-villaalextor-181717?style=flat-square&logo=github)](https://github.com/villaalextor)

---

*Parte del [Cóndor Framework](../README.md) — Pipeline de reconocimiento pasivo OSINT*
