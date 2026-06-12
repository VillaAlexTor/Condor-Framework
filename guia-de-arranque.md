1️⃣ condor-cli (Python)
    cd condor-cli
    pip install -r requirements.txt
    cp .env.example .env
    python condor.py --target umsa.bo --format json --output scan.json

2️⃣ condor-dashboard (React, puerto 5173)
    cd condor-dashboard
    npm install
    npm run dev

3️⃣ condor-report (backend + frontend)
    Backend primero (puerto 3001):
        cd condor-report/backend
        npm install
        npx puppeteer browsers install chrome   # instala Chromium para los PDFs
        npm run dev
    Frontend en otra terminal (puerto 5174):
        cd condor-report/frontend
        npm install
        npm run dev