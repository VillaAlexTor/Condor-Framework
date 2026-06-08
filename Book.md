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