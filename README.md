# minimal-cord

Lightweight temporary voice rooms with optional camera, multiple screen shares, and in-room temporary chat.

No accounts and no database: you pick a display name, create a room, and share
the link. The room disappears as soon as the last participant leaves.

## Requirements

- Node.js 22+
- pnpm 9+

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm build
pnpm dev
```

`pnpm dev` starts the Fastify + mediasoup server on port `3000` and the Vite dev
server on port `5173`. Open <http://localhost:5173>.

The first `pnpm build` is not optional: `@minimal-cord/shared` is consumed from
its `dist/`, which is gitignored, so `pnpm typecheck` and `apps/web` fail on a
fresh clone until the shared package has been built once.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Layout

- `apps/server` — Fastify HTTP/WebSocket server, room state, mediasoup SFU.
- `apps/web` — React + Vite SPA.
- `packages/shared` — protocol types and constants shared by both apps.

## Docs

- Design: `docs/superpowers/specs/2026-08-20-minimal-cord-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-20-minimal-cord.md`
- VPS deploy: `docs/deploy-vps.md`
- Manual verification: `docs/manual-verification.md`
