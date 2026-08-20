# Minimal Cord Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `minimal-cord` MVP: a lightweight web app for temporary voice rooms with optional camera, multiple simultaneous screen shares, and temporary room chat.

**Architecture:** Use a TypeScript monorepo with `apps/web`, `apps/server`, and `packages/shared`. The backend owns temporary room state, WebSocket events, and mediasoup SFU routing; the frontend owns local name, room UI, WebRTC device setup, and media controls. State is in memory only; rooms disappear when empty.

**Tech Stack:** pnpm workspaces, TypeScript, React, Vite, Vitest, Testing Library, Fastify, `@fastify/websocket`, mediasoup, mediasoup-client, nanoid, PM2/systemd deployment docs.

---

## Scope and sequencing

This plan intentionally builds the MVP in vertical slices:

1. create repository/workspace skeleton;
2. define shared protocol types;
3. implement server room state;
4. implement WebSocket room/chat/presence;
5. add mediasoup service and signaling;
6. build frontend routing, room state, and UI;
7. connect frontend mediasoup-client;
8. document local run, VPS deploy, and manual verification.

Do not add accounts, persistent database, moderation, recordings, Docker Compose, or mandatory TURN.

## File map

### Repository root

- Create: `package.json` — workspace scripts.
- Create: `pnpm-workspace.yaml` — workspace package discovery.
- Create: `tsconfig.base.json` — shared TypeScript settings.
- Create: `.gitignore` — Node/build/env ignores.
- Create: `.env.example` — documented runtime variables.
- Create: `README.md` — local setup and MVP commands.

### Shared package

- Create: `packages/shared/package.json` — package metadata.
- Create: `packages/shared/tsconfig.json` — shared build config.
- Create: `packages/shared/src/index.ts` — exports.
- Create: `packages/shared/src/constants.ts` — room limits and media constants.
- Create: `packages/shared/src/protocol.ts` — WebSocket event union types.
- Create: `packages/shared/src/models.ts` — participant, room, chat message models.
- Create: `packages/shared/src/protocol.test.ts` — protocol smoke tests.

### Server app

- Create: `apps/server/package.json` — server dependencies/scripts.
- Create: `apps/server/tsconfig.json` — server TS config.
- Create: `apps/server/vitest.config.ts` — server test config.
- Create: `apps/server/src/config.ts` — env parsing.
- Create: `apps/server/src/index.ts` — process entry.
- Create: `apps/server/src/app.ts` — Fastify app factory.
- Create: `apps/server/src/rooms/roomStore.ts` — in-memory room lifecycle.
- Create: `apps/server/src/rooms/roomStore.test.ts` — room lifecycle tests.
- Create: `apps/server/src/ws/socketRegistry.ts` — participant socket tracking.
- Create: `apps/server/src/ws/messages.ts` — message parse/send helpers.
- Create: `apps/server/src/ws/roomSocket.ts` — WebSocket room handler.
- Create: `apps/server/src/ws/roomSocket.test.ts` — WebSocket join/chat/leave tests.
- Create: `apps/server/src/media/mediasoupService.ts` — worker/router/transport/producer/consumer management.
- Create: `apps/server/src/media/mediasoupService.test.ts` — config and cleanup tests with mocks.
- Create: `apps/server/src/media/signaling.ts` — WebSocket signaling event handlers.

### Web app

- Create: `apps/web/package.json` — web dependencies/scripts.
- Create: `apps/web/tsconfig.json` — web TS config.
- Create: `apps/web/tsconfig.node.json` — Vite TS config.
- Create: `apps/web/vite.config.ts` — Vite + React config.
- Create: `apps/web/index.html` — app shell.
- Create: `apps/web/src/main.tsx` — React entry.
- Create: `apps/web/src/App.tsx` — route switch.
- Create: `apps/web/src/styles.css` — MVP styling.
- Create: `apps/web/src/lib/nameStorage.ts` — local display-name storage.
- Create: `apps/web/src/lib/roomLink.ts` — room link/code helpers.
- Create: `apps/web/src/lib/wsClient.ts` — typed WebSocket wrapper.
- Create: `apps/web/src/lib/mediaClient.ts` — mediasoup-client wrapper.
- Create: `apps/web/src/hooks/useRoomConnection.ts` — room state + WebSocket lifecycle.
- Create: `apps/web/src/hooks/useLocalMedia.ts` — mic/camera/screen controls.
- Create: `apps/web/src/pages/HomePage.tsx` — create/join UI.
- Create: `apps/web/src/pages/RoomPage.tsx` — room UI.
- Create: `apps/web/src/components/ParticipantList.tsx` — presence panel.
- Create: `apps/web/src/components/MediaControls.tsx` — mic/camera/screen buttons.
- Create: `apps/web/src/components/MediaGrid.tsx` — camera/screen tiles.
- Create: `apps/web/src/components/ChatPanel.tsx` — temporary chat UI.
- Create: `apps/web/src/test/setup.ts` — frontend test setup.
- Create: component/hook tests listed in tasks below.

### Docs

- Existing: `docs/superpowers/specs/2026-08-20-minimal-cord-design.md` — approved design.
- Create: `docs/deploy-vps.md` — PM2/systemd + reverse proxy + mediasoup ports.
- Create: `docs/manual-verification.md` — required manual call checklist.

---

## Task 1: Repository and workspace skeleton

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `README.md`

- [ ] **Step 1: Initialize git if needed**

Run:

```bash
test -d .git || git init
```

Expected: either initializes an empty repository or exits with no output if `.git` exists.

- [ ] **Step 2: Create workspace files**

Create `package.json`:

```json
{
  "name": "minimal-cord",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --parallel --filter @minimal-cord/server --filter @minimal-cord/web dev",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "typecheck": "pnpm -r typecheck"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  },
  "packageManager": "pnpm@9.9.0"
}
```

Create `pnpm-workspace.yaml`:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Create `tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true
  }
}
```

Create `.gitignore`:

```gitignore
node_modules/
dist/
coverage/
.env
.env.*
!.env.example
.DS_Store
*.log
```

Create `.env.example`:

```dotenv
HOST=0.0.0.0
PORT=3000
PUBLIC_BASE_URL=http://localhost:5173
MAX_PARTICIPANTS_PER_ROOM=20
MEDIASOUP_LISTEN_IP=0.0.0.0
MEDIASOUP_ANNOUNCED_IP=127.0.0.1
MEDIASOUP_MIN_PORT=40000
MEDIASOUP_MAX_PORT=49999
```

Create `README.md`:

```markdown
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

Frontend: http://localhost:5173

Backend: http://localhost:3000

## Checks

```bash
pnpm typecheck
pnpm test
pnpm build
```
```

- [ ] **Step 3: Install dependencies**

Run:

```bash
pnpm install
```

Expected: creates `pnpm-lock.yaml` and installs root dev dependencies.

- [ ] **Step 4: Verify workspace scripts fail only because packages do not exist yet**

Run:

```bash
pnpm -r typecheck
```

Expected: no workspace packages found or no package scripts yet. This is acceptable at this step.

- [ ] **Step 5: Commit**

Run:

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore .env.example README.md pnpm-lock.yaml docs/superpowers/specs/2026-08-20-minimal-cord-design.md docs/superpowers/plans/2026-08-20-minimal-cord.md
git commit -m "chore: initialize minimal-cord workspace"
```

Expected: commit succeeds. If `pnpm-lock.yaml` does not exist because install was deferred, omit it from `git add`.

---

## Task 2: Shared protocol and models

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/constants.ts`
- Create: `packages/shared/src/models.ts`
- Create: `packages/shared/src/protocol.ts`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/protocol.test.ts`

- [ ] **Step 1: Write failing protocol tests**

Create `packages/shared/src/protocol.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { DEFAULT_MAX_PARTICIPANTS, isClientMessage } from './index';

describe('shared protocol', () => {
  it('exports the default room participant limit', () => {
    expect(DEFAULT_MAX_PARTICIPANTS).toBe(20);
  });

  it('recognizes valid client messages', () => {
    expect(isClientMessage({ type: 'room:create', displayName: 'Ana' })).toBe(true);
    expect(isClientMessage({ type: 'chat:send', text: 'oi' })).toBe(true);
  });

  it('rejects invalid client messages', () => {
    expect(isClientMessage(null)).toBe(false);
    expect(isClientMessage({ type: 'chat:send', text: '' })).toBe(false);
    expect(isClientMessage({ type: 'unknown' })).toBe(false);
  });
});
```

- [ ] **Step 2: Create package metadata**

Create `packages/shared/package.json`:

```json
{
  "name": "@minimal-cord/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "lint": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "devDependencies": {
    "vitest": "^2.1.0"
  }
}
```

Create `packages/shared/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "declaration": true,
    "emitDeclarationOnly": false,
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src"
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
pnpm --filter @minimal-cord/shared test
```

Expected: FAIL because `./index` does not exist.

- [ ] **Step 4: Implement shared constants and models**

Create `packages/shared/src/constants.ts`:

```ts
export const DEFAULT_MAX_PARTICIPANTS = 20;
export const ROOM_ID_LENGTH = 10;
export const MAX_DISPLAY_NAME_LENGTH = 40;
export const MAX_CHAT_TEXT_LENGTH = 1000;

