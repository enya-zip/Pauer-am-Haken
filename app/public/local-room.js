// Ersatz für die WebSocket-Verbindung zum Higgsfield-Server (Durable Object "Room").
// Auf GitHub Pages gibt es keinen Server. Diese Klasse spricht dasselbe Protokoll
// wie app/src/room.ts, rechnet aber direkt im Browser mit denselben Spielregeln
// (rules.js). Der Spielstand einer laufenden Runde bleibt im Tab gespeichert,
// genau wie vorher auf dem Server ("Deine Runde ist wieder da.").
import {meta, setup, validateAction, applyAction, isGameOver, viewFor} from './rules.js';

const OPEN = 1, CLOSED = 3;
const META = {game: meta.game, minPlayers: meta.minPlayers, maxPlayers: meta.maxPlayers};

function read(key) {
  try { const v = JSON.parse(sessionStorage.getItem(key)); return v && typeof v === 'object' ? v : null; } catch { return null; }
}
function write(key, value) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export class LocalRoom {
  constructor(room) {
    this.key = 'pauer-local-room:' + room;
    this.readyState = 0;
    this.onopen = this.onmessage = this.onclose = this.onerror = null;
    this.player = null;
    setTimeout(() => { this.readyState = OPEN; this.onopen?.(); }, 0);
  }
  load() { return read(this.key) || {status: 'waiting', seats: [], state: null, result: null}; }
  emit(data) { setTimeout(() => { if (this.readyState === OPEN) this.onmessage?.({data: JSON.stringify(data)}); }, 0); }
  broadcast(game) {
    this.emit({type: 'state', status: game.status, seats: game.seats, you: this.player, connected: 1,
      view: game.state ? viewFor(game.state, this.player) : null, result: game.result, meta: META});
  }
  error(error) { this.emit({type: 'error', error}); }
  send(raw) {
    if (this.readyState !== OPEN) return;
    if (raw === '__ping') { this.emit('__pong'); return; }
    let msg; try { msg = JSON.parse(raw); } catch { return this.error('invalid message'); }
    const game = this.load();
    if (msg.type === 'join') {
      this.player = String(msg.playerId);
      if (!game.seats.includes(this.player) && game.seats.length < META.maxPlayers) game.seats.push(this.player);
      if (game.status === 'waiting' && game.seats.length >= META.minPlayers) { game.state = setup(game.seats); game.status = 'playing'; }
      write(this.key, game); return this.broadcast(game);
    }
    if (!this.player) return this.error('join first');
    if (!game.seats.includes(this.player)) return this.error('spectators cannot act');
    if (msg.type === 'action') {
      if (game.status !== 'playing') return this.error('game is not in progress');
      const verdict = validateAction(game.state, this.player, msg.action);
      if (!verdict.ok) return this.error(verdict.error ?? 'invalid action');
      game.state = applyAction(game.state, this.player, msg.action);
      const end = isGameOver(game.state);
      if (end.over) { game.status = 'over'; game.result = end; }
      write(this.key, game); return this.broadcast(game);
    }
    if (msg.type === 'reset') {
      game.state = setup(game.seats); game.status = 'playing'; game.result = null;
      write(this.key, game); return this.broadcast(game);
    }
    this.error('unknown message');
  }
  close() { this.readyState = CLOSED; this.onclose?.(); }
}
