import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket, { saveSession, getSession, clearSession } from './socket';
import Card from './components/Card';

const RANK_LABELS = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', '10': '10', J: 'J', Q: 'Q', K: 'K', A: 'A',
  joker: '🃏',
};

// Assign opponent positions around the table (clockwise from me)
// שחקן שמאל = הבא אחריי בסדר שעון
function getOpponentPositions(count) {
  switch (count) {
    case 1: return ['top'];
    case 2: return ['left', 'right'];
    case 3: return ['left', 'top', 'right'];
    case 4: return ['left', 'top-left', 'top-right', 'right'];
    case 5: return ['left', 'top-left', 'top', 'top-right', 'right'];
    default: return [];
  }
}

// ==================== HOME SCREEN ====================
function HomeScreen({ onCreateRoom, onJoinRoom }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="screen home-screen fade-in">
      {/* Logo top */}
      <div className="home-top">
        <h1 className="logo">וובי</h1>
        <p className="subtitle">משחק הקלפים הכי מבאס 🍑</p>
      </div>

      {/* Buttons at bottom */}
      <div className="home-bottom">
        <input
          className="input-field"
          type="text"
          placeholder="מה השם שלך?"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={12}
          autoFocus
        />

        <button
          className="btn-wood btn-large"
          onClick={() => name.trim() && onCreateRoom(name.trim())}
          disabled={!name.trim()}
        >
          פתח חדר חדש
        </button>

        <div className="divider">
          <span>— או הצטרף —</span>
        </div>

        <div className="join-row">
          <input
            className="input-field input-code"
            type="text"
            placeholder="קוד"
            value={joinCode}
            onChange={e => setJoinCode(e.target.value.toUpperCase())}
            maxLength={5}
          />
          <button
            className="btn-wood"
            onClick={() => name.trim() && joinCode.trim() && onJoinRoom(name.trim(), joinCode.trim())}
            disabled={!name.trim() || joinCode.trim().length < 5}
          >
            הצטרף
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== LOBBY SCREEN ====================
function LobbyScreen({ code, players, hostId, myId, onStart }) {
  const isHost = myId === hostId;
  const canStart = isHost && players.length >= 2;

  return (
    <div className="screen lobby-screen fade-in">
      {/* Persistent top bar */}
      <div className="top-bar">
        <span className="top-logo">וובי</span>
      </div>

      {/* Dark panel */}
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">חדר משחק</span>
        </div>

        <div className="room-code-display">
          <span className="room-code">{code}</span>
          <button
            className="btn-copy"
            onClick={() => navigator.clipboard?.writeText(code)}
          >
            העתק
          </button>
        </div>

        <p className="lobby-share">שלח את הקוד לחברים!</p>

        <div className="players-list">
          {players.map(p => (
            <div key={p.id} className={`player-chip ${!p.connected ? 'disconnected' : ''}`}>
              {p.id === hostId && <span className="host-crown">👑</span>}
              <span>{p.name}</span>
              {!p.connected && <span className="dc-badge">מנותק</span>}
            </div>
          ))}
        </div>

        <div className="lobby-info">{players.length}/6 שחקנים</div>

        {isHost && (
          <button
            className="btn-wood btn-large btn-fire"
            onClick={onStart}
            disabled={!canStart}
          >
            יאללה!
          </button>
        )}
        {!isHost && (
          <p className="waiting-text">ממתינים למארח...</p>
        )}
      </div>
    </div>
  );
}

// ==================== JOKER MODAL ====================
function JokerModal({ onChoice, canReset }) {
  const [mode, setMode] = useState(null);
  const values = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  if (mode === 'mirror') {
    return (
      <div className="modal-overlay">
        <div className="modal joker-modal">
          <h3>🃏 בחר ערך לג׳וקר</h3>
          <div className="value-grid">
            {values.map(v => (
              <button key={v} className="btn-value" onClick={() => onChoice({ type: 'mirror', value: v })}>
                {v}
              </button>
            ))}
          </div>
          <button className="btn-cancel" onClick={() => setMode(null)}>חזרה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal joker-modal">
        <h3>🃏 מה הג׳וקר עושה?</h3>
        <button className="btn-wood" onClick={() => setMode('mirror')}>
          מראה — בחר ערך
        </button>
        {canReset && (
          <button className="btn-wood btn-danger" onClick={() => onChoice({ type: 'reset' })}>
            🔥 איפוס!
          </button>
        )}
        <button className="btn-cancel" onClick={() => onChoice(null)}>ביטול</button>
      </div>
    </div>
  );
}

// ==================== BURST MODAL ====================
function BurstModal({ bursts, onBurst, onCancel }) {
  if (bursts.length === 1) {
    return (
      <div className="modal-overlay">
        <div className="modal burst-modal">
          <h3>💥 רביעייה!</h3>
          <p className="burst-rank">רביעיית {bursts[0].rank}</p>
          <button className="btn-burst btn-large" onClick={() => onBurst(bursts[0].cardIds)}>
            פריצה! 💥
          </button>
          <button className="btn-cancel" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal burst-modal">
        <h3>💥 בחר רביעייה</h3>
        {bursts.map((b, i) => (
          <button key={i} className="btn-burst" onClick={() => onBurst(b.cardIds)}>
            רביעיית {b.rank} ({b.type === 'hand' ? 'מהיד' : 'השלמה'})
          </button>
        ))}
        <button className="btn-cancel" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

// ==================== OPPONENT COMPONENT ====================
function Opponent({ player, position }) {
  const isActive = player.isCurrentTurn;
  const isFinished = player.finished;

  return (
    <div className={`opponent opponent-${position} ${isActive ? 'opponent-active' : ''} ${isFinished ? 'opponent-finished' : ''} ${player.disconnected ? 'opponent-dc' : ''}`}>
      <div className="opponent-info">
        <span className="opponent-name">{player.name}</span>
        <span className="score-badge">0</span>
        {isFinished && (
          <span className="finish-badge">
            {player.finishRank === 1 ? '👑' : player.finishRank === 2 ? '🥈' : player.finishRank === 3 ? '🥉' : `#${player.finishRank}`}
          </span>
        )}
      </div>
      {!isFinished && (
        <div className="opponent-fan">
          {Array.from({ length: Math.min(player.cardCount, 15) }).map((_, i) => (
            <div
              key={i}
              className="fan-card"
              style={{
                '--i': i,
                '--total': Math.min(player.cardCount, 15),
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ==================== GAME LOG ====================
function GameLog({ log }) {
  return (
    <div className="game-log">
      {log.slice(-3).map((entry, i) => (
        <div key={`${entry.time}-${i}`} className={`log-msg ${i === log.slice(-3).length - 1 ? 'log-msg-latest' : ''}`}>
          {entry.msg}
        </div>
      ))}
    </div>
  );
}

// ==================== EXCHANGE SCREEN ====================
function ExchangeScreen({ gameState, selectedCards, onToggleCard, onExchangePick, onExchangeGive }) {
  const { exchange, hand } = gameState;
  if (!exchange) return null;

  if (exchange.role === 'taker' && exchange.action === 'pick') {
    return (
      <div className="screen exchange-screen fade-in">
        <div className="exchange-panel">
          <h2 className="exchange-title">🔄 החלפת שועה</h2>
          <p className="exchange-desc">
            בחר {exchange.remaining} ערכ{exchange.remaining > 1 ? 'ים' : ''} מהיד של {exchange.partnerName}
          </p>
          <div className="value-grid">
            {exchange.values.map(v => (
              <button key={v} className="btn-value btn-large" onClick={() => onExchangePick(v)}>
                {RANK_LABELS[v] || v}
              </button>
            ))}
          </div>
          <div className="exchange-hand-preview">
            {hand.map(card => (
              <Card key={card.id} card={card} small />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (exchange.role === 'taker' && exchange.action === 'give') {
    return (
      <div className="screen exchange-screen fade-in">
        <div className="exchange-panel">
          <h2 className="exchange-title">🔄 החלפת שועה</h2>
          <p className="exchange-desc">בחר {exchange.count} קלפים לתת ל{exchange.partnerName}</p>
          <div className="exchange-hand">
            {hand.map(card => (
              <Card
                key={card.id}
                card={card}
                selected={selectedCards.includes(card.id)}
                onClick={() => onToggleCard(card.id)}
              />
            ))}
          </div>
          <button
            className="btn-wood btn-large"
            onClick={() => onExchangeGive(selectedCards)}
            disabled={selectedCards.length !== exchange.count}
          >
            תן! 🎁
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="screen exchange-screen fade-in">
      <div className="exchange-panel">
        <h2 className="exchange-title">🔄 החלפת שועה</h2>
        <p className="waiting-text">ממתינים להחלפה...</p>
        <div className="exchange-hand-preview">
          {hand.map(card => (
            <Card key={card.id} card={card} small />
          ))}
        </div>
      </div>
    </div>
  );
}

// ==================== GAME OVER SCREEN ====================
function GameOverScreen({ gameState, isHost, onRematch }) {
  const { finishOrder } = gameState;
  const rankEmojis = ['👑', '🥈', '🥉', '4️⃣', '5️⃣', '🍑'];

  return (
    <div className="screen gameover-screen fade-in">
      <div className="gameover-panel">
        <div className="gameover-emoji">🍑</div>
        <h2 className="gameover-title">סוף המשחק!</h2>

        <div className="rankings">
          {finishOrder.map((p, i) => {
            const isLast = i === finishOrder.length - 1;
            const emoji = isLast && finishOrder.length > 1 ? '🍑' : (rankEmojis[i] || `#${i + 1}`);
            return (
              <div key={p.id} className={`rank-row ${isLast && finishOrder.length > 1 ? 'rank-shooa' : ''} ${i === 0 ? 'rank-first' : ''}`}>
                <span className="rank-emoji">{emoji}</span>
                <span className="rank-name">{p.name}</span>
                {isLast && finishOrder.length > 1 && <span className="shooa-label">שועה!</span>}
              </div>
            );
          })}
        </div>

        {isHost && (
          <button className="btn-wood btn-large" onClick={onRematch}>
            עוד סיבוב! 🔄
          </button>
        )}
        {!isHost && (
          <p className="waiting-text">ממתינים למארח...</p>
        )}
      </div>

      <div className="confetti-container" aria-hidden="true">
        {Array.from({ length: 25 }).map((_, i) => (
          <div key={i} className="confetti-piece" style={{
            '--x': `${Math.random() * 100}%`,
            '--delay': `${Math.random() * 2}s`,
            '--color': ['#f5c542','#e74c3c','#00b4d8','#27ae60','#ff6b9d','#9b59b6'][i % 6],
          }} />
        ))}
      </div>
    </div>
  );
}

// ==================== GAME SCREEN ====================
function GameScreenInner({ gameState, selectedCards, onToggleCard, onPlay, onPass, onReset, onBurstClick }) {
  const {
    hand, opponents, pile, isMyTurn, canReset, sevenActive,
    possibleBursts, log, currentPlayerId, mustPlayThreeOfClubs, allPlayers
  } = gameState;

  const currentPlayerInfo = allPlayers?.find(p => p.id === currentPlayerId);
  const statusText = isMyTurn
    ? (sevenActive ? '⬇ מתחת ל-7!' : 'תורך!')
    : (currentPlayerInfo ? `התור של ${currentPlayerInfo.name}` : '');

  const positions = getOpponentPositions(opponents.length);

  // Client-side quantity validation
  const selectedCount = selectedCards.length;
  const pileQuantity = pile.quantity;
  const isResetCard = selectedCount === 1 && hand.find(c => c.id === selectedCards[0])?.rank === '2';
  const isJokerReset = selectedCount === 1 && hand.find(c => c.id === selectedCards[0])?.rank === 'joker';
  const quantityMismatch = !pile.isEmpty && pileQuantity > 0 && selectedCount > 0
    && selectedCount !== pileQuantity && !isResetCard && !isJokerReset;
  const quantityHint = quantityMismatch
    ? `צריך ${pileQuantity === 1 ? 'בודד' : pileQuantity === 2 ? 'זוג' : 'שלישייה'}`
    : null;
  const canPlay = isMyTurn && selectedCount > 0 && !quantityMismatch;

  // Client-side burst detection based on selection
  const selectedBurst = (() => {
    if (selectedCount === 0) return null;
    const selectedObjs = selectedCards.map(id => hand.find(c => c.id === id)).filter(Boolean);
    // All selected must be real cards (no joker, no 2), same rank
    const realSelected = selectedObjs.filter(c => c.rank !== 'joker' && c.rank !== '2');
    if (realSelected.length === 0 || realSelected.length !== selectedCount) return null;
    const rank = realSelected[0].rank;
    if (!realSelected.every(c => c.rank === rank)) return null;
    // Count matching rank on pile top
    const pileMatch = (pile.topCards || []).filter(c => c.rank === rank && c.rank !== 'joker').length;
    // Hand selected + pile = 4?
    if (realSelected.length + pileMatch === 4) {
      return { rank, cardIds: selectedCards };
    }
    return null;
  })();

  return (
    <div className="game-screen">
      {/* Table area — parchment background with opponents and pile */}
      <div className="table-area">
        {/* Opponents around the table */}
        {opponents.map((opp, i) => (
          <Opponent key={opp.id} player={opp} position={positions[i] || 'top'} />
        ))}

        {/* Pile in center */}
        <div className="pile-area">
          {pile.isEmpty ? (
            <div className="pile-empty">
              <span>חבילה ריקה</span>
            </div>
          ) : (
            <div className="pile-cards">
              {pile.topCards.map((card, i) => (
                <Card key={card.id || i} card={card} small style={{ '--pile-i': i }} />
              ))}
            </div>
          )}
        </div>

        {/* Seven arrow indicator */}
        {sevenActive && <div className="seven-arrow">⬇</div>}

        {/* Status */}
        <div className={`status-bar ${isMyTurn ? 'status-myturn' : ''} ${sevenActive ? 'status-seven' : ''}`}>
          {statusText}
        </div>

        {/* Game log */}
        <GameLog log={log} />
      </div>

      {/* Hand section — wood arc + bottom bar */}
      <div className="hand-section">
        <div className="wood-arc">
          <div className="my-hand">
            {hand.map(card => (
              <Card
                key={card.id}
                card={card}
                selected={selectedCards.includes(card.id)}
                onClick={() => onToggleCard(card.id)}
                disabled={false}
              />
            ))}
          </div>
          <div className="hand-info">
            {hand.length} קלפים{isMyTurn ? ' • תורך!' : ''}
          </div>
        </div>

        <div className="bottom-bar">
          {/* Pass — always visible */}
          <button className="btn-wood btn-pass" onClick={onPass}
            disabled={!isMyTurn}>
            עבור
          </button>

          {/* Play — always visible */}
          <button className="btn-wood btn-play" onClick={onPlay}
            disabled={!canPlay}
            title={quantityHint || undefined}>
            {quantityHint || 'שים!'}
          </button>

          {/* Reset — always visible */}
          <button className="btn-wood btn-reset" onClick={onReset}
            disabled={!canReset}>
            איפוס ♻️
          </button>

          {/* Burst — lights up when player selects valid burst cards */}
          <button className="btn-burst" onClick={onBurstClick}
            disabled={!selectedBurst}>
            {selectedBurst
              ? `💥 רביעיית ${selectedBurst.rank}!`
              : '💥 התפרצות'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==================== MAIN APP ====================
export default function App() {
  const [screen, setScreen] = useState('home');
  const [myId, setMyId] = useState(null);
  const [roomCode, setRoomCode] = useState('');
  const [players, setPlayers] = useState([]);
  const [hostId, setHostId] = useState(null);
  const [gameState, setGameState] = useState(null);
  const [selectedCards, setSelectedCards] = useState([]);
  const [showJokerModal, setShowJokerModal] = useState(false);
  const [showBurstModal, setShowBurstModal] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const errorTimer = useRef(null);

  useEffect(() => {
    const session = getSession();
    if (session) {
      setIsReconnecting(true);
      socket.emit('join-room', {
        code: session.code,
        name: session.name,
        playerId: session.id,
      });
      setTimeout(() => setIsReconnecting(false), 3000);
    }
  }, []);

  useEffect(() => {
    socket.on('room-created', (data) => {
      setMyId(data.myId);
      setRoomCode(data.code);
      setPlayers(data.players);
      setHostId(data.hostId);
      setScreen('lobby');
      const myPlayer = data.players.find(p => p.id === data.myId);
      if (myPlayer) saveSession(data.code, myPlayer.name, data.myId);
    });

    socket.on('room-joined', (data) => {
      setMyId(data.myId);
      setRoomCode(data.code);
      setPlayers(data.players);
      setHostId(data.hostId);
      setIsReconnecting(false);
      if (data.reconnected && gameState) {
        setScreen('game');
      } else {
        setScreen('lobby');
      }
      const myPlayer = data.players.find(p => p.id === data.myId);
      if (myPlayer) saveSession(data.code, myPlayer.name, data.myId);
    });

    socket.on('lobby-update', (data) => {
      setPlayers(data.players);
      setHostId(data.hostId);
      setMyId(data.myId);
    });

    socket.on('game-state', (state) => {
      setGameState(state);
      setSelectedCards([]);
      setIsReconnecting(false);
      if (state.phase === 'playing' || state.phase === 'exchange' || state.phase === 'gameOver') {
        setScreen('game');
      }
    });

    socket.on('error-msg', ({ msg }) => {
      setErrorMsg(msg);
      setIsReconnecting(false);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setErrorMsg(''), 3000);
      if (msg === 'חדר לא נמצא') clearSession();
    });

    socket.on('disconnect', () => setIsReconnecting(true));
    socket.on('connect', () => {
      if (screen !== 'home') setIsReconnecting(false);
    });

    return () => {
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('lobby-update');
      socket.off('game-state');
      socket.off('error-msg');
      socket.off('disconnect');
      socket.off('connect');
    };
  }, []);

  const handleCreateRoom = useCallback((name) => {
    socket.emit('create-room', { name });
  }, []);

  const handleJoinRoom = useCallback((name, code) => {
    socket.emit('join-room', { code, name });
  }, []);

  const handleStartGame = useCallback(() => {
    socket.emit('start-game');
  }, []);

  const handleToggleCard = useCallback((cardId) => {
    setSelectedCards(prev =>
      prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]
    );
  }, []);

  const handlePlay = useCallback(() => {
    if (!gameState || selectedCards.length === 0) return;
    const selectedCardObjects = selectedCards.map(id =>
      gameState.hand.find(c => c.id === id)
    ).filter(Boolean);
    const hasJoker = selectedCardObjects.some(c => c.rank === 'joker');
    const realCards = selectedCardObjects.filter(c => c.rank !== 'joker');

    if (hasJoker) {
      if (realCards.length > 0) {
        socket.emit('play-cards', {
          cardIds: selectedCards,
          jokerChoice: { type: 'mirror', value: realCards[0].rank },
        });
      } else {
        setShowJokerModal(true);
      }
    } else {
      socket.emit('play-cards', { cardIds: selectedCards });
    }
  }, [selectedCards, gameState]);

  const handleJokerChoice = useCallback((choice) => {
    setShowJokerModal(false);
    if (!choice) return;
    socket.emit('play-cards', { cardIds: selectedCards, jokerChoice: choice });
  }, [selectedCards]);

  const handlePass = useCallback(() => socket.emit('pass'), []);
  const handleReset = useCallback(() => socket.emit('reset-pile'), []);

  const handleBurstClick = useCallback(() => {
    if (!gameState || selectedCards.length === 0) return;
    socket.emit('burst', { cardIds: selectedCards });
    setSelectedCards([]);
  }, [gameState, selectedCards]);

  const handleBurst = useCallback((cardIds) => {
    setShowBurstModal(false);
    socket.emit('burst', { cardIds });
  }, []);

  const handleExchangePick = useCallback((value) => {
    socket.emit('exchange-pick', { value });
  }, []);

  const handleExchangeGive = useCallback((cardIds) => {
    socket.emit('exchange-give', { cardIds });
    setSelectedCards([]);
  }, []);

  const handleRematch = useCallback(() => socket.emit('rematch'), []);

  const canJokerReset = gameState?.pile && !gameState.pile.isEmpty && gameState.pile.quantity === 1;

  return (
    <div className="app">
      {isReconnecting && screen !== 'home' && (
        <div className="reconnecting-overlay">
          <div className="reconnecting-msg">מתחבר מחדש...</div>
        </div>
      )}

      {errorMsg && <div className="error-toast">{errorMsg}</div>}

      {showJokerModal && (
        <JokerModal onChoice={handleJokerChoice} canReset={canJokerReset} />
      )}

      {showBurstModal && gameState && (
        <BurstModal
          bursts={gameState.possibleBursts}
          onBurst={handleBurst}
          onCancel={() => setShowBurstModal(false)}
        />
      )}

      {screen === 'home' && (
        <HomeScreen onCreateRoom={handleCreateRoom} onJoinRoom={handleJoinRoom} />
      )}

      {screen === 'lobby' && (
        <LobbyScreen
          code={roomCode}
          players={players}
          hostId={hostId}
          myId={myId}
          onStart={handleStartGame}
        />
      )}

      {screen === 'game' && gameState && (
        <>
          {gameState.phase === 'exchange' && (
            <ExchangeScreen
              gameState={gameState}
              selectedCards={selectedCards}
              onToggleCard={handleToggleCard}
              onExchangePick={handleExchangePick}
              onExchangeGive={handleExchangeGive}
            />
          )}
          {gameState.phase === 'playing' && (
            <GameScreenInner
              gameState={gameState}
              selectedCards={selectedCards}
              onToggleCard={handleToggleCard}
              onPlay={handlePlay}
              onPass={handlePass}
              onReset={handleReset}
              onBurstClick={handleBurstClick}
            />
          )}
          {gameState.phase === 'gameOver' && (
            <GameOverScreen
              gameState={gameState}
              isHost={myId === hostId}
              onRematch={handleRematch}
            />
          )}
        </>
      )}
    </div>
  );
}
