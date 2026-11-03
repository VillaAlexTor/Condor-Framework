# Manual completo de pruebas de Cóndor Framework

Para configurar las credenciales de Censys, Shodan, Hunter y la API interna,
consulta también el [Manual de conexión de APIs](MANUAL-APIS.md).

## 1. Arquitectura

| Componente | Función | URL |
|---|---|---|
| `condor-cli` | Reconocimiento OSINT y generación de JSON/HTML | Sin puerto |
| `condor-dashboard` | Visualización del JSON | http://localhost:5173 |
| `condor-report/frontend` | Edición de fichas y exportación | http://localhost:5174 |
| `condor-report/backend` | API, CVSS y generación PDF | http://localhost:3001 |

Todos los comandos están escritos para Windows PowerShell.

---

## 2. Requisitos

Instala:

- Git.
- Python 3.11 o superior.
- Node.js 20 o superior.
- npm.
- Docker Desktop, opcional pero recomendado.

Comprueba las versiones:

```powershell
git --version
node --version
npm --version
py --version
docker --version
docker compose version
```

---

## 3. Obtener el proyecto

Para clonar:

```powershell
cd D:\Informatica\GIT
git clone https://github.com/VillaAlexTor/Condor-Framework.git
cd .\Condor-Framework
```

Para actualizar una copia existente:

```powershell
cd D:\Informatica\GIT\Cóndor-Framework
git pull origin main
git status
```

---

## 4. Configurar y probar el CLI

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-cli
py -3.11 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
```

Verifica el CLI:

```powershell
python .\condor.py --help
python .\condor.py --version
python .\condor.py --list-modules
```

### API keys opcionales

```powershell
Copy-Item .\.env.example .\.env
notepad .\.env
```

Configura solo las claves necesarias:

```env
CENSYS_API_ID=tu_api_id
CENSYS_API_SECRET=tu_api_secret
SHODAN_API_KEY=tu_shodan_key
HUNTER_API_KEY=tu_hunter_key
```

Los módulos `dns`, `whois`, `crt` y `wayback` no necesitan claves.

### Generar un JSON

Usa únicamente dominios propios o autorizados:

```powershell
python .\condor.py `
  --target ejemplo.com `
  --format json `
  --output .\reporte.json
```

Ejecutar módulos concretos:

```powershell
python .\condor.py `
  --target ejemplo.com `
  --modules dns,whois,crt `
  --format json `
  --output .\reporte-basico.json
```

Ejecutar todos los módulos:

```powershell
python .\condor.py `
  --target ejemplo.com `
  --all-modules `
  --format json `
  --output .\reporte-completo.json
```

Comprueba el archivo:

```powershell
Test-Path .\reporte.json
Get-Content .\reporte.json -TotalCount 30
```

### Generar HTML

```powershell
python .\condor.py `
  --target ejemplo.com `
  --format html `
  --output .\reporte.html

