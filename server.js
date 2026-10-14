const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const crypto = require('crypto');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: true } });
const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 8;
const lobbies = new Map();
const socketLobby = new Map();

app.use(express.static(path.join(__dirname, 'public')));
app.get('/health', (_req, res) => res.json({ ok: true, lobbies: lobbies.size }));

function clean(value, max = 32) {
  return String(value || '').replace(/[<>\u0000-\u001f]/g, '').trim().slice(0, max);
}
function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  do { code = Array.from(crypto.randomBytes(6), b => chars[b % chars.length]).join(''); }
  while ([...lobbies.values()].some(l => l.code === code));
  return code;
}
function publicLobby(lobby, revealCode = false) {
  const players = [...lobby.players.values()].map(p => ({ id: p.id, name: p.name }));
  return {
    id: lobby.id, name: lobby.name, privacy: lobby.privacy,
    code: revealCode && lobby.privacy === 'private' ? lobby.code : undefined,
    hostId: lobby.hostId,
    hostName: lobby.players.get(lobby.hostId)?.name || 'Host',
    players, maxPlayers: MAX_PLAYERS
  };
}
function publicList() {
  return [...lobbies.values()].filter(l => l.privacy === 'public').map(l => ({
    id: l.id, name: l.name, privacy: l.privacy, hostName: l.players.get(l.hostId)?.name || 'Host',
    players: l.players.size, maxPlayers: MAX_PLAYERS
  }));
}
function emitLists() { io.emit('lobby:list', publicList()); }
function emitLobby(lobby) {
  io.to(lobby.id).emit('lobby:update', publicLobby(lobby, true));
  emitLists();
}
function leaveLobby(socket) {
  const id = socketLobby.get(socket.id);
  if (!id) return;
  const lobby = lobbies.get(id);
  socketLobby.delete(socket.id);
  socket.leave(id);
  socket.to(id).emit('versus:left', socket.id);
  if (!lobby) return;
  lobby.players.delete(socket.id);
  if (lobby.players.size === 0) lobbies.delete(id);
  else {
    if (lobby.hostId === socket.id) lobby.hostId = lobby.players.keys().next().value;
    emitLobby(lobby);
  }
  emitLists();
}
function joinSocket(socket, lobby, name) {
  if (lobby.players.size >= MAX_PLAYERS) return socket.emit('lobby:error', 'That lobby is full.');
  leaveLobby(socket);
  lobby.players.set(socket.id, { id: socket.id, name: clean(name, 16) || `Bird ${socket.id.slice(-4)}` });
  socketLobby.set(socket.id, lobby.id);
  socket.join(lobby.id);
  socket.emit('lobby:joined', publicLobby(lobby, true));
  emitLobby(lobby);
}

io.on('connection', socket => {
  socket.emit('lobby:list', publicList());
  socket.on('lobby:list', () => socket.emit('lobby:list', publicList()));
  socket.on('lobby:create', data => {
    if (socketLobby.has(socket.id)) leaveLobby(socket);
    const privacy = data?.privacy === 'private' ? 'private' : 'public';
    const id = crypto.randomBytes(5).toString('hex');
    const lobby = { id, name: clean(data?.lobbyName, 32) || 'Flap Zone', privacy,
      code: privacy === 'private' ? makeCode() : null, hostId: socket.id, players: new Map() };
    lobbies.set(id, lobby);
    joinSocket(socket, lobby, data?.name);
    socket.emit('lobby:created', publicLobby(lobby, true));
    emitLists();
  });
  socket.on('lobby:join', data => {
    const name = data?.name;
    let lobby = null;
    if (data?.code) {
      const code = clean(data.code, 8).toUpperCase();
      lobby = [...lobbies.values()].find(l => l.privacy === 'private' && l.code === code);
      if (!lobby) return socket.emit('lobby:error', 'Private lobby code is invalid or that lobby no longer exists.');
    } else if (data?.lobbyId) {
      lobby = lobbies.get(clean(data.lobbyId, 16));
      if (!lobby || lobby.privacy !== 'public') return socket.emit('lobby:error', 'That public lobby no longer exists.');
    }
    if (!lobby) return socket.emit('lobby:error', 'Choose a public lobby or enter a private code.');
    joinSocket(socket, lobby, name);
  });
  socket.on('lobby:leave', () => leaveLobby(socket));
  socket.on('versus:state', data => {
    const lobbyId = socketLobby.get(socket.id);
    if (!lobbyId || !lobbies.has(lobbyId) || !data || typeof data !== 'object') return;
    const y = Number(data.y), score = Number(data.score);
    const color = /^#[0-9a-fA-F]{6}$/.test(data.color) ? data.color : '#61f4ff';
    socket.to(lobbyId).emit('versus:state', {
      id: socket.id, name: clean(data.name, 16) || 'Bird',
      y: Number.isFinite(y) ? Math.max(0, Math.min(1, y)) : 0.5,
      score: Number.isFinite(score) ? Math.max(0, Math.min(100000, Math.floor(score))) : 0,
      alive: data.alive === true, color
    });
  });
  socket.on('disconnect', () => leaveLobby(socket));
});

server.listen(PORT, '0.0.0.0', () => console.log(`FLAPPY: OVERDRIVE multiplayer server listening on port ${PORT}`));
