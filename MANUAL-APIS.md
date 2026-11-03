# Manual de conexión de APIs de Cóndor Framework

Este manual explica cómo conectar las APIs externas del CLI y cómo configurar
la API interna del generador de reportes.

> Usa estas APIs únicamente sobre dominios propios o con autorización escrita.

---

## 1. APIs disponibles

| API o servicio | Módulo | Credenciales |
|---|---|---|
| DNS público | `dns` | No requiere |
| WHOIS | `whois` | No requiere |
| crt.sh | `crt` | No requiere |
| Wayback Machine | `wayback` | No requiere |
| Censys | `censys` | `CENSYS_API_ID` y `CENSYS_API_SECRET` |
| Shodan | `shodan` | `SHODAN_API_KEY` |
| Hunter.io | `hunter` | `HUNTER_API_KEY` |
| API de reportes | Backend Express | `REPORT_ADMIN_PASSWORD` o `REPORT_API_KEY` |

Las APIs públicas funcionan sin claves, aunque pueden aplicar límites propios.

---

## 2. Preparar el CLI

Desde PowerShell:

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-cli

py -3.11 -m venv .venv
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\.venv\Scripts\Activate.ps1

python -m pip install --upgrade pip
pip install -r requirements.txt
```

Comprueba que el CLI funciona:

```powershell
python .\condor.py --help
python .\condor.py --list-modules
```

---

## 3. Crear el archivo de credenciales

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-cli
Copy-Item .\.env.example .\.env
notepad .\.env
```

El archivo debe tener este formato:

```env
CENSYS_API_ID=
CENSYS_API_SECRET=
SHODAN_API_KEY=
HUNTER_API_KEY=
```

No agregues comillas salvo que una clave las necesite literalmente.

No subas este archivo a Git:

```powershell
git status --short
```

El archivo `.env` debe estar ignorado y nunca debe publicarse.

---

## 4. Conectar Censys

### 4.1 Crear la cuenta

1. Abre https://accounts.censys.io/register.
2. Crea o confirma tu cuenta.
3. Entra a https://search.censys.io/account/api.
4. Genera o copia:
   - API ID.
   - API Secret.

### 4.2 Configurar las variables

En `condor-cli/.env`:

```env
CENSYS_API_ID=tu_api_id
CENSYS_API_SECRET=tu_api_secret
```

Censys usa autenticación HTTP Basic con ambas credenciales.

### 4.3 Probar Censys desde el CLI

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-cli
.\.venv\Scripts\Activate.ps1

python .\condor.py `
  --target ejemplo.com `
  --modules censys `
  --format json `
  --output .\test-censys.json
```

Resultado esperado:

- El módulo termina con estado correcto, o
- Devuelve un error explícito de API si la clave es inválida o se alcanzó el límite.

Errores comunes:

| Error | Causa |
|---|---|
| `401 Unauthorized` | API ID o Secret incorrectos |
| `429` | Límite de consultas alcanzado |
| Sin resultados | Censys no tiene datos del dominio consultado |

---

## 5. Conectar Shodan

### 5.1 Crear la cuenta

1. Abre https://account.shodan.io/register.
2. Confirma la cuenta.
3. Entra a https://account.shodan.io.
4. Copia la API key.

Para planes académicos consulta:

https://developer.shodan.io/api/requirements

### 5.2 Configurar la variable

En `condor-cli/.env`:

```env
SHODAN_API_KEY=tu_api_key_de_shodan
```

El módulo usa:

- Resolución DNS de Shodan.
- Búsqueda por hostname.
- Detalle de hosts e IPs.

La API de Shodan recibe la clave como parámetro `key` en sus endpoints.
Evita compartir URLs completas de depuración porque pueden contener la clave.

### 5.3 Probar Shodan

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-cli
.\.venv\Scripts\Activate.ps1

python .\condor.py `
  --target ejemplo.com `
  --modules shodan `
  --format json `
  --output .\test-shodan.json
```

Errores comunes:

| Error | Causa |
|---|---|
| `401` | API key inválida |
| `402` | Sin créditos de búsqueda |
| Lista vacía | No hay hosts indexados o el plan no permite la consulta |
| Timeout | Problema de red o API temporalmente no disponible |

---

## 6. Conectar Hunter.io

### 6.1 Crear la cuenta

1. Abre https://hunter.io/users/sign_up.
2. Confirma tu cuenta.
3. Entra a https://hunter.io/api-keys.
4. Genera o copia una API key.

### 6.2 Configurar la variable

En `condor-cli/.env`:

```env
HUNTER_API_KEY=tu_api_key_de_hunter
```

El módulo consulta:

- Conteo de emails indexados.
- Búsqueda de emails por dominio.

La búsqueda de dominio usa autenticación `Bearer`.

### 6.3 Probar Hunter

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-cli
.\.venv\Scripts\Activate.ps1

python .\condor.py `
  --target ejemplo.com `
  --modules hunter `
  --format json `
  --output .\test-hunter.json
```

Errores comunes:

| Error | Causa |
|---|---|
| `401` | API key inválida |
| `403` | Plan sin búsquedas disponibles |
| `429` | Rate limit alcanzado |
| Sin emails | Hunter no tiene resultados para el dominio |

---

## 7. Ejecutar todas las APIs externas

Configura las tres integraciones y ejecuta:

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-cli
.\.venv\Scripts\Activate.ps1

python .\condor.py `
  --target ejemplo.com `
  --all-modules `
  --format json `
  --output .\reporte-completo.json
```

