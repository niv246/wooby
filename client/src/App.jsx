import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket from './socket';
import Card from './components/Card';

const RANK_LABELS = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6', '7': '7',
  '8': '8', '9': '9', '10': '10', J: 'J', Q: 'Q', K: 'K', A: 'A',
  joker: '🃏',
};

// ==================== HOME SCREEN ====================
function HomeScreen({ onCreateRoom, onJoinRoom }) {
  const [name, setName] = useState('');
  const [joinCode, setJoinCode] = useState('');

  return (
    <div className="screen home-screen">
      <div className="logo-container">
        <h1 className="logo">וובי</h1>
        <p className="subtitle">משחק הקלפים הכי מבאס 🃏</p>
      </div>

      <div className="home-form">
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
          className="btn btn-primary btn-large"
          onClick={() => name.trim() && onCreateRoom(name.trim())}
          disabled={!name.trim()}
        >
          פתח חדר חדש
        </button>

        <div className="divider">
          <span>או הצטרף לחדר</span>
        </div>

        <input
          className="input-field input-code"
          type="text"
          placeholder="קוד חדר"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          maxLength={5}
        />

        <button
          className="btn btn-secondary"
          onClick={() => name.trim() && joinCode.trim() && onJoinRoom(name.trim(), joinCode.trim())}
          disabled={!name.trim() || joinCode.trim().length < 5}
        >
          הצטרף
        </button>
      </div>
    </div>
  );
}

// ==================== LOBBY SCREEN ====================
function LobbyScreen({ code, players, hostId, myId, onStart }) {
  const isHost = myId === hostId;
  const canStart = isHost && players.length >= 2;

  return (
    <div className="screen lobby-screen">
      <h2 className="lobby-title">ממתינים לשחקנים...</h2>

      <div className="room-code-display">
        <span className="room-code-label">קוד חדר</span>
        <span className="room-code">{code}</span>
        <button
          className="btn btn-small"
          onClick={() => navigator.clipboard?.writeText(code)}
        >
          העתק
        </button>
      </div>

      <div className="players-list">
        {players.map(p => (
          <div key={p.id} className={`player-chip ${!p.connected ? 'disconnected' : ''}`}>
            {p.id === hostId && <span className="host-crown">👑</span>}
            <span>{p.name}</span>
            {!p.connected && <span className="dc-badge">מנותק</span>}
          </div>
        ))}
      </div>

      <div className="lobby-info">
        {players.length}/6 שחקנים
      </div>

      {isHost && (
        <button
          className="btn btn-primary btn-large btn-start"
          onClick={onStart}
          disabled={!canStart}
        >
          יאללה! 🎯
        </button>
      )}
      {!isHost && (
        <p className="waiting-text">ממתינים למארח...</p>
      )}
    </div>
  );
}

