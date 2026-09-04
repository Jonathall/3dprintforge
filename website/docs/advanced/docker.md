---
sidebar_position: 3
title: Docker-oppsett
description: Kjør 3DPrintForge med Docker og docker-compose
---

# Docker-oppsett

3DPrintForge inkluderer en `Dockerfile` og `docker-compose.yml` for enkel containerisering.

## Hurtigstart

Krav: Docker Engine 20.10+ og Docker Compose v2 (`docker compose version`).

```bash
git clone https://github.com/skynett81/3dprintforge.git
cd 3dprintforge
cp config.example.json config.json   # rediger med printeren din
docker compose up -d --build
```

Første bygg tar noen minutter (Node-image + `npm ci`). Deretter:

```bash
docker compose logs -f       # følg oppstarten
docker compose ps            # status og helsesjekk
docker compose down          # stopp stacken
```

Åpne `https://localhost:3443` i nettleseren (HTTP på port 3000 videresender dit).
Sertifikatet er selvsignert første gang, så nettleseren advarer — det er forventet.

:::tip Prøv uten printer
Sett `BAMBU_DEMO=true` under `environment:` i `docker-compose.yml` for å starte
med tre simulerte printere. Da kan du klikke gjennom hele grensesnittet uten
maskinvare.
:::

:::warning config.json må finnes før første start
`docker-compose.yml` monterer `./config.json` som en fil. Finnes den ikke,
lager Docker en *mappe* med det navnet og serveren nekter å starte. Kopier
`config.example.json` først.
:::

## docker-compose.yml

```yaml
services:
  3dprintforge:
    build: .
    container_name: 3dprintforge
    network_mode: host
    restart: unless-stopped
    volumes:
      - ./config.json:/app/config.json
      - ./data:/app/data
      - ./certs:/app/certs
    environment:
      - NODE_ENV=production
```

:::warning network_mode: host
`network_mode: host` er anbefalt for at containeren skal nå printeren på lokalt nettverk via MQTT. Uten dette kan MQTT-tilkoblingen feile avhengig av nettverkskonfigurasjonen.
:::

## Dockerfile

```dockerfile
FROM node:22-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg openssl && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

RUN mkdir -p data data/uploads data/library data/model-cache data/history-models data/toolpath-cache certs

EXPOSE 3000 3443 9001-9010

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:3000/api/health').then(r=>{if(!r.ok&&r.status!==301)throw new Error();process.exit(0)}).catch(()=>process.exit(1))"

CMD ["node", "server/index.js"]
```

## Volumer

| Verts-sti | Container-sti | Innhold |
|-----------|---------------|---------|
| `./config.json` | `/app/config.json` | Printere, porter og serverinnstillinger |
| `./data` | `/app/data` | SQLite-database (`dashboard.db`), opplastinger, bibliotek, sikkerhetskopier |
| `./certs` | `/app/certs` | SSL-sertifikater (genereres automatisk hvis mappen er tom) |

:::tip Persistent data
Monter alltid `./data`-volumet. Uten dette vil all data gå tapt når containeren restarter.
:::

## Miljøvariabler

| Variabel | Standard | Beskrivelse |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Miljø |
| `PORT` / `SERVER_PORT` | `3000` | HTTP-port (overstyrer `server.port` i `config.json`) |
| `LOG_LEVEL` | `info` | Loggnivå (`debug`, `info`, `warn`, `error`) |
| `REQUIRE_AUTH` | `false` | Sett `true` for å kreve innlogging |
| `BAMBU_AUTH_USERNAME` | — | Brukernavn når innlogging er på |
| `BAMBU_AUTH_PASSWORD` | — | Passord når innlogging er på |
| `BAMBU_DEMO` | `false` | Start med simulerte printere |

HTTPS-porten settes med `server.httpsPort` i `config.json` (standard 3443).

## SSL-sertifikater i Docker

### Selvgenerert (standard)
Ingen konfigurasjon nødvendig. Sertifikatet genereres automatisk ved første
oppstart og lagres i det monterte `./certs`-volumet.

### Eget sertifikat
```yaml
volumes:
  - ./mitt-cert.pem:/app/certs/cert.pem:ro
  - ./min-nøkkel.pem:/app/certs/key.pem:ro
```

## Administrasjon

```bash
# Start
docker compose up -d

# Stopp
docker compose down

# Logg
docker compose logs -f

# Oppdater til ny versjon (imaget bygges lokalt, så det er `git pull` som henter koden)
git pull
docker compose up -d --build

# Sikkerhetskopi av databasen
cp data/dashboard.db backup-$(date +%Y%m%d).db
```

:::note `docker compose pull` gjør ingenting her
`docker-compose.yml` bruker `build: .` — det finnes ikke noe ferdigbygd image
å hente. Oppdater med `git pull` etterfulgt av `docker compose up -d --build`.
:::

## Helsestatus

```bash
docker inspect --format='{{.State.Health.Status}}' 3dprintforge
```

Containeren rapporterer `healthy` når serveren er oppe og svarer på `/api/health`.
