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

// Auto-rejoin on reconnect (only for mid-session socket drops, NOT browser restarts)
let hasConnectedOnce = false;
let rejoinTimeout = null;

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

      // Give it 3 seconds max — if no success, clear session and give up
      if (rejoinTimeout) clearTimeout(rejoinTimeout);
      rejoinTimeout = setTimeout(() => {
        clearSession();
        rejoinTimeout = null;
      }, 3000);

      // Clear timeout on success
      socket.once('room-joined', () => {
        if (rejoinTimeout) { clearTimeout(rejoinTimeout); rejoinTimeout = null; }
      });
      socket.once('game-state', () => {
        if (rejoinTimeout) { clearTimeout(rejoinTimeout); rejoinTimeout = null; }
      });
      socket.once('error-msg', () => {
        if (rejoinTimeout) { clearTimeout(rejoinTimeout); rejoinTimeout = null; }
        clearSession();
      });
    }
  }
  hasConnectedOnce = true;
});

export default socket;
