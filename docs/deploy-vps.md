# VPS Deploy

## Runtime

- Node.js 22+
- pnpm 9+
- PM2 or systemd
- Nginx or Caddy for HTTPS/WSS

## Environment

Copy `.env.example` to `.env` and set:

```dotenv
HOST=127.0.0.1
PORT=3000
PUBLIC_BASE_URL=https://your-domain.example
MAX_PARTICIPANTS_PER_ROOM=20
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=<public-vps-ip>
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
```

`MEDIASOUP_ANNOUNCED_IP` must be the address remote browsers can reach. Leaving
it at `127.0.0.1` makes ICE fail for everyone outside the VPS.

Open UDP **and** TCP ports `40000-49999` for mediasoup media, plus `80`/`443`
for the reverse proxy:

```bash
sudo ufw allow 443/tcp
sudo ufw allow 40000:49999/udp
sudo ufw allow 40000:49999/tcp
```

## Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

`pnpm build` builds `packages/shared` first, then the server and the web app.
`@minimal-cord/shared` resolves to its `dist/`, which is gitignored, so on a
fresh clone always run `pnpm build` before `pnpm typecheck`.

Build outputs:

- `apps/server/dist/index.js` — the Fastify + mediasoup process.
- `apps/web/dist/` — static files for the SPA.

## PM2

```bash
pm2 start apps/server/dist/index.js --name minimal-cord --node-args="--env-file=.env"
pm2 save
pm2 startup
```

## Reverse proxy

The Node process serves only `/health` and `/ws`. The reverse proxy serves the
built SPA and forwards the WebSocket upgrade.

```nginx
server {
  listen 443 ssl;
  server_name your-domain.example;

  # TLS certificates (certbot, for example).
  ssl_certificate     /etc/letsencrypt/live/your-domain.example/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/your-domain.example/privkey.pem;

  root /srv/minimal-cord/apps/web/dist;
  index index.html;

  # Room links are client-side routes: /r/<roomId> must return index.html.
  location / {
    try_files $uri $uri/ /index.html;
  }

  location /ws {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_read_timeout 3600s;
  }

  location /health {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
  }
}
```

Two requirements are not optional:

- **HTTPS.** Microphone, camera, and screen sharing only work in a secure
  context outside `localhost`.
- **`try_files ... /index.html`.** Without the SPA fallback, opening a room link
  directly returns 404.

## TURN later

The MVP relies on the VPS public address and public STUN only. If users on
restrictive networks (corporate NAT, symmetric NAT, some mobile carriers) fail
to connect, add Coturn and pass its credentials as `iceServers` when the
frontend creates the mediasoup transports in `apps/web/src/lib/mediaClient.ts`.