// ==================== JOKER MODAL ====================
function JokerModal({ onChoice, canReset }) {
  const [mode, setMode] = useState(null); // null, 'mirror'
  const values = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

  if (mode === 'mirror') {
    return (
      <div className="modal-overlay">
        <div className="modal joker-modal">
          <h3>בחר ערך לג׳וקר</h3>
          <div className="value-grid">
            {values.map(v => (
              <button
                key={v}
                className="btn btn-value"
                onClick={() => onChoice({ type: 'mirror', value: v })}
              >
                {v}
              </button>
            ))}
          </div>
          <button className="btn btn-cancel" onClick={() => setMode(null)}>חזרה</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal joker-modal">
        <h3>מה הג׳וקר עושה?</h3>
        <button className="btn btn-primary" onClick={() => setMode('mirror')}>
          מראה — בחר ערך
        </button>
        {canReset && (
          <button className="btn btn-danger" onClick={() => onChoice({ type: 'reset' })}>
            איפוס 🔥
          </button>
        )}
        <button className="btn btn-cancel" onClick={() => onChoice(null)}>ביטול</button>
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
          <h3>רביעייה! 💥</h3>
          <p>רביעיית {bursts[0].rank}</p>
          <button className="btn btn-danger btn-large" onClick={() => onBurst(bursts[0].cardIds)}>
            פריצה! 💥
          </button>
          <button className="btn btn-cancel" onClick={onCancel}>ביטול</button>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal burst-modal">
        <h3>בחר רביעייה 💥</h3>
        {bursts.map((b, i) => (
          <button key={i} className="btn btn-danger" onClick={() => onBurst(b.cardIds)}>
            רביעיית {b.rank} ({b.type === 'hand' ? 'מהיד' : 'השלמה'})
          </button>
        ))}
        <button className="btn btn-cancel" onClick={onCancel}>ביטול</button>
      </div>
    </div>
  );
}

// ==================== EXCHANGE SCREEN ====================
function ExchangeScreen({ gameState, selectedCards, onToggleCard, onExchangePick, onExchangeGive }) {
  const { exchange, hand } = gameState;
  if (!exchange) return null;

  if (exchange.role === 'taker' && exchange.action === 'pick') {
    return (
      <div className="screen exchange-screen">
        <h2>החלפת שועה 🍑</h2>
        <p>בחר {exchange.remaining} ערכ{exchange.remaining > 1 ? 'ים' : ''} מהיד של {exchange.partnerName}</p>
        <div className="value-grid">
          {exchange.values.map(v => (
            <button key={v} className="btn btn-value btn-large" onClick={() => onExchangePick(v)}>
              {RANK_LABELS[v] || v}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (exchange.role === 'taker' && exchange.action === 'give') {
    return (
      <div className="screen exchange-screen">
        <h2>החלפת שועה 🍑</h2>
        <p>בחר {exchange.count} קלפים לתת ל{exchange.partnerName}</p>
        <div className="hand-area exchange-hand">
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
          className="btn btn-primary btn-large"
          onClick={() => onExchangeGive(selectedCards)}
          disabled={selectedCards.length !== exchange.count}
        >
          שלח קלפים
        </button>
      </div>
    );
  }

  // Giver or spectator
  return (
    <div className="screen exchange-screen">
      <h2>החלפת שועה 🍑</h2>
      <p className="waiting-text">ממתינים להחלפה...</p>
      <div className="hand-area">
        {hand.map(card => (
          <Card key={card.id} card={card} />
        ))}
      </div>
    </div>
  );
}

// ==================== GAME OVER SCREEN ====================
function GameOverScreen({ gameState, isHost, onRematch }) {
  const { finishOrder } = gameState;
  const rankEmojis = ['👑', '🥈', '🥉', '4️⃣', '5️⃣', '🍑'];

  return (
    <div className="screen gameover-screen">
      <div className="gameover-emoji">🍑</div>
      <h2 className="gameover-title">סוף המשחק!</h2>

      <div className="rankings">
        {finishOrder.map((p, i) => {
          const isLast = i === finishOrder.length - 1;
          const emoji = isLast && finishOrder.length > 1 ? '🍑' : (rankEmojis[i] || `#${i + 1}`);
          return (
            <div key={p.id} className={`rank-row ${isLast && finishOrder.length > 1 ? 'rank-shooa' : ''}`}>
              <span className="rank-emoji">{emoji}</span>
              <span className="rank-name">{p.name}</span>
              {isLast && finishOrder.length > 1 && <span className="shooa-label">שועה!</span>}
            </div>
          );
        })}
      </div>

      {isHost && (
        <button className="btn btn-primary btn-large" onClick={onRematch}>
          עוד סיבוב! 🔄
        </button>
      )}
      {!isHost && (
        <p className="waiting-text">ממתינים למארח...</p>
      )}
    </div>
  );
}

// ==================== GAME SCREEN ====================
function GameScreenInner({ gameState, selectedCards, onToggleCard, onPlay, onPass, onReset, onBurstClick }) {
  const {
    hand, opponents, pile, isMyTurn, canReset, sevenActive,
    possibleBursts, log, currentPlayerId, mustPlayThreeOfClubs
  } = gameState;

  const currentOpponent = opponents.find(o => o.id === currentPlayerId);
  const statusText = isMyTurn
    ? (sevenActive ? 'מתחת ל-7! 🔄' : (mustPlayThreeOfClubs ? 'שים 3♣!' : 'התור שלך!'))
    : (currentOpponent ? `התור של ${currentOpponent.name}` : '');

  return (
    <div className="game-screen">
      {/* Opponents */}
      <div className="opponents-bar">
        {opponents.map(opp => (
          <div
            key={opp.id}
            className={`opponent ${opp.isCurrentTurn ? 'opponent-active' : ''} ${opp.finished ? 'opponent-finished' : ''} ${opp.disconnected ? 'opponent-dc' : ''}`}
          >
            <span className="opponent-name">{opp.name}</span>
            {opp.finished ? (
              <span className="opponent-rank">
                {opp.finishRank === gameState.finishOrder.length ? '🍑' : `#${opp.finishRank}`}
              </span>
            ) : (
              <span className="opponent-cards">{opp.cardCount} 🃏</span>
            )}
          </div>
        ))}
      </div>

      {/* Status */}
      <div className={`status-bar ${isMyTurn ? 'status-myturn' : ''} ${sevenActive ? 'status-seven' : ''}`}>
        {statusText}
      </div>

      {/* Pile */}
      <div className="pile-area">
        {pile.isEmpty ? (
          <div className="pile-empty">
            <span>חבילה ריקה</span>
          </div>
        ) : (
          <div className="pile-cards">
            {pile.topCards.map((card, i) => (
              <Card key={card.id || i} card={card} small />
            ))}
          </div>
        )}
      </div>

      {/* Log */}
      <div className="log-area">
        {log.map((entry, i) => (
          <div key={i} className="log-entry">{entry.msg}</div>
        ))}
      </div>

      {/* Actions */}
      <div className="actions-bar">
        {isMyTurn && selectedCards.length > 0 && (
          <button className="btn btn-primary" onClick={onPlay}>
            !שים
          </button>
        )}
        {isMyTurn && (
          <button className="btn btn-secondary" onClick={onPass}>
            עבור
          </button>
        )}
        {canReset && (
          <button className="btn btn-warning" onClick={onReset}>
            איפוס 🔄
          </button>
        )}
        {possibleBursts.length > 0 && (
          <button className="btn btn-burst" onClick={onBurstClick}>
            💥 רביעייה!
          </button>
        )}
      </div>

      {/* Hand */}
      <div className="hand-area">
        {hand.map((card, i) => (
          <Card
            key={card.id}
            card={card}
            selected={selectedCards.includes(card.id)}
            onClick={() => onToggleCard(card.id)}
            disabled={!isMyTurn && possibleBursts.length === 0}
          />
        ))}
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
  const errorTimer = useRef(null);

  // Socket event handlers
  useEffect(() => {
    socket.on('room-created', (data) => {
      setMyId(data.myId);
      setRoomCode(data.code);
      setPlayers(data.players);
      setHostId(data.hostId);
      setScreen('lobby');
    });

    socket.on('room-joined', (data) => {
      setMyId(data.myId);
      setRoomCode(data.code);
      setPlayers(data.players);
      setHostId(data.hostId);
      if (data.reconnected && gameState) {
        setScreen('game');
      } else {
        setScreen('lobby');
      }
    });

    socket.on('lobby-update', (data) => {
      setPlayers(data.players);
      setHostId(data.hostId);
      setMyId(data.myId);
    });

    socket.on('game-state', (state) => {
      setGameState(state);
      setSelectedCards([]);
      if (state.phase === 'playing' || state.phase === 'exchange' || state.phase === 'gameOver') {
        setScreen('game');
      }
    });

    socket.on('error-msg', ({ msg }) => {
      setErrorMsg(msg);
      if (errorTimer.current) clearTimeout(errorTimer.current);
      errorTimer.current = setTimeout(() => setErrorMsg(''), 3000);
    });

    return () => {
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('lobby-update');
      socket.off('game-state');
      socket.off('error-msg');
    };
  }, []);

  // Handlers
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
      prev.includes(cardId)
        ? prev.filter(id => id !== cardId)
        : [...prev, cardId]
    );
  }, []);

  const handlePlay = useCallback(() => {
    if (!gameState || selectedCards.length === 0) return;

    // Check if any selected card is a joker
    const selectedCardObjects = selectedCards.map(id =>
      gameState.hand.find(c => c.id === id)
    ).filter(Boolean);

    const hasJoker = selectedCardObjects.some(c => c.rank === 'joker');
    const allJokers = selectedCardObjects.every(c => c.rank === 'joker');
    const realCards = selectedCardObjects.filter(c => c.rank !== 'joker');

    if (hasJoker) {
      // If joker with real cards, auto-infer mirror value
      if (realCards.length > 0) {
        const mirrorRank = realCards[0].rank;
        socket.emit('play-cards', {
          cardIds: selectedCards,
          jokerChoice: { type: 'mirror', value: mirrorRank },
        });
      } else {
        // All jokers or single joker — need choice
        setShowJokerModal(true);
      }
    } else {
      socket.emit('play-cards', { cardIds: selectedCards });
    }
  }, [selectedCards, gameState]);

  const handleJokerChoice = useCallback((choice) => {
    setShowJokerModal(false);
    if (!choice) return; // cancelled
    socket.emit('play-cards', {
      cardIds: selectedCards,
      jokerChoice: choice,
    });
  }, [selectedCards]);

  const handlePass = useCallback(() => {
    socket.emit('pass');
  }, []);

  const handleReset = useCallback(() => {
    socket.emit('reset-pile');
  }, []);

  const handleBurstClick = useCallback(() => {
    if (!gameState) return;
    if (gameState.possibleBursts.length === 1) {
      socket.emit('burst', { cardIds: gameState.possibleBursts[0].cardIds });
    } else {
      setShowBurstModal(true);
    }
  }, [gameState]);

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

  const handleRematch = useCallback(() => {
    socket.emit('rematch');
  }, []);

  // Can joker reset? (pile not empty, pile quantity is 1)
  const canJokerReset = gameState?.pile && !gameState.pile.isEmpty && gameState.pile.quantity === 1;

  // Render
  return (
    <div className="app">
      {/* Error toast */}
      {errorMsg && (
        <div className="error-toast">{errorMsg}</div>
      )}

      {/* Joker modal */}
      {showJokerModal && (
        <JokerModal onChoice={handleJokerChoice} canReset={canJokerReset} />
      )}

      {/* Burst modal */}
      {showBurstModal && gameState && (
        <BurstModal
          bursts={gameState.possibleBursts}
          onBurst={handleBurst}
          onCancel={() => setShowBurstModal(false)}
        />
      )}

      {/* Screens */}
      {screen === 'home' && (
        <HomeScreen
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
        />
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
