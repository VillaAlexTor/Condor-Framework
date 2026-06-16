Es un libro que nos ayuda a entender el funcionamiento completo de lo que es el sistema, archivo por archivo
╔══════════════════════════════════════════════════════╗
║        Entrypoint principal del CLI de OSINT         ║
║  Uso   : python condor.py --target ejemplo.com       ║
╚══════════════════════════════════════════════════════╝

DESCRIPCIÓN:
  Es el programa principal. Recibe argumentos del usuario,
  ejecuta los módulos de reconocimiento seleccionados,
  agrega los resultados y genera el output (JSON o HTML).

MÓDULOS DISPONIBLES:
  dns     → Registros DNS (A, MX, NS, TXT, CNAME)
  whois   → Información WHOIS del dominio
  crt     → Subdominios via Certificate Transparency (crt.sh)
  censys  → Puertos y servicios via Censys.io API
  shodan  → Banners y tecnologías via Shodan API
  wayback → URLs históricas via Wayback Machine
  hunter  → Emails corporativos via Hunter.io API

USO:
  python condor.py --target ejemplo.com
  python condor.py --target ejemplo.com --modules dns,whois,crt
  python condor.py --target ejemplo.com --format html --output reporte.html
  python condor.py --target ejemplo.com --verbose --log condor.log


╔══════════════════════════════════════════════════════╗
║   CÓNDOR FRAMEWORK — docker-compose.yml (raíz)       ║
╚══════════════════════════════════════════════════════╝

Levanta el dashboard y el report generator juntos.
condor-cli NO se incluye aquí porque es un CLI que se
ejecuta puntualmente (python condor.py --target ...),
no un servicio de larga duración.

USO:
   docker-compose up -d          # Levantar todo
   docker-compose up dashboard   # Solo el dashboard
   docker-compose logs -f report-backend
   docker-compose down

 URLs después de levantar:
   Dashboard:        http://localhost:5173
   Report Frontend:  http://localhost:5174
   Report Backend:   http://localhost:3001

╔══════════════════════════════════════════════════════╗
║      CÓNDOR FRAMEWORK — condor-cli/.env.example      ║
╚══════════════════════════════════════════════════════╝

INSTRUCCIONES:
  1. Copiar este archivo: cp .env.example .env#
  2. Completar los valores reales en .env
  3. NUNCA subir .env a GitHub — ya está en .gitignore

Los módulos que no tengan API key configurada
retornarán status: "skipped" sin romper el escaneo.#
Los módulos sin API key (dns, whois, wayback, crt)
funcionan sin configuración adicional.
 ────────────────────────────────────────────────────────

╔══════════════════════════════════════════════════════╗
║       CÓNDOR FRAMEWORK — condor-cli/requirements.txt ║
╚══════════════════════════════════════════════════════╝
Instalación:
  pip install -r requirements.txt
Versiones fijadas para reproducibilidad.
  Probado con Python 3.11+