Si alguna API no tiene credenciales, el CLI debe registrar el error de ese
módulo sin impedir necesariamente que los demás módulos terminen.

Para ver más detalles:

```powershell
python .\condor.py `
  --target ejemplo.com `
  --all-modules `
  --verbose `
  --format json `
  --output .\reporte-debug.json
```

No compartas los logs de depuración sin revisar que no contengan información
sensible.

---

## 8. Configurar la API interna de reportes

La API interna es el backend Express de `condor-report`.

### 8.1 Configuración manual

```powershell
cd D:\Informatica\GIT\Cóndor-Framework\condor-report\backend
Copy-Item .\.env.example .\.env
notepad .\.env
```

Configura como mínimo:

```env
PORT=3001
FRONTEND_URL=http://localhost:5174
OUTPUT_DIR=./output
PDF_TIMEOUT=30000
REPORT_ADMIN_PASSWORD=Una-contraseña-larga-y-segura
RATE_LIMIT_MAX=30
```

`REPORT_API_KEY` es opcional y debe reservarse para automatizaciones:

```env
REPORT_API_KEY=Una-clave-larga-para-automatizaciones
```

La interfaz web usa `REPORT_ADMIN_PASSWORD` para crear una sesión mediante
cookie `HttpOnly`. La contraseña no se envía al bundle JavaScript.

### 8.2 Iniciar el backend

```powershell
npm install
npm run dev
```

Comprueba:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

### 8.3 Probar login por PowerShell

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

Invoke-RestMethod `
  -Uri http://localhost:3001/api/auth/me `
  -WebSession $session
```

### 8.4 Usar la API key para automatización

Si configuraste `REPORT_API_KEY`, puedes hacer requests de servicio:

```powershell
$headers = @{
  "X-API-Key" = "Una-clave-larga-para-automatizaciones"
}

Invoke-RestMethod `
  -Uri http://localhost:3001/api/ficha/categories `
  -Headers $headers
```

No uses esta clave en el frontend ni la incluyas en variables `VITE_*`.

---

## 9. Configuración con Docker

Desde la raíz:

```powershell
cd D:\Informatica\GIT\Cóndor-Framework
notepad .\.env
```

Contenido:

```env
REPORT_ADMIN_PASSWORD=Una-contraseña-larga-y-segura
REPORT_API_KEY=Una-clave-larga-para-automatizaciones
```

Las claves del CLI no se configuran en el `.env` raíz automáticamente.
Configúralas en `condor-cli/.env` o pásalas al entorno donde ejecutes el CLI.

Levanta el stack:

```powershell
docker compose up -d --build
docker compose ps
```

Verifica el backend:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Ver logs:

```powershell
docker compose logs -f report-backend
```

---

## 10. Flujo recomendado de conexión y uso

1. Configura primero las APIs públicas: DNS, WHOIS, crt.sh y Wayback.
2. Ejecuta un reporte básico:

   ```powershell
   python .\condor.py --target ejemplo.com --format json --output .\basico.json
   ```

3. Configura Censys, Shodan y Hunter una por una.
4. Prueba cada módulo individualmente.
5. Ejecuta `--all-modules`.
6. Carga el JSON en `http://localhost:5173`.
7. Inicia sesión en `http://localhost:5174`.
8. Importa el mismo JSON en Report Generator.
9. Genera y descarga el PDF.

---

## 11. Solución de problemas

### El módulo dice que falta una API key

Comprueba que `.env` esté en:

```text
condor-cli\.env
```

Y que ejecutes el comando desde el directorio del CLI o que la variable esté
definida en el entorno actual:

```powershell
Get-ChildItem Env:CENSYS_API_ID
Get-ChildItem Env:SHODAN_API_KEY
Get-ChildItem Env:HUNTER_API_KEY
```

### La clave existe pero no se carga

Comprueba espacios o nombres incorrectos:

```powershell
Get-Content .\.env
```

No uses:

```env
SHODAN_KEY=...
```

Debes usar exactamente:

```env
SHODAN_API_KEY=...
```

### La API responde `401`

1. Copia nuevamente la clave desde el proveedor.
2. Elimina espacios al principio o final.
3. Comprueba que la cuenta esté activa.
4. Revisa que la clave corresponda al proveedor correcto.

### La API responde `429`

Se alcanzó el límite del plan o el rate limit temporal. Espera y revisa el
panel de consumo del proveedor.

### El backend responde `503` al iniciar sesión

Configura `REPORT_ADMIN_PASSWORD` y reinicia el backend:

```powershell
docker compose up -d --build report-backend report-frontend
```

### Verificar que no publicaste secretos

```powershell
git status --short
git diff -- .env condor-cli/.env
```

Si una clave fue expuesta, revócala y genera una nueva inmediatamente.

---

## 12. Checklist de conexión

- [ ] `condor-cli/.env` existe localmente.
- [ ] `.env` no aparece como archivo versionado.
- [ ] DNS, WHOIS, crt.sh y Wayback funcionan sin claves.
- [ ] Censys tiene API ID y Secret configurados.
- [ ] Shodan tiene API key configurada.
- [ ] Hunter tiene API key configurada.
- [ ] Cada módulo fue probado individualmente.
- [ ] `--all-modules` genera un JSON.
- [ ] `REPORT_ADMIN_PASSWORD` está configurado.
- [ ] `/api/health` responde correctamente.
- [ ] El login crea una sesión.
- [ ] Las rutas protegidas requieren autenticación.
- [ ] `REPORT_API_KEY` no está en el bundle frontend.
- [ ] No se compartieron claves ni logs sensibles.