export const MEDIA_KINDS = ['audio', 'video'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const MEDIA_SOURCES = ['mic', 'camera', 'screen'] as const;
export type MediaSource = (typeof MEDIA_SOURCES)[number];
```

Create `packages/shared/src/models.ts`:

```ts
export type RoomId = string;
export type ParticipantId = string;

export interface Participant {
  id: ParticipantId;
  displayName: string;
  joinedAt: number;
}

export interface RoomSummary {
  id: RoomId;
  participants: Participant[];
  createdAt: number;
}

export interface ChatMessage {
  id: string;
  roomId: RoomId;
  participantId: ParticipantId;
  displayName: string;
  text: string;
  createdAt: number;
}

export interface PublishedTrack {
  producerId: string;
  participantId: ParticipantId;
  source: 'mic' | 'camera' | 'screen';
  kind: 'audio' | 'video';
}
```

- [ ] **Step 5: Implement protocol unions and guard**

Create `packages/shared/src/protocol.ts`:

```ts
import type { ChatMessage, Participant, PublishedTrack, RoomId } from './models';

export type ClientMessage =
  | { type: 'room:create'; displayName: string }
  | { type: 'room:join'; roomId: RoomId; displayName: string }
  | { type: 'room:leave' }
  | { type: 'chat:send'; text: string }
  | { type: 'media:get-router-rtp-capabilities' }
  | { type: 'media:create-transport'; direction: 'send' | 'recv' }
  | { type: 'media:connect-transport'; transportId: string; dtlsParameters: unknown }
  | { type: 'media:produce'; transportId: string; kind: 'audio' | 'video'; rtpParameters: unknown; source: 'mic' | 'camera' | 'screen' }
  | { type: 'media:consume'; producerId: string; rtpCapabilities: unknown }
  | { type: 'media:close-producer'; producerId: string };

export type ServerMessage =
  | { type: 'room:created'; roomId: RoomId }
  | { type: 'room:joined'; roomId: RoomId; participantId: string; participants: Participant[]; chatMessages: ChatMessage[] }
  | { type: 'room:not-found'; roomId: RoomId }
  | { type: 'room:full'; roomId: RoomId; limit: number }
  | { type: 'participant:joined'; participant: Participant }
  | { type: 'participant:left'; participantId: string }
  | { type: 'chat:message'; message: ChatMessage }
  | { type: 'media:router-rtp-capabilities'; rtpCapabilities: unknown }
  | { type: 'media:transport-created'; direction: 'send' | 'recv'; transportOptions: unknown }
  | { type: 'media:transport-connected'; transportId: string }
  | { type: 'media:produced'; producer: PublishedTrack }
  | { type: 'media:producer-closed'; producerId: string; participantId: string }
  | { type: 'media:new-producer'; producer: PublishedTrack }
  | { type: 'media:consumer-created'; consumerOptions: unknown }
  | { type: 'error'; code: string; message: string };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasNonEmptyString(value: Record<string, unknown>, key: string): boolean {
  return typeof value[key] === 'string' && value[key].trim().length > 0;
}

export function isClientMessage(value: unknown): value is ClientMessage {
  if (!isObject(value) || typeof value.type !== 'string') return false;

  switch (value.type) {
    case 'room:create':
      return hasNonEmptyString(value, 'displayName');
    case 'room:join':
      return hasNonEmptyString(value, 'roomId') && hasNonEmptyString(value, 'displayName');
    case 'room:leave':
    case 'media:get-router-rtp-capabilities':
      return true;
    case 'chat:send':
      return hasNonEmptyString(value, 'text');
    case 'media:create-transport':
      return value.direction === 'send' || value.direction === 'recv';
    case 'media:connect-transport':
      return hasNonEmptyString(value, 'transportId') && 'dtlsParameters' in value;
    case 'media:produce':
      return hasNonEmptyString(value, 'transportId') && (value.kind === 'audio' || value.kind === 'video') && (value.source === 'mic' || value.source === 'camera' || value.source === 'screen') && 'rtpParameters' in value;
    case 'media:consume':
      return hasNonEmptyString(value, 'producerId') && 'rtpCapabilities' in value;
    case 'media:close-producer':
      return hasNonEmptyString(value, 'producerId');
    default:
      return false;
  }
}
```

Create `packages/shared/src/index.ts`:

```ts
export * from './constants';
export * from './models';
export * from './protocol';
```

- [ ] **Step 6: Verify tests and build**

Run:

```bash
pnpm --filter @minimal-cord/shared test
pnpm --filter @minimal-cord/shared typecheck
pnpm --filter @minimal-cord/shared build
```

Expected: all commands PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add packages/shared package.json pnpm-lock.yaml
git commit -m "feat: add shared room protocol"
```

Expected: commit succeeds.

---

## Task 3: Server room store

**Files:**
- Create: `apps/server/package.json`
- Create: `apps/server/tsconfig.json`
- Create: `apps/server/vitest.config.ts`
- Create: `apps/server/src/rooms/roomStore.ts`
- Create: `apps/server/src/rooms/roomStore.test.ts`

- [ ] **Step 1: Create server package metadata**

Create `apps/server/package.json`:

```json
{
  "name": "@minimal-cord/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "lint": "tsc -p tsconfig.json --noEmit",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@fastify/websocket": "^11.0.0",
    "@minimal-cord/shared": "workspace:*",
    "fastify": "^5.0.0",
    "mediasoup": "^3.14.0",
    "nanoid": "^5.0.0"
  },
  "devDependencies": {
    "tsx": "^4.19.0",
    "vitest": "^2.1.0"
  }
}
```

Create `apps/server/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "noEmit": false,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  },
  "include": ["src"]
}
```

Create `apps/server/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node'
  }
});
```

- [ ] **Step 2: Write failing room store tests**

Create `apps/server/src/rooms/roomStore.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { RoomStore } from './roomStore';

describe('RoomStore', () => {
  it('creates a temporary room with a random id', () => {
    const store = new RoomStore({ maxParticipantsPerRoom: 20 });
    const room = store.createRoom();

    expect(room.id).toHaveLength(10);
    expect(room.participants).toEqual([]);
    expect(store.getRoom(room.id)?.id).toBe(room.id);
  });

  it('adds and removes participants, deleting empty rooms', () => {
    const store = new RoomStore({ maxParticipantsPerRoom: 20 });
    const room = store.createRoom();
    const participant = store.addParticipant(room.id, 'Ana');

    expect(participant?.displayName).toBe('Ana');
    expect(store.getParticipants(room.id)).toHaveLength(1);

    store.removeParticipant(room.id, participant!.id);

    expect(store.getRoom(room.id)).toBeUndefined();
  });

  it('rejects participants when the room is full', () => {
    const store = new RoomStore({ maxParticipantsPerRoom: 1 });
    const room = store.createRoom();

    expect(store.addParticipant(room.id, 'Ana')?.displayName).toBe('Ana');
    expect(store.addParticipant(room.id, 'Bia')).toBe('room-full');
  });

  it('stores chat only while the room exists', () => {
    const store = new RoomStore({ maxParticipantsPerRoom: 20 });
    const room = store.createRoom();
    const participant = store.addParticipant(room.id, 'Ana');
    const message = store.addChatMessage(room.id, participant!.id, 'Ana', 'oi');

    expect(message?.text).toBe('oi');
    expect(store.getChatMessages(room.id)).toHaveLength(1);

    store.removeParticipant(room.id, participant!.id);

    expect(store.getChatMessages(room.id)).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
pnpm install
pnpm --filter @minimal-cord/server test -- src/rooms/roomStore.test.ts
```

Expected: FAIL because `./roomStore` does not exist.

- [ ] **Step 4: Implement room store**

Create `apps/server/src/rooms/roomStore.ts`:

```ts
import { MAX_CHAT_TEXT_LENGTH, MAX_DISPLAY_NAME_LENGTH, ROOM_ID_LENGTH, type ChatMessage, type Participant, type RoomId, type RoomSummary } from '@minimal-cord/shared';
import { nanoid } from 'nanoid';

interface StoredRoom {
  id: RoomId;
  createdAt: number;
  participants: Map<string, Participant>;
  chatMessages: ChatMessage[];
}

export interface RoomStoreOptions {
  maxParticipantsPerRoom: number;
}

export type AddParticipantResult = Participant | 'room-not-found' | 'room-full';

export class RoomStore {
  private readonly rooms = new Map<RoomId, StoredRoom>();

  constructor(private readonly options: RoomStoreOptions) {}

  createRoom(): RoomSummary {
    const room: StoredRoom = {
      id: nanoid(ROOM_ID_LENGTH),
      createdAt: Date.now(),
      participants: new Map(),
      chatMessages: []
    };

    this.rooms.set(room.id, room);
    return this.toSummary(room);
  }

  getRoom(roomId: RoomId): RoomSummary | undefined {
    const room = this.rooms.get(roomId);
    return room ? this.toSummary(room) : undefined;
  }

  getParticipants(roomId: RoomId): Participant[] {
    return [...(this.rooms.get(roomId)?.participants.values() ?? [])];
  }

  getChatMessages(roomId: RoomId): ChatMessage[] {
    return [...(this.rooms.get(roomId)?.chatMessages ?? [])];
  }

  addParticipant(roomId: RoomId, displayName: string): AddParticipantResult {
    const room = this.rooms.get(roomId);
    if (!room) return 'room-not-found';
    if (room.participants.size >= this.options.maxParticipantsPerRoom) return 'room-full';

    const participant: Participant = {
      id: nanoid(),
      displayName: displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH),
      joinedAt: Date.now()
    };

    room.participants.set(participant.id, participant);
    return participant;
  }

  removeParticipant(roomId: RoomId, participantId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.participants.delete(participantId);

    if (room.participants.size === 0) {
      this.rooms.delete(roomId);
    }
  }

  addChatMessage(roomId: RoomId, participantId: string, displayName: string, text: string): ChatMessage | undefined {
    const room = this.rooms.get(roomId);
    if (!room) return undefined;

    const message: ChatMessage = {
      id: nanoid(),
      roomId,
      participantId,
      displayName,
      text: text.trim().slice(0, MAX_CHAT_TEXT_LENGTH),
      createdAt: Date.now()
    };

    if (message.text.length === 0) return undefined;
    room.chatMessages.push(message);
    return message;
  }

  private toSummary(room: StoredRoom): RoomSummary {
    return {
      id: room.id,
      createdAt: room.createdAt,
      participants: [...room.participants.values()]
    };
  }
}
```

- [ ] **Step 5: Verify room store tests and typecheck**

Run:

```bash
pnpm --filter @minimal-cord/server test -- src/rooms/roomStore.test.ts
pnpm --filter @minimal-cord/server typecheck
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/server packages/shared package.json pnpm-lock.yaml
git commit -m "feat: add temporary room store"
```

Expected: commit succeeds.

---

## Task 4: Fastify app and WebSocket room/chat flow

**Files:**
- Create: `apps/server/src/config.ts`
- Create: `apps/server/src/app.ts`
- Create: `apps/server/src/index.ts`
- Create: `apps/server/src/ws/messages.ts`
- Create: `apps/server/src/ws/socketRegistry.ts`
- Create: `apps/server/src/ws/roomSocket.ts`
- Create: `apps/server/src/ws/roomSocket.test.ts`

- [ ] **Step 1: Write failing WebSocket tests**

Create `apps/server/src/ws/roomSocket.test.ts`:

```ts
import { afterEach, describe, expect, it } from 'vitest';
import WebSocket from 'ws';
import { createApp } from '../app';

let cleanup: Array<() => Promise<void> | void> = [];

function waitForMessage(ws: WebSocket, type: string): Promise<any> {
  return new Promise((resolve) => {
    ws.on('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) resolve(message);
    });
  });
}

async function startTestServer() {
  const app = await createApp({ maxParticipantsPerRoom: 20 });
  await app.listen({ port: 0, host: '127.0.0.1' });
  cleanup.push(() => app.close());
  const address = app.server.address();
  if (!address || typeof address === 'string') throw new Error('missing test address');
  return `ws://127.0.0.1:${address.port}/ws`;
}