Start-Process .\reporte.html
```

---

## 5. Levantar todo con Docker

Desde la raíz:

```powershell
cd D:\Informatica\GIT\Cóndor-Framework
notepad .\.env
```

Contenido mínimo de `.env`:

```env
REPORT_ADMIN_PASSWORD=Una-contraseña-larga-y-segura
REPORT_API_KEY=Una-clave-para-automatizaciones
```

No uses las claves de ejemplo en entornos reales.

Construye y levanta:

```powershell
docker compose up -d --build
docker compose ps
```

Verifica el backend:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Abre:

- Dashboard: http://localhost:5173
- Report Generator: http://localhost:5174
- Health check: http://localhost:3001/api/health

Logs:

```powershell
docker compose logs -f report-backend
docker compose logs -f report-frontend
```

---

## 6. Probar autenticación

Una ruta protegida sin sesión debe devolver `401`:

```powershell
try {
  Invoke-RestMethod http://localhost:3001/api/ficha/categories
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Crea una sesión:

```powershell
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$body = @{
  password = "Una-contraseña-larga-y-segura"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:3001/api/auth/login `
  -Method Post `
  -ContentType "application/json" `
  -Body $body `
  -WebSession $session
```

Comprueba la sesión:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3001/api/auth/me `
  -WebSession $session
```

Prueba una ruta protegida con sesión:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3001/api/ficha/categories `
  -WebSession $session
```

Una contraseña incorrecta debe devolver `401`.

---

## 7. Probar CVSS y fichas

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/cvss/calculate?vector=CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" `
  -WebSession $session
```

El score esperado es `9.8`.

Ejecuta el self-test:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3001/api/cvss/self-test `
  -WebSession $session
```

Resultado esperado: `5/5 tests pasados`.

Crear una ficha:

```powershell
$fichaBody = @{
  categoria = "email_spoofing"
  fuente = "manual"
} | ConvertTo-Json

Invoke-RestMethod `
  -Uri http://localhost:3001/api/ficha/new `
  -Method Post `
  -ContentType "application/json" `
  -Body $fichaBody `
  -WebSession $session
```

---

## 8. Flujo completo CLI → Report Generator

1. Genera un JSON con el CLI:

   ```powershell
   cd D:\Informatica\GIT\Cóndor-Framework\condor-cli
   python .\condor.py --target ejemplo.com --format json --output .\reporte.json
   ```

2. Abre http://localhost:5174.
3. Inicia sesión con `REPORT_ADMIN_PASSWORD`.
4. Selecciona `reporte.json`.
5. Comprueba las fichas y sus scores CVSS.
6. Edita título, descripción, evidencia, impacto y metadata.
7. Crea una ficha manual.
8. Duplica y elimina una ficha.
9. Pulsa **Generar PDF**.
10. Descarga el PDF generado.
11. Comprueba que aparece en reportes anteriores.
12. Descarga nuevamente el reporte anterior.

---

## 9. Probar el dashboard React

Abre http://localhost:5173 y carga el mismo JSON.

Comprueba:

- Resumen general.
- DNS.
- WHOIS.
- crt.sh.
- Wayback.
- Censys.
- Shodan.
- Hunter.
- Cambio entre reportes.
- Estados vacíos.
- Mensajes de error.

Prueba un JSON inválido:

```powershell
Set-Content .\invalido.json '{ "esto": "no es un reporte válido" }'
```

El dashboard debe mostrar un error controlado sin romperse.

---

## 10. Probar generación y descarga PDF por API

Con `$session` creada:

```powershell
$payload = @{
  meta = @{
    titulo = "Informe de prueba"
    target = "ejemplo.com"
    analista = "Analista de pruebas"
    clasificacion = "INTERNO"
    fecha = "2026-11-03"
    version = "1.0"
  }
  fichas = @(
    @{
      id = "TEST-001"
      titulo = "Hallazgo de prueba"
      fuente = "manual"
      categoria = "api_expuesta"
      descripcion = "Descripción de prueba"
      evidencia = "Evidencia de prueba"
      impacto = "Impacto de prueba"
      cvss = @{
        score = 5.4
        severity = "MEDIO"
      }
    }
  )
  formato = "pdf"
} | ConvertTo-Json -Depth 10

$result = Invoke-RestMethod `
  -Uri http://localhost:3001/api/report/generate `
  -Method Post `
  -ContentType "application/json" `
  -Body $payload `
  -WebSession $session

$result
```

Lista reportes:

```powershell
Invoke-RestMethod `
  -Uri http://localhost:3001/api/report/list `
  -WebSession $session
```

Descarga:

```powershell
$filename = $result.filename
Invoke-WebRequest `
  -Uri "http://localhost:3001/api/report/download/$filename" `
  -WebSession $session `
  -OutFile ".\informe-descargado.pdf"
```

Elimina el reporte de prueba:

```powershell
Invoke-RestMethod `
  -Uri "http://localhost:3001/api/report/$filename" `
  -Method Delete `
  -WebSession $session
```

---

## 11. Probar seguridad y límites

### Path traversal

```powershell
try {
  Invoke-RestMethod `
    -Uri "http://localhost:3001/api/report/download/../package.json" `
    -WebSession $session
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Debe rechazar la ruta o devolver `404`.

### Cabeceras de seguridad

```powershell
curl.exe -I http://localhost:3001/api/health
```

Busca:

- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`
- `Content-Security-Policy`

### API key fuera del bundle frontend

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-report\frontend
npm run build
Select-String `
  -Path .\dist\assets\*.js `
  -Pattern "VITE_REPORT_API_KEY|REPORT_API_KEY|X-API-Key"
```

No debe aparecer una clave privilegiada.

### Límite de fichas

```powershell
$fichas = 1..101 | ForEach-Object {
  @{
    id = "TEST-$($_)"
    titulo = "Ficha de prueba"
    categoria = "test"
  }
}

$body = @{ fichas = $fichas } | ConvertTo-Json -Depth 10

try {
  Invoke-RestMethod `
    -Uri http://localhost:3001/api/ficha/enrich-all `
    -Method Post `
    -ContentType "application/json" `
    -Body $body `
    -WebSession $session
} catch {
  $_.Exception.Response.StatusCode.value__
}
```

Debe devolver `413`.

### Rate limiting

```powershell
1..35 | ForEach-Object {
  try {
    $response = Invoke-WebRequest `
      -Uri http://localhost:3001/api/ficha/categories `
      -WebSession $session `
      -UseBasicParsing
    "$_ -> $($response.StatusCode)"
  } catch {
    "$_ -> $($_.Exception.Response.StatusCode.value__)"
  }
}
```

Con `RATE_LIMIT_MAX=30`, debe aparecer `429`.

---

## 12. Pruebas automáticas

### Backend CVSS

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-report\backend
npm run test:cvss
```

### Sintaxis backend

Desde la raíz:

```powershell
node --check .\condor-report\backend\src\server.js
node --check .\condor-report\backend\src\auth.js
node --check .\condor-report\backend\src\routes\auth.js
node --check .\condor-report\backend\src\routes\report.js
node --check .\condor-report\backend\src\routes\ficha.js
```

### Builds

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-report\frontend
npm run build

cd D:\Informatica\GIT\Cóndor-Framework\condor-dashboard
npm run build
```

### Docker Compose

```powershell
cd D:\Informatica\GIT\Cóndor-Framework
docker compose config
```

---

## 13. Ejecución sin Docker

### Terminal 1: backend

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-report\backend
npm install
Copy-Item .\.env.example .\.env
notepad .\.env
npm run dev
```

Configura al menos:

```env
REPORT_ADMIN_PASSWORD=Una-contraseña-larga-y-segura
```

### Terminal 2: frontend Vue

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-report\frontend
npm install
npm run dev
```

Abre http://localhost:5174.

### Terminal 3: dashboard React

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-dashboard
npm install
npm run dev
```

Abre http://localhost:5173.

Detén cada proceso con `Ctrl + C`.

---

## 14. Solución de problemas

### Puerto ocupado

```powershell
Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
```

Para ejecutar temporalmente en otro puerto:

```powershell
$env:PORT=3301
npm run start
```

### API offline

```powershell
Invoke-RestMethod http://localhost:3001/api/health
docker compose logs report-backend
```

### Login devuelve 503

Configura `REPORT_ADMIN_PASSWORD` y reinicia:

```powershell
docker compose up -d --build report-backend report-frontend
```

### Puppeteer no genera PDF

```powershell
docker compose logs report-backend
docker compose exec report-backend chromium --version
```

### No aparecen reportes anteriores

Los reportes nuevos pertenecen a la sesión que los creó. Los PDFs antiguos
pueden no tener un archivo `.meta.json` asociado.

### Python no se reconoce

Instala Python 3.11+ y crea nuevamente el entorno:

```powershell
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
```

---

## 15. Detener Docker

```powershell
docker compose down
```

Para eliminar también los volúmenes:

```powershell
docker compose down -v
```

> `docker compose down -v` elimina el volumen donde se almacenan los PDFs.

---

## 16. Checklist final

- [ ] `docker compose ps` muestra los tres servicios.
- [ ] `/api/health` responde `ok`.
- [ ] El login funciona.
- [ ] Una ruta protegida sin sesión devuelve `401`.
- [ ] El CLI genera JSON.
- [ ] El CLI genera HTML.
- [ ] React carga el JSON.
- [ ] Vue importa el JSON.
- [ ] Las fichas pueden editarse.
- [ ] Las fichas pueden crearse y eliminarse.
- [ ] El PDF se genera.
- [ ] El PDF se descarga.
- [ ] El reporte aparece en la lista.
- [ ] El self-test CVSS devuelve `5/5`.
- [ ] El límite de fichas devuelve `413`.
- [ ] El rate limit devuelve `429`.
- [ ] Las cabeceras de seguridad aparecen.
- [ ] No hay API key privilegiada en el bundle frontend.
- [ ] Ambos builds terminan correctamente.
- [ ] `docker compose config` termina correctamente.
- [ ] No hay errores críticos en los logs.
