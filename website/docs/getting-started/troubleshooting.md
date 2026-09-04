---
sidebar_position: 4
title: Feilsøking og FAQ
description: Vanlige problemer ved oppsett av 3DPrintForge, og hvordan du løser dem
---

# Feilsøking og FAQ

Kortversjonen av de vanligste snublesteinene ved oppsett. Gjelder det utskriftskvalitet
(vedheft, warping, stringing) er det [Feilsøking i kunnskapsbasen](/docs/kb/troubleshooting/adhesion)
du vil ha i stedet.

## Serveren starter ikke

### `SqliteError` eller `DatabaseSync is not a constructor`

3DPrintForge bruker SQLite som er innebygd i Node.js 22. Eldre Node-versjoner har
det ikke.

```bash
node -v      # må være v22.0.0 eller nyere
```

Er versjonen for gammel, installer Node 22 LTS (eller nyere) og start på nytt.

### `EADDRINUSE` — porten er opptatt

Noe annet lytter allerede på 3000 eller 3443. Enten stopper du det, eller så
flytter du 3DPrintForge:

```bash
SERVER_PORT=3100 npm start
```

Permanent: sett `server.port` og `server.httpsPort` i `config.json`.

Kjører du allerede en instans som systemd-tjeneste, er det som regel den:

```bash
systemctl --user status 3dprintforge
```

### `config.json` mangler

```bash
cp config.example.json config.json
```

Kjør deretter `npm run setup` for å fylle den ut via oppsettsveiviseren i nettleseren.

## Nettleseren advarer om sertifikatet

Ved første oppstart lager serveren et selvsignert sertifikat i `certs/`. Ingen
offentlig sertifikatmyndighet har signert det, så nettleseren advarer. Det er
forventet på et hjemmenettverk — klikk «Avansert» og fortsett.

Vil du bli kvitt advarselen for godt: legg 3DPrintForge bak en omvendt
proxy (Caddy, nginx, Traefik) med et Let's Encrypt-sertifikat, eller monter ditt
eget sertifikat som `certs/cert.pem` + `certs/key.pem`.

Mangler `openssl` på maskinen, klarer ikke serveren å lage sertifikatet, og du
får bare HTTP. Installer `openssl` og start på nytt.

## Printeren kobler ikke til

### Bambu Lab (MQTT)

1. **LAN-modus må være på** — på printeren: Innstillinger → Nettverk → LAN Only Mode / Developer Mode.
2. **Sjekk IP, serienummer og tilgangskode.** Tilgangskoden står under Innstillinger → WLAN på printerens skjerm, og endrer seg hvis du nullstiller nettverket.
3. **Samme nettverk.** Printeren og serveren må nå hverandre: `ping <printer-ip>`.
4. **Port 8883 må være åpen** utgående mot printeren (MQTT over TLS).

```bash
ping 192.168.1.50
nc -vz 192.168.1.50 8883
```

### Klipper / Moonraker (Snapmaker, Voron, Creality K1, QIDI …)

Sjekk at Moonraker svarer, og at 3DPrintForge sin IP står i `cors_domains` /
`trusted_clients` i `moonraker.conf`:

```bash
curl http://<printer-ip>:7125/printer/info
```

### PrusaLink og OctoPrint

Begge trenger API-nøkkel. OctoPrint: Innstillinger → API → Global API Key.
PrusaLink: brukernavn/passord fra printerens skjerm.

## Kameraet virker ikke

Kamerastrømmen transkodes med `ffmpeg`. Uten `ffmpeg` på serveren blir bildet svart.

```bash
ffmpeg -version        # må gi et versjonsnummer
# Debian/Ubuntu: sudo apt install ffmpeg
# Arch:          sudo pacman -S ffmpeg
# macOS:         brew install ffmpeg
```

Sjekk også at kameraet er slått på i printeren, og at port 322 (RTSPS) er åpen
utgående. Hver printer får sin egen WebSocket-port fra 9001 og oppover — kjører
du bak en proxy må disse også slippes gjennom.

## Docker: printeren finnes ikke

Containeren må kjøre med `network_mode: host` for å nå printeren via MQTT (8883)
og kamera (322). Det ligger allerede i `docker-compose.yml` — fjerner du det,
mister containeren tilgangen til det lokale nettverket. Se
[Docker-oppsett](/docs/advanced/docker).

## Kontrollpanelet er blankt etter oppdatering

Servicearbeideren serverer forrige versjon fra cache. Hardt omlast med
`Ctrl+Shift+R` (`Cmd+Shift+R` på macOS), eller tøm nettstedsdata for domenet.

## Hvor ligger data og konfigurasjon?

| Hva | Sti |
|-----|-----|
| Konfigurasjon | `config.json` i rotmappen |
| Database | `data/dashboard.db` (SQLite) |
| Opplastinger og bibliotek | `data/uploads/`, `data/library/` |
| Sikkerhetskopier | `data/backups/` |
| SSL-sertifikater | `certs/` |

Sikkerhetskopi tar du enklest ved å stoppe serveren og kopiere `config.json` og
hele `data/`-mappen. Innebygd sikkerhetskopiering finner du under
Innstillinger → System → Sikkerhetskopi, se [Sikkerhetskopiering](/docs/system/backup).

## Hvordan tester jeg uten printer?

Demomodus starter tre simulerte printere med levende utskriftssykluser:

```bash
npm run demo
```

Ingen maskinvare, ingen nettverkstilgang til printere — greit for å se
grensesnittet, ta skjermbilder eller feilsøke UI-en.

## Logger

```bash
# systemd-tjeneste
journalctl --user -u 3dprintforge --since "10 minutes ago"

# Docker
docker compose logs -f

# I forgrunnen med mer detaljer
LOG_LEVEL=debug npm start
```

Får du fortsatt ikke has på det, [opprett en sak på GitHub](https://github.com/skynett81/3dprintforge/issues)
med Node-versjon, operativsystem, printermodell og de relevante loggelinjene.