afterEach(async () => {
  await Promise.all(cleanup.map((fn) => fn()));
  cleanup = [];
});

describe('room WebSocket', () => {
  it('creates and joins a room', async () => {
    const url = await startTestServer();
    const creator = new WebSocket(url);
    cleanup.push(() => creator.close());

    await new Promise((resolve) => creator.once('open', resolve));
    creator.send(JSON.stringify({ type: 'room:create', displayName: 'Ana' }));
    const created = await waitForMessage(creator, 'room:created');
    const joined = await waitForMessage(creator, 'room:joined');

    expect(created.roomId).toHaveLength(10);
    expect(joined.participants[0].displayName).toBe('Ana');
  });

  it('broadcasts chat to participants in the same room', async () => {
    const url = await startTestServer();
    const ana = new WebSocket(url);
    const bia = new WebSocket(url);
    cleanup.push(() => ana.close(), () => bia.close());

    await Promise.all([
      new Promise((resolve) => ana.once('open', resolve)),
      new Promise((resolve) => bia.once('open', resolve))
    ]);

    ana.send(JSON.stringify({ type: 'room:create', displayName: 'Ana' }));
    const created = await waitForMessage(ana, 'room:created');
    await waitForMessage(ana, 'room:joined');

    bia.send(JSON.stringify({ type: 'room:join', roomId: created.roomId, displayName: 'Bia' }));
    await waitForMessage(bia, 'room:joined');

    const chatPromise = waitForMessage(ana, 'chat:message');
    bia.send(JSON.stringify({ type: 'chat:send', text: 'oi' }));

    await expect(chatPromise).resolves.toMatchObject({
      type: 'chat:message',
      message: { displayName: 'Bia', text: 'oi' }
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @minimal-cord/server test -- src/ws/roomSocket.test.ts
```

Expected: FAIL because `../app` does not exist.

- [ ] **Step 3: Implement config and message helpers**

Create `apps/server/src/config.ts`:

```ts
import { DEFAULT_MAX_PARTICIPANTS } from '@minimal-cord/shared';

export interface ServerConfig {
  host: string;
  port: number;
  publicBaseUrl: string;
  maxParticipantsPerRoom: number;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    host: env.HOST ?? '0.0.0.0',
    port: Number(env.PORT ?? 3000),
    publicBaseUrl: env.PUBLIC_BASE_URL ?? 'http://localhost:5173',
    maxParticipantsPerRoom: Number(env.MAX_PARTICIPANTS_PER_ROOM ?? DEFAULT_MAX_PARTICIPANTS)
  };
}
```

Create `apps/server/src/ws/messages.ts`:

```ts
import { isClientMessage, type ClientMessage, type ServerMessage } from '@minimal-cord/shared';

export function parseClientMessage(raw: Buffer | ArrayBuffer | Buffer[]): ClientMessage | undefined {
  try {
    const value = JSON.parse(raw.toString());
    return isClientMessage(value) ? value : undefined;
  } catch {
    return undefined;
  }
}

export interface SendableSocket {
  readyState: number;
  send(data: string): void;
}

export function sendMessage(socket: SendableSocket, message: ServerMessage): void {
  if (socket.readyState === 1) {
    socket.send(JSON.stringify(message));
  }
}
```

- [ ] **Step 4: Implement socket registry and room WebSocket handler**

Create `apps/server/src/ws/socketRegistry.ts`:

```ts
import type { ServerMessage } from '@minimal-cord/shared';
import type { SendableSocket } from './messages';
import { sendMessage } from './messages';

interface SocketEntry {
  socket: SendableSocket;
  roomId: string;
  participantId: string;
}

export class SocketRegistry {
  private readonly entries = new Map<SendableSocket, SocketEntry>();

  register(socket: SendableSocket, roomId: string, participantId: string): void {
    this.entries.set(socket, { socket, roomId, participantId });
  }

  unregister(socket: SendableSocket): SocketEntry | undefined {
    const entry = this.entries.get(socket);
    this.entries.delete(socket);
    return entry;
  }

  get(socket: SendableSocket): SocketEntry | undefined {
    return this.entries.get(socket);
  }

  broadcastToRoom(roomId: string, message: ServerMessage): void {
    for (const entry of this.entries.values()) {
      if (entry.roomId === roomId) sendMessage(entry.socket, message);
    }
  }

  broadcastToRoomExcept(roomId: string, exceptParticipantId: string, message: ServerMessage): void {
    for (const entry of this.entries.values()) {
      if (entry.roomId === roomId && entry.participantId !== exceptParticipantId) {
        sendMessage(entry.socket, message);
      }
    }
  }
}
```

Create `apps/server/src/ws/roomSocket.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import type { RoomStore } from '../rooms/roomStore';
import { parseClientMessage, sendMessage } from './messages';
import { SocketRegistry } from './socketRegistry';

export function registerRoomSocket(app: FastifyInstance, roomStore: RoomStore): void {
  const registry = new SocketRegistry();

  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', (raw) => {
      const message = parseClientMessage(raw);
      if (!message) {
        sendMessage(socket, { type: 'error', code: 'invalid-message', message: 'Mensagem inválida.' });
        return;
      }

      if (message.type === 'room:create') {
        const room = roomStore.createRoom();
        const participant = roomStore.addParticipant(room.id, message.displayName);
        if (typeof participant === 'string') return;
        registry.register(socket, room.id, participant.id);
        sendMessage(socket, { type: 'room:created', roomId: room.id });
        sendMessage(socket, { type: 'room:joined', roomId: room.id, participantId: participant.id, participants: roomStore.getParticipants(room.id), chatMessages: roomStore.getChatMessages(room.id) });
        return;
      }

      if (message.type === 'room:join') {
        const participant = roomStore.addParticipant(message.roomId, message.displayName);
        if (participant === 'room-not-found') {
          sendMessage(socket, { type: 'room:not-found', roomId: message.roomId });
          return;
        }
        if (participant === 'room-full') {
          sendMessage(socket, { type: 'room:full', roomId: message.roomId, limit: roomStore.getParticipants(message.roomId).length });
          return;
        }
        registry.register(socket, message.roomId, participant.id);
        sendMessage(socket, { type: 'room:joined', roomId: message.roomId, participantId: participant.id, participants: roomStore.getParticipants(message.roomId), chatMessages: roomStore.getChatMessages(message.roomId) });
        registry.broadcastToRoomExcept(message.roomId, participant.id, { type: 'participant:joined', participant });
        return;
      }

      if (message.type === 'chat:send') {
        const entry = registry.get(socket);
        if (!entry) return;
        const participant = roomStore.getParticipants(entry.roomId).find((item) => item.id === entry.participantId);
        if (!participant) return;
        const chatMessage = roomStore.addChatMessage(entry.roomId, participant.id, participant.displayName, message.text);
        if (chatMessage) registry.broadcastToRoom(entry.roomId, { type: 'chat:message', message: chatMessage });
        return;
      }
    });

    socket.on('close', () => {
      const entry = registry.unregister(socket);
      if (!entry) return;
      roomStore.removeParticipant(entry.roomId, entry.participantId);
      registry.broadcastToRoom(entry.roomId, { type: 'participant:left', participantId: entry.participantId });
    });
  });
}
```

- [ ] **Step 5: Implement app factory and entrypoint**

Create `apps/server/src/app.ts`:

```ts
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { RoomStore } from './rooms/roomStore';
import { registerRoomSocket } from './ws/roomSocket';

export interface CreateAppOptions {
  maxParticipantsPerRoom: number;
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: true });
  const roomStore = new RoomStore({ maxParticipantsPerRoom: options.maxParticipantsPerRoom });

  await app.register(websocket);

  app.get('/health', async () => ({ ok: true }));
  registerRoomSocket(app, roomStore);

  return app;
}
```

Create `apps/server/src/index.ts`:

```ts
import { createApp } from './app';
import { readConfig } from './config';

