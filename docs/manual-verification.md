# Manual Verification

Run this before calling the MVP functional. The automated suite covers the room
store, the WebSocket flow, the media signaling, and the frontend hooks, but it
cannot verify real WebRTC media — that part is only provable in a browser.

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
- [ ] Confirm both screen shares are visible at the same time, in both clients.
- [ ] Stop one screen share with the browser's own stop button and confirm the tile disappears for everyone.
- [ ] Send chat messages from both clients.
- [ ] Open a third client on the room link and confirm it immediately receives the audio and screens already in progress.
- [ ] Close all clients, reopen the same room link, and confirm "sala não encontrada" — rooms are deleted when the last participant leaves.

## Error checks

- [ ] Join a fake room id and confirm "sala não encontrada".
- [ ] Deny microphone permission and confirm a retry-friendly error appears.
- [ ] Deny camera permission and confirm a retry-friendly error appears.
- [ ] Cancel the screen share picker and confirm a retry-friendly error appears.
- [ ] Stop the backend with a room open and confirm the client does not crash.

## Known lifecycle behavior

A room lives only while it has at least one connected participant. If the
creator reloads the page while alone in the room, the room is deleted and the
reload lands on "sala não encontrada". This follows the design decision to
remove empty rooms immediately.

## Production smoke test

- [ ] Run `pnpm build`.
- [ ] Start the server with PM2 or systemd and serve `apps/web/dist` from the reverse proxy.
- [ ] Open the HTTPS URL.
- [ ] Confirm `/health` returns `{"ok":true}`.
- [ ] Confirm `/ws` connects over WSS (browser devtools, Network → WS).
- [ ] Open a room link directly in a new tab and confirm the SPA fallback serves it.
- [ ] Confirm at least two clients on different networks can join and exchange audio.
