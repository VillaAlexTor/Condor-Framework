FROM node:20-slim

# Dependencias del sistema para Puppeteer/Chromium
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-ipafont-gothic \
    fonts-wqy-zenhei \
    fonts-thai-tlwg \
    fonts-khmeros \
    fonts-kacst \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Decirle a Puppeteer que use el Chromium del sistema
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

RUN mkdir -p output

EXPOSE 3001

CMD ["npm", "run", "dev"]