const config = readConfig();
const app = await createApp({ maxParticipantsPerRoom: config.maxParticipantsPerRoom });

await app.listen({ host: config.host, port: config.port });
```

- [ ] **Step 6: Verify WebSocket tests**

Run:

```bash
pnpm --filter @minimal-cord/server test -- src/ws/roomSocket.test.ts
pnpm --filter @minimal-cord/server typecheck
```

Expected: all commands PASS. If TypeScript reports missing `ws` types in tests, add `ws` and `@types/ws` as server dev dependencies and rerun.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/server package.json pnpm-lock.yaml
git commit -m "feat: add room websocket flow"
```

Expected: commit succeeds.

---

## Task 5: mediasoup service and signaling protocol

**Files:**
- Create: `apps/server/src/media/mediasoupService.ts`
- Create: `apps/server/src/media/mediasoupService.test.ts`
- Create: `apps/server/src/media/signaling.ts`
- Modify: `apps/server/src/app.ts`
- Modify: `apps/server/src/ws/roomSocket.ts`
- Modify: `apps/server/src/config.ts`

- [ ] **Step 1: Write failing mediasoup service tests**

Create `apps/server/src/media/mediasoupService.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildWebRtcTransportOptions, parseMediasoupConfig } from './mediasoupService';

describe('mediasoup config helpers', () => {
  it('parses port range and announced ip', () => {
    const config = parseMediasoupConfig({
      MEDIASOUP_LISTEN_IP: '0.0.0.0',
      MEDIASOUP_ANNOUNCED_IP: '203.0.113.10',
      MEDIASOUP_MIN_PORT: '40000',
      MEDIASOUP_MAX_PORT: '49999'
    });

    expect(config.worker.rtcMinPort).toBe(40000);
    expect(config.worker.rtcMaxPort).toBe(49999);
    expect(config.webRtcTransport.listenInfos[0].announcedAddress).toBe('203.0.113.10');
  });

  it('builds WebRTC transport options for mediasoup', () => {
    const options = buildWebRtcTransportOptions({
      listenIp: '0.0.0.0',
      announcedIp: '127.0.0.1'
    });

    expect(options.enableUdp).toBe(true);
    expect(options.enableTcp).toBe(true);
    expect(options.preferUdp).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @minimal-cord/server test -- src/media/mediasoupService.test.ts
```

Expected: FAIL because `./mediasoupService` does not exist.

- [ ] **Step 3: Implement mediasoup service**

Create `apps/server/src/media/mediasoupService.ts`:

```ts
import type { PublishedTrack } from '@minimal-cord/shared';
import * as mediasoup from 'mediasoup';
import type { types as mediaTypes } from 'mediasoup';

export interface MediasoupRuntimeConfig {
  worker: mediaTypes.WorkerSettings;
  router: mediaTypes.RouterOptions;
  webRtcTransport: mediaTypes.WebRtcTransportOptions;
}

export function buildWebRtcTransportOptions(input: { listenIp: string; announcedIp: string }): mediaTypes.WebRtcTransportOptions {
  return {
    listenInfos: [
      {
        protocol: 'udp',
        ip: input.listenIp,
        announcedAddress: input.announcedIp
      },
      {
        protocol: 'tcp',
        ip: input.listenIp,
        announcedAddress: input.announcedIp
      }
    ],
    enableUdp: true,
    enableTcp: true,
    preferUdp: true
  };
}

export function parseMediasoupConfig(env: NodeJS.ProcessEnv = process.env): MediasoupRuntimeConfig {
  const listenIp = env.MEDIASOUP_LISTEN_IP ?? '0.0.0.0';
  const announcedIp = env.MEDIASOUP_ANNOUNCED_IP ?? '127.0.0.1';

  return {
    worker: {
      rtcMinPort: Number(env.MEDIASOUP_MIN_PORT ?? 40000),
      rtcMaxPort: Number(env.MEDIASOUP_MAX_PORT ?? 49999)
    },
    router: {
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {}
        }
      ]
    },
    webRtcTransport: buildWebRtcTransportOptions({ listenIp, announcedIp })
  };
}

interface RoomMediaState {
  router: mediaTypes.Router;
  transports: Map<string, mediaTypes.WebRtcTransport>;
  producers: Map<string, { producer: mediaTypes.Producer; published: PublishedTrack }>;
  consumers: Map<string, mediaTypes.Consumer>;
}

export class MediasoupService {
  private worker?: mediaTypes.Worker;
  private readonly rooms = new Map<string, RoomMediaState>();

  constructor(private readonly config: MediasoupRuntimeConfig) {}

  async start(): Promise<void> {
    this.worker = await mediasoup.createWorker(this.config.worker);
  }

  async stop(): Promise<void> {
    for (const roomId of this.rooms.keys()) this.closeRoom(roomId);
    this.worker?.close();
  }

  async getOrCreateRoom(roomId: string): Promise<RoomMediaState> {
    const existing = this.rooms.get(roomId);
    if (existing) return existing;
    if (!this.worker) throw new Error('mediasoup worker not started');

    const router = await this.worker.createRouter(this.config.router);
    const state: RoomMediaState = {
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map()
    };
    this.rooms.set(roomId, state);
    return state;
  }

  async getRouterRtpCapabilities(roomId: string): Promise<mediaTypes.RtpCapabilities> {
    const room = await this.getOrCreateRoom(roomId);
    return room.router.rtpCapabilities;
  }

  async createTransport(roomId: string): Promise<mediaTypes.WebRtcTransport> {
    const room = await this.getOrCreateRoom(roomId);
    const transport = await room.router.createWebRtcTransport(this.config.webRtcTransport);
    room.transports.set(transport.id, transport);
    transport.on('close', () => room.transports.delete(transport.id));
    return transport;
  }

  async connectTransport(roomId: string, transportId: string, dtlsParameters: mediaTypes.DtlsParameters): Promise<void> {
    const transport = this.rooms.get(roomId)?.transports.get(transportId);
    if (!transport) throw new Error('transport not found');
    await transport.connect({ dtlsParameters });
  }

  async produce(roomId: string, participantId: string, transportId: string, kind: mediaTypes.MediaKind, rtpParameters: mediaTypes.RtpParameters, source: PublishedTrack['source']): Promise<PublishedTrack> {
    const room = this.rooms.get(roomId);
    const transport = room?.transports.get(transportId);
    if (!room || !transport) throw new Error('transport not found');

    const producer = await transport.produce({ kind, rtpParameters });
    const published: PublishedTrack = { producerId: producer.id, participantId, kind, source };
    room.producers.set(producer.id, { producer, published });
    producer.on('close', () => room.producers.delete(producer.id));
    return published;
  }

  async consume(roomId: string, transportId: string, producerId: string, rtpCapabilities: mediaTypes.RtpCapabilities): Promise<mediaTypes.Consumer> {
    const room = this.rooms.get(roomId);
    const transport = room?.transports.get(transportId);
    const producer = room?.producers.get(producerId)?.producer;
    if (!room || !transport || !producer) throw new Error('producer or transport not found');
    if (!room.router.canConsume({ producerId, rtpCapabilities })) throw new Error('cannot consume producer');

    const consumer = await transport.consume({ producerId, rtpCapabilities, paused: false });
    room.consumers.set(consumer.id, consumer);
    consumer.on('close', () => room.consumers.delete(consumer.id));
    return consumer;
  }

  closeProducer(roomId: string, producerId: string): PublishedTrack | undefined {
    const entry = this.rooms.get(roomId)?.producers.get(producerId);
    entry?.producer.close();
    return entry?.published;
  }

  closeRoom(roomId: string): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const consumer of room.consumers.values()) consumer.close();
    for (const producer of room.producers.values()) producer.producer.close();
    for (const transport of room.transports.values()) transport.close();
    room.router.close();
    this.rooms.delete(roomId);
  }
}
```

- [ ] **Step 4: Wire signaling handlers**

Create `apps/server/src/media/signaling.ts`:

