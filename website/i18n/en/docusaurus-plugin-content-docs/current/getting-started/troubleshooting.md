---
sidebar_position: 4
title: Troubleshooting & FAQ
description: Common 3DPrintForge setup problems and how to fix them
---

# Troubleshooting & FAQ

The short version of the most common setup snags. For print quality problems
(adhesion, warping, stringing) see
[Troubleshooting in the knowledge base](/docs/kb/troubleshooting/adhesion) instead.

## The server won't start

### `SqliteError` or `DatabaseSync is not a constructor`

3DPrintForge uses the SQLite implementation built into Node.js 22. Older Node
versions don't have it.

```bash
node -v      # must be v22.0.0 or newer
```

If the version is too old, install Node 22 LTS (or newer) and start again.

### `EADDRINUSE` — port already in use

Something else is already listening on 3000 or 3443. Either stop it, or move
3DPrintForge:

```bash
SERVER_PORT=3100 npm start
```

Permanently: set `server.port` and `server.httpsPort` in `config.json`.

If you already run an instance as a systemd service, that is usually the culprit:

```bash
systemctl --user status 3dprintforge
```

### `config.json` is missing

```bash
cp config.example.json config.json
```

Then run `npm run setup` to fill it in through the browser setup wizard.

## The browser warns about the certificate

On first start the server generates a self-signed certificate in `certs/`. No
public certificate authority signed it, so the browser warns you. That is
expected on a home network — click "Advanced" and continue.

To get rid of the warning for good: put 3DPrintForge behind a reverse proxy
(Caddy, nginx, Traefik) with a Let's Encrypt certificate, or mount your own
certificate as `certs/cert.pem` + `certs/key.pem`.

If `openssl` is missing on the machine the server cannot generate the
certificate and you only get HTTP. Install `openssl` and restart.

## The printer won't connect

### Bambu Lab (MQTT)

1. **LAN mode must be on** — on the printer: Settings → Network → LAN Only Mode / Developer Mode.
2. **Check IP, serial and access code.** The access code is under Settings → WLAN on the printer's screen, and changes if you reset the network.
3. **Same network.** The printer and the server must reach each other: `ping <printer-ip>`.
4. **Port 8883 must be open** outbound to the printer (MQTT over TLS).

```bash
ping 192.168.1.50
nc -vz 192.168.1.50 8883
```

### Klipper / Moonraker (Snapmaker, Voron, Creality K1, QIDI …)

Check that Moonraker answers, and that the 3DPrintForge host is listed in
`cors_domains` / `trusted_clients` in `moonraker.conf`:

```bash
curl http://<printer-ip>:7125/printer/info
```

### PrusaLink and OctoPrint

Both need an API key. OctoPrint: Settings → API → Global API Key.
PrusaLink: username/password from the printer's screen.

## The camera doesn't work

The camera stream is transcoded with `ffmpeg`. Without `ffmpeg` on the server the
picture stays black.

```bash
ffmpeg -version        # must print a version number
# Debian/Ubuntu: sudo apt install ffmpeg
# Arch:          sudo pacman -S ffmpeg
# macOS:         brew install ffmpeg
```

Also check that the camera is enabled on the printer and that port 322 (RTSPS)
is open outbound. Each printer gets its own WebSocket port from 9001 upwards —
behind a proxy those have to be allowed through as well.

## Docker: printer not found

The container must run with `network_mode: host` to reach the printer over MQTT
(8883) and the camera (322). It is already set in `docker-compose.yml` — remove
it and the container loses access to the local network. See
[Docker Setup](/docs/advanced/docker).

## The dashboard is blank after an update

The service worker is serving the previous version from cache. Hard-reload with
`Ctrl+Shift+R` (`Cmd+Shift+R` on macOS), or clear site data for the domain.

## Where do data and configuration live?

| What | Path |
|------|------|
| Configuration | `config.json` in the root folder |
| Database | `data/dashboard.db` (SQLite) |
| Uploads and library | `data/uploads/`, `data/library/` |
| Backups | `data/backups/` |
| SSL certificates | `certs/` |

The simplest backup is to stop the server and copy `config.json` plus the whole
`data/` folder. Built-in backups live under Settings → System → Backup, see
[Backup](/docs/system/backup).

## How do I test without a printer?

Demo mode starts three simulated printers with live print cycles:

```bash
npm run demo
```

No hardware, no network access to printers — good for exploring the UI, taking
screenshots or debugging the frontend.

## Logs

```bash
# systemd service
journalctl --user -u 3dprintforge --since "10 minutes ago"

# Docker
docker compose logs -f

# In the foreground with more detail
LOG_LEVEL=debug npm start
```

If you still can't work it out, [open an issue on GitHub](https://github.com/skynett81/3dprintforge/issues)
with your Node version, operating system, printer model and the relevant log lines.
