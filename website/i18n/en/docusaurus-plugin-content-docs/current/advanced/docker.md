---
sidebar_position: 3
title: Docker Setup
description: Run 3DPrintForge with Docker and docker-compose
---

# Docker Setup

3DPrintForge includes a `Dockerfile` and `docker-compose.yml` for easy containerization.

## Quick start

Requirements: Docker Engine 20.10+ and Docker Compose v2 (`docker compose version`).

```bash
git clone https://github.com/skynett81/3dprintforge.git
cd 3dprintforge
cp config.example.json config.json   # edit it with your printer
docker compose up -d --build
```

The first build takes a few minutes (Node image + `npm ci`). After that:

```bash
docker compose logs -f       # follow the startup
docker compose ps            # status and health check
docker compose down          # stop the stack
```

Open `https://localhost:3443` in the browser (HTTP on port 3000 redirects there).
The certificate is self-signed on first run, so the browser warns you — that is expected.

:::tip Try it without a printer
Set `BAMBU_DEMO=true` under `environment:` in `docker-compose.yml` to start with
three simulated printers. You can click through the whole UI without hardware.
:::

:::warning config.json must exist before the first start
`docker-compose.yml` mounts `./config.json` as a file. If it does not exist,
Docker creates a *directory* with that name and the server refuses to start.
Copy `config.example.json` first.
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
`network_mode: host` is recommended so the container can reach the printer on the local network via MQTT. Without this, the MQTT connection may fail depending on the network configuration.
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

## Volumes

| Host path | Container path | Contents |
|-----------|---------------|---------|
| `./config.json` | `/app/config.json` | Printers, ports and server settings |
| `./data` | `/app/data` | SQLite database (`dashboard.db`), uploads, library, backups |
| `./certs` | `/app/certs` | SSL certificates (generated automatically if the folder is empty) |

:::tip Persistent data
Always mount the `./data` volume. Without this, all data will be lost when the container restarts.
:::

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `production` | Environment |
| `PORT` / `SERVER_PORT` | `3000` | HTTP port (overrides `server.port` in `config.json`) |
| `LOG_LEVEL` | `info` | Log level (`debug`, `info`, `warn`, `error`) |
| `REQUIRE_AUTH` | `false` | Set to `true` to require sign-in |
| `BAMBU_AUTH_USERNAME` | — | Username when sign-in is enabled |
| `BAMBU_AUTH_PASSWORD` | — | Password when sign-in is enabled |
| `BAMBU_DEMO` | `false` | Start with simulated printers |

The HTTPS port is set with `server.httpsPort` in `config.json` (default 3443).

## SSL certificates in Docker

### Self-generated (default)
No configuration needed. The certificate is generated on first start and stored
in the mounted `./certs` volume.

### Custom certificate
```yaml
volumes:
  - ./my-cert.pem:/app/certs/cert.pem:ro
  - ./my-key.pem:/app/certs/key.pem:ro
```

## Administration

```bash
# Start
docker compose up -d

# Stop
docker compose down

# Logs
docker compose logs -f

# Update to a new version (the image is built locally, so `git pull` fetches the code)
git pull
docker compose up -d --build

# Back up the database
cp data/dashboard.db backup-$(date +%Y%m%d).db
```

:::note `docker compose pull` does nothing here
`docker-compose.yml` uses `build: .` — there is no prebuilt image to pull.
Update with `git pull` followed by `docker compose up -d --build`.
:::

## Health status

```bash
docker inspect --format='{{.State.Health.Status}}' 3dprintforge
```

The container reports `healthy` when the server is up and responding to `/api/health`.