```ts
import type { ClientMessage, ServerMessage } from '@minimal-cord/shared';
import type { types as mediaTypes } from 'mediasoup';
import type { MediasoupService } from './mediasoupService';

export interface SignalingContext {
  roomId: string;
  participantId: string;
  media: MediasoupService;
  send(message: ServerMessage): void;
  broadcast(message: ServerMessage): void;
}

function serializeTransport(transport: mediaTypes.WebRtcTransport) {
  return {
    id: transport.id,
    iceParameters: transport.iceParameters,
    iceCandidates: transport.iceCandidates,
    dtlsParameters: transport.dtlsParameters,
    sctpParameters: transport.sctpParameters
  };
}

function serializeConsumer(consumer: mediaTypes.Consumer) {
  return {
    id: consumer.id,
    producerId: consumer.producerId,
    kind: consumer.kind,
    rtpParameters: consumer.rtpParameters
  };
}

export async function handleMediaSignal(message: ClientMessage, context: SignalingContext): Promise<boolean> {
  if (message.type === 'media:get-router-rtp-capabilities') {
    context.send({ type: 'media:router-rtp-capabilities', rtpCapabilities: await context.media.getRouterRtpCapabilities(context.roomId) });
    return true;
  }

  if (message.type === 'media:create-transport') {
    const transport = await context.media.createTransport(context.roomId);
    context.send({ type: 'media:transport-created', direction: message.direction, transportOptions: serializeTransport(transport) });
    return true;
  }

  if (message.type === 'media:connect-transport') {
    await context.media.connectTransport(context.roomId, message.transportId, message.dtlsParameters as mediaTypes.DtlsParameters);
    context.send({ type: 'media:transport-connected', transportId: message.transportId });
    return true;
  }

  if (message.type === 'media:produce') {
    const producer = await context.media.produce(context.roomId, context.participantId, message.transportId, message.kind, message.rtpParameters as mediaTypes.RtpParameters, message.source);
    context.send({ type: 'media:produced', producer });
    context.broadcast({ type: 'media:new-producer', producer });
    return true;
  }

  if (message.type === 'media:consume') {
    const consumer = await context.media.consume(context.roomId, message.producerId, message.producerId, message.rtpCapabilities as mediaTypes.RtpCapabilities);
    context.send({ type: 'media:consumer-created', consumerOptions: serializeConsumer(consumer) });
    return true;
  }

  if (message.type === 'media:close-producer') {
    const producer = context.media.closeProducer(context.roomId, message.producerId);
    if (producer) context.broadcast({ type: 'media:producer-closed', producerId: producer.producerId, participantId: producer.participantId });
    return true;
  }

  return false;
}
```

Important correction before using this code in implementation: `media:consume` needs a receive transport id, not `producerId` as transport id. Update the shared `media:consume` client message in `packages/shared/src/protocol.ts` to include `transportId`, and change the handler to:

```ts
const consumer = await context.media.consume(context.roomId, message.transportId, message.producerId, message.rtpCapabilities as mediaTypes.RtpCapabilities);
```

- [ ] **Step 5: Update shared protocol for consume transport id**

Modify `packages/shared/src/protocol.ts` message variant:

```ts
| { type: 'media:consume'; transportId: string; producerId: string; rtpCapabilities: unknown }
```

Modify the guard case:

```ts
case 'media:consume':
  return hasNonEmptyString(value, 'transportId') && hasNonEmptyString(value, 'producerId') && 'rtpCapabilities' in value;
```

- [ ] **Step 6: Wire media service into app and room socket**

Modify `apps/server/src/app.ts`:

```ts
import websocket from '@fastify/websocket';
import Fastify from 'fastify';
import { MediasoupService, parseMediasoupConfig } from './media/mediasoupService';
import { RoomStore } from './rooms/roomStore';
import { registerRoomSocket } from './ws/roomSocket';

export interface CreateAppOptions {
  maxParticipantsPerRoom: number;
  media?: MediasoupService;
}

export async function createApp(options: CreateAppOptions) {
  const app = Fastify({ logger: true });
  const roomStore = new RoomStore({ maxParticipantsPerRoom: options.maxParticipantsPerRoom });
  const media = options.media ?? new MediasoupService(parseMediasoupConfig());

  await media.start();
  app.addHook('onClose', async () => media.stop());
  await app.register(websocket);

  app.get('/health', async () => ({ ok: true }));
  registerRoomSocket(app, roomStore, media);

  return app;
}
```

Modify `apps/server/src/ws/roomSocket.ts` signature and message loop to call `handleMediaSignal` after room join. Keep existing room/chat behavior:

```ts
import type { MediasoupService } from '../media/mediasoupService';
import { handleMediaSignal } from '../media/signaling';

export function registerRoomSocket(app: FastifyInstance, roomStore: RoomStore, media: MediasoupService): void {
  const registry = new SocketRegistry();

  app.get('/ws', { websocket: true }, (socket) => {
    socket.on('message', async (raw) => {
      const message = parseClientMessage(raw);
      if (!message) {
        sendMessage(socket, { type: 'error', code: 'invalid-message', message: 'Mensagem inválida.' });
        return;
      }

      const entry = registry.get(socket);
      if (entry && await handleMediaSignal(message, {
        roomId: entry.roomId,
        participantId: entry.participantId,
        media,
        send: (serverMessage) => sendMessage(socket, serverMessage),
        broadcast: (serverMessage) => registry.broadcastToRoomExcept(entry.roomId, entry.participantId, serverMessage)
      })) {
        return;
      }

      // Keep the existing room:create, room:join, and chat:send branches below this block.
    });

    // Keep existing close handler.
  });
}
```

- [ ] **Step 7: Verify media tests and server typecheck**

Run:

```bash
pnpm --filter @minimal-cord/server test -- src/media/mediasoupService.test.ts
pnpm --filter @minimal-cord/shared test
pnpm --filter @minimal-cord/server typecheck
```

Expected: all commands PASS.

- [ ] **Step 8: Commit**

Run:

```bash
git add apps/server packages/shared pnpm-lock.yaml
git commit -m "feat: add mediasoup signaling service"
```

Expected: commit succeeds.

---

## Task 6: Web app shell, routing, and local name flow

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/tsconfig.node.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/main.tsx`
- Create: `apps/web/src/App.tsx`
- Create: `apps/web/src/styles.css`
- Create: `apps/web/src/lib/nameStorage.ts`
- Create: `apps/web/src/lib/roomLink.ts`
- Create: `apps/web/src/pages/HomePage.tsx`
- Create: `apps/web/src/test/setup.ts`
- Create: `apps/web/src/pages/HomePage.test.tsx`

- [ ] **Step 1: Create web package metadata and config**

Create `apps/web/package.json`:

```json
{
  "name": "@minimal-cord/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -b && vite build",
    "dev": "vite --host 0.0.0.0",
    "lint": "tsc -b --noEmit",
    "preview": "vite preview",
    "test": "vitest run",
    "typecheck": "tsc -b --noEmit"
  },
  "dependencies": {
    "@minimal-cord/shared": "workspace:*",
    "@vitejs/plugin-react": "^4.3.0",
    "vite": "^5.4.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.4.0",
    "@testing-library/react": "^16.0.0",
    "@testing-library/user-event": "^14.5.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "jsdom": "^25.0.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

Create `apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `apps/web/tsconfig.node.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Bundler"
  },
  "include": ["vite.config.ts"]
}
```

Create `apps/web/vite.config.ts`:

```ts
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true
      }
    }
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts']
  }
});
```

Create `apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
```

- [ ] **Step 2: Write failing home test**

Create `apps/web/src/pages/HomePage.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { HomePage } from './HomePage';

