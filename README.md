# FLAPPY: OVERDRIVE — Multiplayer starter

This turns the single-player HTML game into a small Node.js website with Socket.IO rooms.

## Included
- Versus Mode menu
- Create public or private lobbies
- Public lobby browser and join button
- Private lobbies with six-character join codes
- Up to 8 players per lobby
- Live player bird positions and scores, with a lobby roster
- Automatic host handoff when a host leaves
- A basic health endpoint at `/health`

## Run locally
1. Install Node.js 18 or newer.
2. Open a terminal in this folder.
3. Run `npm install`.
4. Run `npm start`.
5. Open `http://localhost:3000` in multiple browser windows/devices on the same computer/network.
6. Create a public lobby in one window, then join it from another. For private mode, share the displayed code.

Do not open `public/index.html` directly as a `file://` URL; multiplayer requires the Node server.

## Deploying
Deploy this whole folder to a Node.js host that supports persistent WebSocket connections. Set the start command to `npm start`. A static-only host is not sufficient for the Socket.IO backend. Keep the frontend and backend on the same origin for the simplest setup.

## Current prototype limitations
- Each player runs their own local pipe layout; this shows other players in real time but is not yet a deterministic, synchronized race.
- No user accounts, chat, persistent lobby storage, moderation, anti-cheat, or production abuse protection.
- Lobbies exist only while the server process is running.
- Do not treat the server-side score broadcast as a verified leaderboard.
