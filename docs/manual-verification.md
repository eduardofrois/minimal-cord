# Manual Verification

Run this before calling the MVP functional locally. The automated suite covers
the room store, the WebSocket flow, the media signaling, and the frontend
hooks, but it cannot verify real WebRTC media or production networking.

## Local multi-client test

- [ ] Start backend and frontend with `pnpm dev`.
- [ ] Open the app in two different browsers, or one browser plus a private window.
- [ ] Set a local display name in each client.
- [ ] Create a room in client A and confirm the address bar becomes `/r/<roomId>`.
- [ ] Copy the link with the "Copiar link" button and join it in client B.
- [ ] Confirm both participants appear in the participant list, in both clients.
- [ ] Turn on the microphone in both clients.
- [ ] Confirm audio is exchanged in both directions.
- [ ] Turn the camera on in A and confirm B sees it; turn it off and confirm the tile disappears.
- [ ] Start a screen share in client A.
- [ ] Start a screen share in client B while A is still sharing.
- [ ] Confirm both screen shares, from different participants, are visible at the same time in both clients.
- [ ] Stop one screen share with the browser's own stop button and confirm the tile disappears for everyone.
- [ ] Send chat messages from both clients.
- [ ] Open a third client on the room link and confirm it immediately receives the audio and screens already in progress.
- [ ] Close all clients, reopen the same room link, and confirm the room survives a short refresh window before disappearing.
- [ ] After the empty-room grace period expires, confirm "sala não encontrada".

## Error checks

- [ ] Join a fake room id and confirm "sala não encontrada".
- [ ] Deny microphone permission and confirm a retry-friendly error appears.
- [ ] Deny camera permission and confirm a retry-friendly error appears.
- [ ] Cancel the screen share picker and confirm a retry-friendly error appears.
- [ ] Stop the backend with a room open and confirm the client does not crash.

## Known lifecycle behavior

A room stays alive briefly after the last participant disconnects. If the
creator reloads the page while alone in the room, the room should survive long
enough for the refresh/join to complete. Once the empty-room grace period
expires, the room is deleted and future joins land on "sala não encontrada".

## Production smoke test

- [ ] Run `pnpm build`.
- [ ] Start the server with PM2 or systemd and serve `apps/web/dist` from the reverse proxy.
- [ ] Open the HTTPS URL.
- [ ] Confirm `/health` returns `{"ok":true}`.
- [ ] Confirm `/ws` connects over WSS (browser devtools, Network → WS).
- [ ] Open a room link directly in a new tab and confirm the SPA fallback serves it.
- [ ] Confirm at least two clients on different networks can join and exchange audio.

## Verification run — 2026-08-21

Environment: Windows 11, Node 24.19.0, pnpm 9.15.9, `pnpm dev`, two tabs of the
same Chromium instance. Microphone, camera, and screen capture were replaced by
synthetic tracks (`canvas.captureStream()` and an `AudioContext` oscillator) so
the WebRTC path could be exercised without physical devices.

- Automated checks (`pnpm typecheck`, `pnpm test`, `pnpm build`): PASS — 39 tests.
- Create room and adopt the `/r/<roomId>` link: PASS
- Second client joins by link, both listed as participants: PASS
- Temporary chat in both directions: PASS
- Audio produce/consume in both directions: PASS — remote `<audio>` playing a live track.
- Optional camera: PASS — remote tile decoded at 320x180; turning the camera off removed the tile in the other client.
- Multiple simultaneous screen shares: PASS — two screen tiles from different participants, decoded at the same time.
- Late joiner receives media already in progress: PASS — a client entering an active room consumed the camera and both screens.
- Empty room cleanup: PARTIAL — reopening the link after every client left returned "sala não encontrada"; the short refresh window is now covered by automated tests.
- Unknown room id: PASS — "sala não encontrada".
- Server log clean (no warn/error entries) during the whole run: PASS

Not covered by this run, still required before calling the MVP done:

- [ ] Real microphone and camera devices, including the permission-denied errors.
- [ ] Two clients on different machines and different networks.
- [ ] HTTPS/WSS production smoke test behind the reverse proxy, including the SPA fallback on room links.
- [ ] Behavior on restrictive NAT, which is what decides whether TURN is needed.