describe('HomePage', () => {
  it('requires a display name before creating a room', async () => {
    const onCreateRoom = vi.fn();
    const user = userEvent.setup();

    render(<HomePage onCreateRoom={onCreateRoom} onJoinRoom={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /criar sala/i }));

    expect(onCreateRoom).not.toHaveBeenCalled();
    expect(screen.getByText(/informe seu nome/i)).toBeInTheDocument();
  });

  it('creates a room with a local display name', async () => {
    const onCreateRoom = vi.fn();
    const user = userEvent.setup();

    render(<HomePage onCreateRoom={onCreateRoom} onJoinRoom={vi.fn()} />);
    await user.type(screen.getByLabelText(/nome/i), 'Ana');
    await user.click(screen.getByRole('button', { name: /criar sala/i }));

    expect(onCreateRoom).toHaveBeenCalledWith('Ana');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run:

```bash
pnpm install
pnpm --filter @minimal-cord/web test -- src/pages/HomePage.test.tsx
```

Expected: FAIL because `./HomePage` does not exist.

- [ ] **Step 4: Implement app shell and home page**

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>minimal-cord</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `apps/web/src/lib/nameStorage.ts`:

```ts
const KEY = 'minimal-cord.displayName';

export function readDisplayName(): string {
  return window.localStorage.getItem(KEY) ?? '';
}

export function saveDisplayName(displayName: string): void {
  window.localStorage.setItem(KEY, displayName.trim());
}
```

Create `apps/web/src/lib/roomLink.ts`:

```ts
export function getRoomIdFromPath(pathname: string): string | undefined {
  const match = pathname.match(/^\/r\/([^/]+)$/);
  return match?.[1];
}

export function buildRoomPath(roomId: string): string {
  return `/r/${encodeURIComponent(roomId)}`;
}
```

Create `apps/web/src/pages/HomePage.tsx`:

```tsx
import { FormEvent, useState } from 'react';
import { readDisplayName, saveDisplayName } from '../lib/nameStorage';

interface HomePageProps {
  onCreateRoom(displayName: string): void;
  onJoinRoom(displayName: string, roomId: string): void;
}

export function HomePage({ onCreateRoom, onJoinRoom }: HomePageProps) {
  const [displayName, setDisplayName] = useState(readDisplayName);
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');

  function requireName(): string | undefined {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setError('Informe seu nome para continuar.');
      return undefined;
    }
    saveDisplayName(trimmed);
    setError('');
    return trimmed;
  }

  function handleCreate() {
    const name = requireName();
    if (name) onCreateRoom(name);
  }

  function handleJoin(event: FormEvent) {
    event.preventDefault();
    const name = requireName();
    const code = roomId.trim();
    if (name && code) onJoinRoom(name, code);
  }

  return (
    <main className="home-shell">
      <section className="home-card">
        <p className="eyebrow">minimal-cord</p>
        <h1>Chamada leve para amigos</h1>
        <p>Crie uma sala temporária, envie o link e fale com voz, câmera opcional, tela e chat.</p>

        <label>
          Nome
          <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Seu nome" />
        </label>

        {error ? <p className="form-error">{error}</p> : null}

        <button type="button" onClick={handleCreate}>Criar sala</button>

        <form onSubmit={handleJoin}>
          <label>
            Código da sala
            <input value={roomId} onChange={(event) => setRoomId(event.target.value)} placeholder="abc123" />
          </label>
          <button type="submit">Entrar</button>
        </form>
      </section>
    </main>
  );
}
```

Create `apps/web/src/App.tsx`:

```tsx
import { useMemo } from 'react';
import { getRoomIdFromPath } from './lib/roomLink';
import { HomePage } from './pages/HomePage';

export function App() {
  const roomId = useMemo(() => getRoomIdFromPath(window.location.pathname), []);

  if (roomId) {
    return <main className="room-shell"><p>Entrando na sala {roomId}...</p></main>;
  }

  return (
    <HomePage
      onCreateRoom={() => undefined}
      onJoinRoom={(_, targetRoomId) => {
        window.location.href = `/r/${encodeURIComponent(targetRoomId)}`;
      }}
    />
  );
}
```

Create `apps/web/src/main.tsx`:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

Create `apps/web/src/styles.css`:

```css
:root {
  color: #eef2ff;
  background: #10131f;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

body {
  margin: 0;
}

button,
input {
  font: inherit;
}

.home-shell,
.room-shell {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.home-card {
  width: min(520px, 100%);
  display: grid;
  gap: 16px;
  padding: 28px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 24px;
  background: rgba(255, 255, 255, 0.06);
}

.eyebrow {
  margin: 0;
  color: #93c5fd;
  text-transform: uppercase;
  letter-spacing: 0.12em;
}

label,
form {
  display: grid;
  gap: 8px;
}

input {
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 12px;
  padding: 12px 14px;
  color: #eef2ff;
  background: rgba(0, 0, 0, 0.24);
}

button {
  border: 0;
  border-radius: 12px;
  padding: 12px 14px;
  color: #08111f;
  background: #93c5fd;
  cursor: pointer;
}

.form-error {
  color: #fca5a5;
}
```

- [ ] **Step 5: Verify home page tests and build**

Run:

```bash
pnpm --filter @minimal-cord/web test -- src/pages/HomePage.test.tsx
pnpm --filter @minimal-cord/web typecheck
pnpm --filter @minimal-cord/web build
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web package.json pnpm-lock.yaml
git commit -m "feat: add web app shell"
```

Expected: commit succeeds.

---

## Task 7: Frontend room connection and chat state

**Files:**
- Create: `apps/web/src/lib/wsClient.ts`
- Create: `apps/web/src/hooks/useRoomConnection.ts`
- Create: `apps/web/src/hooks/useRoomConnection.test.tsx`
- Create: `apps/web/src/components/ChatPanel.tsx`
- Create: `apps/web/src/components/ParticipantList.tsx`
- Create: `apps/web/src/pages/RoomPage.tsx`
- Modify: `apps/web/src/App.tsx`

- [ ] **Step 1: Write failing hook test**

Create `apps/web/src/hooks/useRoomConnection.test.tsx`:

```tsx
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useRoomConnection } from './useRoomConnection';

describe('useRoomConnection', () => {
  it('adds chat messages received from the socket', () => {
    const send = vi.fn();
    let onMessage: ((message: any) => void) | undefined;
    const connect = vi.fn((_url: string, handler: (message: any) => void) => {
      onMessage = handler;
      return { send, close: vi.fn() };
    });

    const { result } = renderHook(() => useRoomConnection({ roomId: 'room1', displayName: 'Ana', connect }));

    act(() => {
      onMessage?.({ type: 'chat:message', message: { id: 'm1', roomId: 'room1', participantId: 'p1', displayName: 'Ana', text: 'oi', createdAt: 1 } });
    });

    expect(result.current.chatMessages).toHaveLength(1);
    expect(result.current.chatMessages[0].text).toBe('oi');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @minimal-cord/web test -- src/hooks/useRoomConnection.test.tsx
```

Expected: FAIL because `./useRoomConnection` does not exist.

- [ ] **Step 3: Implement WebSocket client and hook**

Create `apps/web/src/lib/wsClient.ts`:

```ts
import type { ClientMessage, ServerMessage } from '@minimal-cord/shared';

export interface RoomSocket {
  send(message: ClientMessage): void;
  close(): void;
}

export type ConnectRoomSocket = (url: string, onMessage: (message: ServerMessage) => void) => RoomSocket;

export const connectRoomSocket: ConnectRoomSocket = (url, onMessage) => {
  const socket = new WebSocket(url);

  socket.addEventListener('message', (event) => {
    onMessage(JSON.parse(event.data));
  });

  return {
    send(message) {
      const data = JSON.stringify(message);
      if (socket.readyState === WebSocket.OPEN) socket.send(data);
      else socket.addEventListener('open', () => socket.send(data), { once: true });
    },
    close() {
      socket.close();
    }
  };
};
```

Create `apps/web/src/hooks/useRoomConnection.ts`:

```ts
import type { ChatMessage, Participant, ServerMessage } from '@minimal-cord/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { connectRoomSocket, type ConnectRoomSocket, type RoomSocket } from '../lib/wsClient';

interface UseRoomConnectionOptions {
  roomId: string;
  displayName: string;
  connect?: ConnectRoomSocket;
}

export interface RoomConnectionState {
  participantId?: string;
  participants: Participant[];
  chatMessages: ChatMessage[];
  error?: string;
  socket?: RoomSocket;
  sendChat(text: string): void;
}

export function useRoomConnection({ roomId, displayName, connect = connectRoomSocket }: UseRoomConnectionOptions): RoomConnectionState {
  const [participantId, setParticipantId] = useState<string>();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string>();
  const [socket, setSocket] = useState<RoomSocket>();

  const wsUrl = useMemo(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}/ws`;
  }, []);

  useEffect(() => {
    function handleMessage(message: ServerMessage) {
      if (message.type === 'room:joined') {
        setParticipantId(message.participantId);
        setParticipants(message.participants);
        setChatMessages(message.chatMessages);
      } else if (message.type === 'participant:joined') {
        setParticipants((current) => [...current, message.participant]);
      } else if (message.type === 'participant:left') {
        setParticipants((current) => current.filter((participant) => participant.id !== message.participantId));
      } else if (message.type === 'chat:message') {
        setChatMessages((current) => [...current, message.message]);
      } else if (message.type === 'room:not-found') {
        setError('Sala não encontrada.');
      } else if (message.type === 'room:full') {
        setError('Sala cheia.');
      } else if (message.type === 'error') {
        setError(message.message);
      }
    }

    const nextSocket = connect(wsUrl, handleMessage);
    setSocket(nextSocket);
    nextSocket.send({ type: 'room:join', roomId, displayName });
    return () => nextSocket.close();
  }, [connect, displayName, roomId, wsUrl]);

  const sendChat = useCallback((text: string) => {
    socket?.send({ type: 'chat:send', text });
  }, [socket]);

  return { participantId, participants, chatMessages, error, socket, sendChat };
}
```

- [ ] **Step 4: Implement room UI components**

Create `apps/web/src/components/ParticipantList.tsx`:

```tsx
import type { Participant } from '@minimal-cord/shared';

export function ParticipantList({ participants }: { participants: Participant[] }) {
  return (
    <aside className="panel">
      <h2>Participantes</h2>
      <ul>
        {participants.map((participant) => <li key={participant.id}>{participant.displayName}</li>)}
      </ul>
    </aside>
  );
}
```

Create `apps/web/src/components/ChatPanel.tsx`:

```tsx
import type { ChatMessage } from '@minimal-cord/shared';
import { FormEvent, useState } from 'react';

