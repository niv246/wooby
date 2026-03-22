import { io } from 'socket.io-client';

const socket = io(window.location.origin, {
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
});

// Session management
export function saveSession(code, name, id) {
  try {
    sessionStorage.setItem('wooby', JSON.stringify({ code, name, id }));
  } catch (e) { /* ignore */ }
}

export function getSession() {
  try {
    const raw = sessionStorage.getItem('wooby');
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

export function clearSession() {
  try { sessionStorage.removeItem('wooby'); } catch (e) { /* ignore */ }
}

// Auto-rejoin on reconnect
let hasConnectedOnce = false;

socket.on('connect', () => {
  if (hasConnectedOnce) {
    // This is a REconnection — try to rejoin
    const session = getSession();
    if (session) {
      socket.emit('join-room', {
        code: session.code,
        name: session.name,
        playerId: session.id,
      });
    }
  }
  hasConnectedOnce = true;
});

export default socket;
