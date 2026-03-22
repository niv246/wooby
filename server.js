const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { customAlphabet } = require('nanoid');
const Game = require('./game/Game');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
});

// Serve built client
app.use(express.static(path.join(__dirname, 'client', 'dist')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'dist', 'index.html'));
});

// Room code generator — no confusing chars (0/O/1/I/l)
const nanoid = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 5);

// In-memory rooms
const rooms = new Map();

// Disconnect timeouts
const disconnectTimers = new Map();

function broadcastGameState(roomCode) {
  const room = rooms.get(roomCode);
  if (!room || !room.game) return;

  for (const player of room.players) {
    const state = room.game.getStateForPlayer(player.id);
    io.to(player.socketId).emit('game-state', state);
  }
}

function broadcastLobby(roomCode) {
  const room = rooms.get(roomCode);
  if (!room) return;

  const playerList = room.players.map(p => ({
    id: p.id,
    name: p.name,
    connected: p.connected,
  }));

  for (const player of room.players) {
    io.to(player.socketId).emit('lobby-update', {
      code: roomCode,
      players: playerList,
      hostId: room.hostId,
      myId: player.id,
    });
  }
}

io.on('connection', (socket) => {
  let currentRoom = null;
  let playerId = null;

  // ==================== CREATE ROOM ====================
  socket.on('create-room', ({ name }) => {
    if (!name || name.trim().length === 0) {
      socket.emit('error-msg', { msg: 'צריך שם!' });
      return;
    }

    const code = nanoid();
    playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    const room = {
      code,
      hostId: playerId,
      players: [{
        id: playerId,
        name: name.trim(),
        socketId: socket.id,
        connected: true,
      }],
      game: null,
      gameNumber: 0,
      previousFinishOrder: null,
      seatingOrder: null,
    };

    rooms.set(code, room);
    currentRoom = code;
    socket.join(code);

    socket.emit('room-created', {
      code,
      myId: playerId,
      players: [{ id: playerId, name: name.trim(), connected: true }],
      hostId: playerId,
    });
  });

  // ==================== JOIN ROOM ====================
  socket.on('join-room', ({ code, name, playerId: savedPlayerId }) => {
    if (!name || name.trim().length === 0) {
      socket.emit('error-msg', { msg: 'צריך שם!' });
      return;
    }

    const roomCode = code?.toUpperCase()?.trim();
    const room = rooms.get(roomCode);

    if (!room) {
      socket.emit('error-msg', { msg: 'חדר לא נמצא' });
      return;
    }

    // Check if reconnecting — match by saved playerId first, then by name
    const existing = room.players.find(p =>
      (savedPlayerId && p.id === savedPlayerId) ||
      (p.name === name.trim() && !p.connected)
    );
    if (existing) {
      // Reconnect
      existing.socketId = socket.id;
      existing.connected = true;
      playerId = existing.id;
      currentRoom = roomCode;
      socket.join(roomCode);

      // Clear disconnect timer
      const timerKey = `${roomCode}_${playerId}`;
      if (disconnectTimers.has(timerKey)) {
        clearTimeout(disconnectTimers.get(timerKey));
        disconnectTimers.delete(timerKey);
      }

      // Mark as reconnected in game
      if (room.game) {
        const gamePlayer = room.game.getPlayer(playerId);
        if (gamePlayer) gamePlayer.disconnected = false;
      }

      socket.emit('room-joined', {
        code: roomCode,
        myId: playerId,
        players: room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected })),
        hostId: room.hostId,
        reconnected: true,
      });

      if (room.game) {
        broadcastGameState(roomCode);
      } else {
        broadcastLobby(roomCode);
      }
      return;
    }

    if (room.game) {
      socket.emit('error-msg', { msg: 'המשחק כבר התחיל' });
      return;
    }

    if (room.players.length >= 6) {
      socket.emit('error-msg', { msg: 'החדר מלא (מקסימום 6)' });
      return;
    }

    // Check duplicate name
    if (room.players.some(p => p.name === name.trim())) {
      socket.emit('error-msg', { msg: 'השם הזה כבר תפוס' });
      return;
    }

    playerId = `p_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

    room.players.push({
      id: playerId,
      name: name.trim(),
      socketId: socket.id,
      connected: true,
    });

    currentRoom = roomCode;
    socket.join(roomCode);

    socket.emit('room-joined', {
      code: roomCode,
      myId: playerId,
      players: room.players.map(p => ({ id: p.id, name: p.name, connected: p.connected })),
      hostId: room.hostId,
    });

    broadcastLobby(roomCode);
  });

  // ==================== START GAME ====================
  socket.on('start-game', () => {
    const room = rooms.get(currentRoom);
    if (!room) return;
    if (room.hostId !== playerId) {
      socket.emit('error-msg', { msg: 'רק המארח יכול להתחיל' });
      return;
    }
    if (room.players.length < 2) {
      socket.emit('error-msg', { msg: 'צריך לפחות 2 שחקנים' });
      return;
    }

    room.gameNumber++;
    const playerInfos = room.players.map(p => ({ id: p.id, name: p.name }));

    room.game = new Game(playerInfos, {
      gameNumber: room.gameNumber,
      previousFinishOrder: room.previousFinishOrder,
      seatingOrder: room.seatingOrder,
    });

    if (!room.seatingOrder) {
      room.seatingOrder = room.game.seatingOrder;
    }

    broadcastGameState(currentRoom);
  });

  // ==================== PLAY CARDS ====================
  socket.on('play-cards', ({ cardIds, jokerChoice }) => {
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.playCards(playerId, cardIds, jokerChoice);
    if (!result.success) {
      socket.emit('error-msg', { msg: result.error });
      return;
    }

    broadcastGameState(currentRoom);
  });

  // ==================== PASS ====================
  socket.on('pass', () => {
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.pass(playerId);
    if (!result.success) {
      socket.emit('error-msg', { msg: result.error });
      return;
    }

    broadcastGameState(currentRoom);
  });

  // ==================== RESET PILE ====================
  socket.on('reset-pile', () => {
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.resetPile(playerId);
    if (!result.success) {
      socket.emit('error-msg', { msg: result.error });
      return;
    }

    broadcastGameState(currentRoom);
  });

  // ==================== BURST ====================
  socket.on('burst', ({ cardIds }) => {
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.burst(playerId, cardIds);
    if (!result.success) {
      socket.emit('error-msg', { msg: result.error });
      return;
    }

    broadcastGameState(currentRoom);
  });

  // ==================== EXCHANGE PICK ====================
  socket.on('exchange-pick', ({ value }) => {
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.exchangePick(playerId, value);
    if (!result.success) {
      socket.emit('error-msg', { msg: result.error });
      return;
    }

    broadcastGameState(currentRoom);
  });

  // ==================== EXCHANGE GIVE ====================
  socket.on('exchange-give', ({ cardIds }) => {
    const room = rooms.get(currentRoom);
    if (!room || !room.game) return;

    const result = room.game.exchangeGive(playerId, cardIds);
    if (!result.success) {
      socket.emit('error-msg', { msg: result.error });
      return;
    }

    broadcastGameState(currentRoom);
  });

  // ==================== REMATCH ====================
  socket.on('rematch', () => {
    const room = rooms.get(currentRoom);
    if (!room) return;
    if (room.hostId !== playerId) {
      socket.emit('error-msg', { msg: 'רק המארח יכול להתחיל סיבוב חדש' });
      return;
    }
    if (!room.game || room.game.phase !== 'gameOver') {
      socket.emit('error-msg', { msg: 'המשחק עדיין לא נגמר' });
      return;
    }

    // Save finish order for exchange
    room.previousFinishOrder = room.game.finishOrder;

    room.gameNumber++;
    const playerInfos = room.players
      .filter(p => p.connected)
      .map(p => ({ id: p.id, name: p.name }));

    room.game = new Game(playerInfos, {
      gameNumber: room.gameNumber,
      previousFinishOrder: room.previousFinishOrder,
      seatingOrder: room.seatingOrder,
    });

    broadcastGameState(currentRoom);
  });

  // ==================== DISCONNECT ====================
  socket.on('disconnect', () => {
    if (!currentRoom || !playerId) return;
    const room = rooms.get(currentRoom);
    if (!room) return;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return;

    player.connected = false;

    // Mark as disconnected in game
    if (room.game) {
      const gamePlayer = room.game.getPlayer(playerId);
      if (gamePlayer) gamePlayer.disconnected = true;
      broadcastGameState(currentRoom);
    } else {
      broadcastLobby(currentRoom);
    }

    // Set 5-minute timeout to remove player
    const timerKey = `${currentRoom}_${playerId}`;
    disconnectTimers.set(timerKey, setTimeout(() => {
      const r = rooms.get(currentRoom);
      if (!r) return;
      // Remove player
      r.players = r.players.filter(p => p.id !== playerId);
      disconnectTimers.delete(timerKey);

      if (r.players.length === 0) {
        rooms.delete(currentRoom);
      } else {
        // If host left, assign new host
        if (r.hostId === playerId) {
          const newHost = r.players.find(p => p.connected);
          if (newHost) r.hostId = newHost.id;
        }
        if (r.game) {
          broadcastGameState(currentRoom);
        } else {
          broadcastLobby(currentRoom);
        }
      }
    }, 5 * 60 * 1000)); // 5 minutes
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`🃏 Wooby server running on port ${PORT}`);
});