export function ChatPanel({ messages, onSend }: { messages: ChatMessage[]; onSend(text: string): void }) {
  const [text, setText] = useState('');

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
  }

  return (
    <aside className="panel chat-panel">
      <h2>Chat</h2>
      <div className="chat-messages">
        {messages.map((message) => (
          <p key={message.id}><strong>{message.displayName}:</strong> {message.text}</p>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input aria-label="Mensagem" value={text} onChange={(event) => setText(event.target.value)} />
        <button type="submit">Enviar</button>
      </form>
    </aside>
  );
}
```

Create `apps/web/src/pages/RoomPage.tsx`:

```tsx
import { ChatPanel } from '../components/ChatPanel';
import { ParticipantList } from '../components/ParticipantList';
import { readDisplayName } from '../lib/nameStorage';
import { useRoomConnection } from '../hooks/useRoomConnection';

export function RoomPage({ roomId }: { roomId: string }) {
  const displayName = readDisplayName() || 'Convidado';
  const room = useRoomConnection({ roomId, displayName });

  if (room.error) return <main className="room-shell"><p>{room.error}</p></main>;

  return (
    <main className="room-layout">
      <section className="stage">
        <h1>Sala {roomId}</h1>
        <p>{room.participantId ? 'Conectado' : 'Entrando...'}</p>
      </section>
      <ParticipantList participants={room.participants} />
      <ChatPanel messages={room.chatMessages} onSend={room.sendChat} />
    </main>
  );
}
```

Modify `apps/web/src/App.tsx`:

```tsx
import { useMemo } from 'react';
import { getRoomIdFromPath } from './lib/roomLink';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';

export function App() {
  const roomId = useMemo(() => getRoomIdFromPath(window.location.pathname), []);

  if (roomId) return <RoomPage roomId={roomId} />;

  return (
    <HomePage
      onCreateRoom={() => undefined}
      onJoinRoom={(_, targetRoomId) => {
        window.location.href = `/r/${encodeURIComponent(targetRoomId)}`;
      }}
    />
  );
}
```

- [ ] **Step 5: Verify room connection tests and typecheck**

Run:

```bash
pnpm --filter @minimal-cord/web test -- src/hooks/useRoomConnection.test.tsx
pnpm --filter @minimal-cord/web typecheck
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web
git commit -m "feat: add room connection and chat UI"
```

Expected: commit succeeds.

---

## Task 8: Frontend media controls and mediasoup-client integration

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/mediaClient.ts`
- Create: `apps/web/src/hooks/useLocalMedia.ts`
- Create: `apps/web/src/components/MediaControls.tsx`
- Create: `apps/web/src/components/MediaGrid.tsx`
- Modify: `apps/web/src/pages/RoomPage.tsx`

- [ ] **Step 1: Add dependency**

Modify `apps/web/package.json` dependencies to include:

```json
"mediasoup-client": "^3.7.0"
```

Run:

```bash
pnpm install
```

Expected: dependency added to lockfile.

- [ ] **Step 2: Implement local media hook**

Create `apps/web/src/hooks/useLocalMedia.ts`:

```ts
import { useCallback, useState } from 'react';

export interface LocalMediaState {
  micStream?: MediaStream;
  cameraStream?: MediaStream;
  screenStreams: MediaStream[];
  error?: string;
  toggleMic(): Promise<void>;
  toggleCamera(): Promise<void>;
  startScreenShare(): Promise<void>;
  stopScreenShare(stream: MediaStream): void;
}

function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

export function useLocalMedia(): LocalMediaState {
  const [micStream, setMicStream] = useState<MediaStream>();
  const [cameraStream, setCameraStream] = useState<MediaStream>();
  const [screenStreams, setScreenStreams] = useState<MediaStream[]>([]);
  const [error, setError] = useState<string>();

  const toggleMic = useCallback(async () => {
    if (micStream) {
      stopStream(micStream);
      setMicStream(undefined);
      return;
    }
    try {
      setMicStream(await navigator.mediaDevices.getUserMedia({ audio: true, video: false }));
      setError(undefined);
    } catch {
      setError('Não foi possível acessar o microfone.');
    }
  }, [micStream]);

  const toggleCamera = useCallback(async () => {
    if (cameraStream) {
      stopStream(cameraStream);
      setCameraStream(undefined);
      return;
    }
    try {
      setCameraStream(await navigator.mediaDevices.getUserMedia({ audio: false, video: true }));
      setError(undefined);
    } catch {
      setError('Não foi possível acessar a câmera.');
    }
  }, [cameraStream]);

  const stopScreenShare = useCallback((stream: MediaStream) => {
    stopStream(stream);
    setScreenStreams((current) => current.filter((item) => item !== stream));
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      stream.getVideoTracks()[0]?.addEventListener('ended', () => stopScreenShare(stream));
      setScreenStreams((current) => [...current, stream]);
      setError(undefined);
    } catch {
      setError('Não foi possível compartilhar a tela.');
    }
  }, [stopScreenShare]);

  return { micStream, cameraStream, screenStreams, error, toggleMic, toggleCamera, startScreenShare, stopScreenShare };
}
```

- [ ] **Step 3: Implement media client wrapper**

Create `apps/web/src/lib/mediaClient.ts`:

```ts
import * as mediasoupClient from 'mediasoup-client';
import type { RoomSocket } from './wsClient';

export class RoomMediaClient {
  private device?: mediasoupClient.Device;
  private sendTransport?: mediasoupClient.types.Transport;
  private recvTransport?: mediasoupClient.types.Transport;

  constructor(private readonly socket: RoomSocket) {}

  async load(rtpCapabilities: mediasoupClient.types.RtpCapabilities): Promise<void> {
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });
  }

  requestRouterCapabilities(): void {
    this.socket.send({ type: 'media:get-router-rtp-capabilities' });
  }

  requestSendTransport(): void {
    this.socket.send({ type: 'media:create-transport', direction: 'send' });
  }

  requestRecvTransport(): void {
    this.socket.send({ type: 'media:create-transport', direction: 'recv' });
  }

  createSendTransport(options: mediasoupClient.types.TransportOptions): void {
    if (!this.device) throw new Error('device not loaded');
    this.sendTransport = this.device.createSendTransport(options);
    this.sendTransport.on('connect', ({ dtlsParameters }, callback) => {
      this.socket.send({ type: 'media:connect-transport', transportId: this.sendTransport!.id, dtlsParameters });
      callback();
    });
    this.sendTransport.on('produce', ({ kind, rtpParameters, appData }, callback) => {
      this.socket.send({ type: 'media:produce', transportId: this.sendTransport!.id, kind, rtpParameters, source: appData.source as 'mic' | 'camera' | 'screen' });
      callback({ id: `pending-${Date.now()}` });
    });
  }

  async publishTrack(track: MediaStreamTrack, source: 'mic' | 'camera' | 'screen'): Promise<void> {
    if (!this.sendTransport) throw new Error('send transport not ready');
    await this.sendTransport.produce({ track, appData: { source } });
  }
}
```

- [ ] **Step 4: Implement media UI components**

Create `apps/web/src/components/MediaControls.tsx`:

```tsx
export function MediaControls(props: {
  micEnabled: boolean;
  cameraEnabled: boolean;
  screenCount: number;
  onToggleMic(): void;
  onToggleCamera(): void;
  onStartScreenShare(): void;
}) {
  return (
    <div className="media-controls">
      <button type="button" onClick={props.onToggleMic}>{props.micEnabled ? 'Desligar mic' : 'Ligar mic'}</button>
      <button type="button" onClick={props.onToggleCamera}>{props.cameraEnabled ? 'Desligar câmera' : 'Ligar câmera'}</button>
      <button type="button" onClick={props.onStartScreenShare}>Compartilhar tela</button>
      <span>{props.screenCount} tela(s)</span>
    </div>
  );
}
```

Create `apps/web/src/components/MediaGrid.tsx`:

```tsx
import { useEffect, useRef } from 'react';

function VideoTile({ stream, label, featured }: { stream: MediaStream; label: string; featured?: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.srcObject = stream;
  }, [stream]);

  return (
    <article className={featured ? 'media-tile featured' : 'media-tile'}>
      <video ref={ref} autoPlay playsInline muted />
      <span>{label}</span>
    </article>
  );
}

export function MediaGrid({ cameraStream, screenStreams }: { cameraStream?: MediaStream; screenStreams: MediaStream[] }) {
  return (
    <div className="media-grid">
      {cameraStream ? <VideoTile stream={cameraStream} label="Sua câmera" /> : null}
      {screenStreams.map((stream, index) => <VideoTile key={index} stream={stream} label={`Sua tela ${index + 1}`} featured />)}
      {!cameraStream && screenStreams.length === 0 ? <p>Nenhuma câmera ou tela ativa.</p> : null}
    </div>
  );
}
```

- [ ] **Step 5: Wire controls into room page**

Modify `apps/web/src/pages/RoomPage.tsx`:

```tsx
import { ChatPanel } from '../components/ChatPanel';
import { MediaControls } from '../components/MediaControls';
import { MediaGrid } from '../components/MediaGrid';
import { ParticipantList } from '../components/ParticipantList';
import { useLocalMedia } from '../hooks/useLocalMedia';
import { useRoomConnection } from '../hooks/useRoomConnection';
import { readDisplayName } from '../lib/nameStorage';

export function RoomPage({ roomId }: { roomId: string }) {
  const displayName = readDisplayName() || 'Convidado';
  const room = useRoomConnection({ roomId, displayName });
  const media = useLocalMedia();

  if (room.error) return <main className="room-shell"><p>{room.error}</p></main>;

  return (
    <main className="room-layout">
      <section className="stage">
        <header>
          <h1>Sala {roomId}</h1>
          <p>{room.participantId ? 'Conectado' : 'Entrando...'}</p>
        </header>
        {media.error ? <p className="form-error">{media.error}</p> : null}
        <MediaGrid cameraStream={media.cameraStream} screenStreams={media.screenStreams} />
        <MediaControls
          micEnabled={Boolean(media.micStream)}
          cameraEnabled={Boolean(media.cameraStream)}
          screenCount={media.screenStreams.length}
          onToggleMic={() => void media.toggleMic()}
          onToggleCamera={() => void media.toggleCamera()}
          onStartScreenShare={() => void media.startScreenShare()}
        />
      </section>
      <ParticipantList participants={room.participants} />
      <ChatPanel messages={room.chatMessages} onSend={room.sendChat} />
    </main>
  );
}
```

- [ ] **Step 6: Verify web typecheck and tests**

Run:

```bash
pnpm --filter @minimal-cord/web test
pnpm --filter @minimal-cord/web typecheck
pnpm --filter @minimal-cord/web build
```

Expected: all commands PASS.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/web pnpm-lock.yaml
git commit -m "feat: add local media controls"
```

Expected: commit succeeds.

---

## Task 9: Create-room flow from frontend

**Files:**
- Modify: `apps/web/src/App.tsx`
- Modify: `apps/web/src/lib/wsClient.ts`
- Create: `apps/web/src/lib/createRoom.ts`
- Create: `apps/web/src/lib/createRoom.test.ts`

- [ ] **Step 1: Write failing create-room test**

Create `apps/web/src/lib/createRoom.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createRoom } from './createRoom';

describe('createRoom', () => {
  it('resolves with the created room id', async () => {
    class FakeWebSocket {
      static OPEN = 1;
      readyState = 1;
      onopen?: () => void;
      onmessage?: (event: { data: string }) => void;
      constructor() {
        setTimeout(() => this.onopen?.(), 0);
      }
      send = vi.fn(() => {
        this.onmessage?.({ data: JSON.stringify({ type: 'room:created', roomId: 'abc123' }) });
      });
      close = vi.fn();
    }

    vi.stubGlobal('WebSocket', FakeWebSocket);
    await expect(createRoom('Ana')).resolves.toBe('abc123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
pnpm --filter @minimal-cord/web test -- src/lib/createRoom.test.ts
```

Expected: FAIL because `./createRoom` does not exist.

- [ ] **Step 3: Implement createRoom helper**

Create `apps/web/src/lib/createRoom.ts`:

```ts
import { saveDisplayName } from './nameStorage';

function wsUrl(): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function createRoom(displayName: string): Promise<string> {
  saveDisplayName(displayName);

  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl());
    const timeout = window.setTimeout(() => {
      socket.close();
      reject(new Error('Tempo esgotado ao criar sala.'));
    }, 8000);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'room:create', displayName }));
    };

    socket.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'room:created') {
        window.clearTimeout(timeout);
        socket.close();
        resolve(message.roomId);
      }
      if (message.type === 'error') {
        window.clearTimeout(timeout);
        socket.close();
        reject(new Error(message.message));
      }
    };

    socket.onerror = () => {
      window.clearTimeout(timeout);
      reject(new Error('Não foi possível conectar ao servidor.'));
    };
  });
}
```

- [ ] **Step 4: Wire HomePage create callback**

Modify `apps/web/src/App.tsx`:

```tsx
import { useMemo } from 'react';
import { createRoom } from './lib/createRoom';
import { buildRoomPath, getRoomIdFromPath } from './lib/roomLink';
import { HomePage } from './pages/HomePage';
import { RoomPage } from './pages/RoomPage';

