# minimal-cord

Lightweight temporary voice rooms with optional camera, multiple screen shares, and in-room temporary chat.

## Requirements

- Node.js 22+
- pnpm 9+

## Local setup

```bash
pnpm install
cp .env.example .env
pnpm dev
```

`pnpm dev` is a workspace command. It becomes active once `apps/server` and `apps/web` exist.

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```

These are workspace checks. They validate packages once workspace packages exist.
