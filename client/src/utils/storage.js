const PLAYER_KEY = 'shua-player';
const STATS_KEY = 'shua-stats';
const SESSIONS_KEY = 'shua-sessions';

// === Player ===

export function getPlayer() {
  const data = localStorage.getItem(PLAYER_KEY);
  return data ? JSON.parse(data) : null;
}

export function savePlayer(name) {
  const existing = getPlayer();
  const player = {
    id: existing?.id || crypto.randomUUID(),
    name,
    createdAt: existing?.createdAt || Date.now(),
  };
  localStorage.setItem(PLAYER_KEY, JSON.stringify(player));
  return player;
}

export function clearPlayer() {
  localStorage.removeItem(PLAYER_KEY);
}

// === Stats ===

export function getStats() {
  const data = localStorage.getItem(STATS_KEY);
  return data ? JSON.parse(data) : {
    totalGames: 0,
    wins: 0,
    second: 0,
    spiked: 0,
    secondShua: 0,
    totalBursts: 0,
    totalBurns: 0,
  };
}

export function updateStats(gameResult) {
  const stats = getStats();
  stats.totalGames++;
  if (gameResult.rank === 1) stats.wins++;
  if (gameResult.rank === 2) stats.second++;
  if (gameResult.isShua) stats.spiked++;
  if (gameResult.isSecondShua) stats.secondShua++;
  stats.totalBursts += gameResult.bursts || 0;
  stats.totalBurns += gameResult.burns || 0;
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  return stats;
}

// === Sessions (game history) ===

export function getSessions() {
  const data = localStorage.getItem(SESSIONS_KEY);
  return data ? JSON.parse(data) : [];
}

export function addSession(session) {
  const sessions = getSessions();
  sessions.unshift(session);
  if (sessions.length > 50) sessions.pop();
  localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}