export function App() {
  const roomId = useMemo(() => getRoomIdFromPath(window.location.pathname), []);

  if (roomId) return <RoomPage roomId={roomId} />;

  return (
    <HomePage
      onCreateRoom={async (displayName) => {
        const nextRoomId = await createRoom(displayName);
        window.location.href = buildRoomPath(nextRoomId);
      }}
      onJoinRoom={(_, targetRoomId) => {
        window.location.href = buildRoomPath(targetRoomId);
      }}
    />
  );
}
```

- [ ] **Step 5: Verify create-room flow**

Run:

```bash
pnpm --filter @minimal-cord/web test -- src/lib/createRoom.test.ts
pnpm --filter @minimal-cord/web typecheck
```

Expected: all commands PASS.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/web
git commit -m "feat: connect create room flow"
```

Expected: commit succeeds.

---

## Task 10: Deploy and manual verification docs

**Files:**
- Create: `docs/deploy-vps.md`
- Create: `docs/manual-verification.md`
- Modify: `README.md`

- [ ] **Step 1: Create VPS deploy guide**

Create `docs/deploy-vps.md`:

```markdown
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

Open UDP/TCP ports `40000-49999` for mediasoup.

## Build

```bash
pnpm install --frozen-lockfile
pnpm build
```

## PM2

```bash
pm2 start apps/server/dist/index.js --name minimal-cord
pm2 save
```

## Reverse proxy requirements

- Forward HTTP traffic to `127.0.0.1:3000`.
- Preserve WebSocket upgrade headers for `/ws`.
- Use HTTPS. WebRTC camera, microphone, and screen sharing require secure context outside localhost.

## TURN later

The MVP uses public STUN only. If users fail to connect from restrictive networks, add Coturn and configure TURN credentials in the frontend media setup.
```

- [ ] **Step 2: Create manual verification checklist**

Create `docs/manual-verification.md`:

```markdown
# Manual Verification

Run this before calling the MVP functional.

## Local multi-client test

- [ ] Start backend and frontend with `pnpm dev`.
- [ ] Open the app in two different browsers or one browser plus incognito.
- [ ] Set a local display name in each client.
- [ ] Create a room in client A.
- [ ] Join the same room by link in client B.
- [ ] Confirm both participants appear in the participant list.
- [ ] Turn on microphone in both clients.
- [ ] Confirm audio is exchanged.
- [ ] Turn camera on and off.
- [ ] Start screen share in client A.
- [ ] Start screen share in client B while A is still sharing.
- [ ] Confirm both screen shares are visible at the same time.
- [ ] Send chat messages from both clients.
- [ ] Close all clients.
- [ ] Reopen the same room link and confirm the room is gone or empty according to current lifecycle behavior.

## Error checks

- [ ] Join a fake room id and confirm “sala não encontrada”.
- [ ] Deny microphone permission and confirm retry-friendly error.
- [ ] Deny camera permission and confirm retry-friendly error.
- [ ] Deny screen share permission and confirm retry-friendly error.

## Production smoke test

- [ ] Run `pnpm build`.
- [ ] Start server with PM2 or systemd.
- [ ] Open HTTPS URL.
- [ ] Confirm `/ws` connects over WSS.
- [ ] Confirm at least two remote clients can join and exchange audio.
```

- [ ] **Step 3: Update README docs links**

Modify `README.md` to include:

```markdown
## Docs

- Design: `docs/superpowers/specs/2026-08-20-minimal-cord-design.md`
- Implementation plan: `docs/superpowers/plans/2026-08-20-minimal-cord.md`
- VPS deploy: `docs/deploy-vps.md`
- Manual verification: `docs/manual-verification.md`
```

- [ ] **Step 4: Verify docs are present**

Run:

```bash
test -f docs/deploy-vps.md && test -f docs/manual-verification.md && test -f README.md
```

Expected: exits 0.

- [ ] **Step 5: Commit**

Run:

```bash
git add docs README.md
git commit -m "docs: add deploy and verification guides"
```

Expected: commit succeeds.

---

## Task 11: Final integrated verification

**Files:**
- Modify only if verification reveals defects.

- [ ] **Step 1: Run full automated checks**

Run:

```bash
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands PASS.

- [ ] **Step 2: Run local app**

Run:

```bash
cp .env.example .env
pnpm dev
```

Expected: backend starts on port `3000`; frontend starts on port `5173`.

- [ ] **Step 3: Execute manual checklist**

Follow `docs/manual-verification.md`.

Expected: all required MVP items pass or defects are recorded and fixed before completion.

- [ ] **Step 4: Record verification result**

Append a dated section to `docs/manual-verification.md`:

```markdown
## Verification run — 2026-08-20

- Automated checks: PASS
- Local two-client room join: PASS
- Audio: PASS
- Optional camera: PASS
- Multiple simultaneous screen shares: PASS
- Temporary chat: PASS
- Empty room cleanup: PASS
- Notes: none
```

- [ ] **Step 5: Commit final verification docs**

Run:

```bash
git add docs/manual-verification.md
git commit -m "test: record mvp verification"
```

Expected: commit succeeds.

---

## Self-review notes

- Spec coverage: the plan covers temporary rooms, no accounts, local display name, React/Vite/TypeScript frontend, Node/Fastify/WebSocket backend, mediasoup SFU, in-memory chat/state, multiple participants, optional camera, multiple screen shares, VPS deploy with PM2/systemd, public STUN/TURN deferred, error states, participant limit, and manual verification.
- Scope guard: no database, Electron, moderation, persistent channels, recording, Docker Compose, mandatory TURN, or Discord-like server/channel system is included.
- Known implementation risk: mediasoup signaling is the highest-risk section. Keep it isolated in Task 5 and verify with typecheck plus manual browser testing. If Task 5 becomes too large during execution, split it into `mediasoup service`, `server signaling`, and `frontend consume remote tracks` subtasks before coding further.
- Type consistency: shared event names use `room:*`, `participant:*`, `chat:*`, `media:*`; frontend and backend must import these from `@minimal-cord/shared` rather than duplicating string unions.
