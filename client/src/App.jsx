import React, { useState, useEffect, useRef, useCallback } from 'react';
import socket, { saveSession, getSession, clearSession } from './socket';
import Card from './components/Card';
import { getPlayer, savePlayer, clearPlayer, getStats, updateStats, getSessions, addSession } from './utils/storage';

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
function HomeScreen({ player, setPlayer, nameInput, setNameInput, onCreateRoom, onJoinRoom, onOpenStats }) {
  const [joinCode, setJoinCode] = useState('');
  const [showInstallGuide, setShowInstallGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }
  }, []);

  return (
    <div className="screen home-screen fade-in">
      {player && (
        <button className="stats-btn" onClick={onOpenStats}>
          📊
        </button>
      )}
      {!isInstalled && (
        <button className="install-btn" onClick={() => setShowInstallGuide(true)}>
          📲
        </button>
      )}
      {showInstallGuide && (
        <div className="modal-overlay" onClick={() => setShowInstallGuide(false)}>
          <div className="install-modal" onClick={e => e.stopPropagation()}>
            <h3>התקן את שועה 📲</h3>
            <div className="install-steps">
              <div className="install-step">
                <span className="step-num">1</span>
                <span>לחץ על כפתור השיתוף</span>
                <span className="step-icon">⬆️</span>
              </div>
              <div className="install-step">
                <span className="step-num">2</span>
                <span>גלול למטה ולחץ</span>
                <span className="step-icon">➕🏠</span>
              </div>
              <div className="install-step">
                <span className="step-num">3</span>
                <span>לחץ "הוסף"</span>
                <span className="step-icon">✅</span>
              </div>
            </div>
            <div className="install-arrow">⬇</div>
            <p className="install-note">האפליקציה תופיע במסך הבית בלי דפדפן!</p>
            <button className="btn-secondary" onClick={() => setShowInstallGuide(false)}>
              הבנתי!
            </button>
          </div>
        </div>
      )}

      {player ? (
        <>
          <div className="home-top">
            <img src="/logo-clean.png" alt="שועה" className="home-logo" />
          </div>

          <div className="home-bottom">
            <p className="welcome-back">שלום {player.name}! 👋</p>

            <button className="btn-wood btn-large btn-fire" onClick={() => {
              onCreateRoom(player.name);
            }}>
              פתח חדר חדש
            </button>

            <div className="home-divider">— או הצטרף —</div>

            <div className="join-row">
              <input
                className="input-field input-code"
                placeholder="קוד"
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                maxLength={5}
              />
              <button className="btn-wood" onClick={() => {
                if (joinCode.trim().length >= 5) onJoinRoom(player.name, joinCode.trim());
              }}
                disabled={joinCode.trim().length < 5}
              >
                הצטרף
              </button>
            </div>

            <button className="change-name-btn" onClick={() => {
              clearPlayer();
              setPlayer(null);
            }}>
              שנה שם
            </button>
          </div>
        </>
      ) : (
        <>
          <div className="home-top">
            <img src="/logo-clean.png" alt="שועה" className="home-logo" />
          </div>

          <div className="home-bottom">
            <p className="home-subtitle">🍑 משחק הקלפים של ה"שועה" שלך!</p>

            <input
              className="input-field"
              placeholder="מה השם שלך?"
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              maxLength={12}
              autoFocus
            />
            <button
              className="btn-wood btn-large btn-fire"
              disabled={!nameInput.trim()}
              onClick={() => {
                const p = savePlayer(nameInput.trim());
                setPlayer(p);
              }}
            >
              יאללה! 🎴
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ==================== LOBBY SCREEN ====================
function LobbyScreen({ code, players, hostId, myId, onStart, onLeaveLobby }) {
  const isHost = myId === hostId;
  const canStart = isHost && players.length >= 2;

  return (
    <div className="screen lobby-screen fade-in">
      <button className="back-btn" onClick={onLeaveLobby}>&rarr; חזרה</button>
      {/* Persistent top bar */}
      <div className="top-bar">
        <span className="top-logo">שועה</span>
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

// ==================== DISCONNECT TIMER ====================
function DisconnectTimer({ disconnectTime }) {
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - disconnectTime) / 1000);
      const left = Math.max(0, 30 - elapsed);
      setRemaining(left);
    }, 1000);
    return () => clearInterval(interval);
  }, [disconnectTime]);

  return (
    <div className="disconnect-timer">
      ⏱️ {remaining}s
    </div>
  );
}

// ==================== OPPONENT COMPONENT ====================
function Opponent({ player, position, isShooa }) {
  const isActive = player.isCurrentTurn;
  const isFinished = player.finished;
  const cardCount = Math.min(player.cardCount, 15);
  const angleStep = Math.max(4, Math.min(7, 60 / (cardCount || 1)));
  const totalAngle = (cardCount - 1) * angleStep;
  const startAngle = -totalAngle / 2;

  return (
    <div className={`opponent opponent-${position} ${isActive ? 'opponent-active' : ''} ${isFinished ? 'opponent-finished' : ''} ${player.disconnected ? 'opponent-dc' : ''}`}>
      {!isFinished && cardCount > 0 && (
        <div className="opponent-fan">
          {Array.from({ length: cardCount }).map((_, i) => (
            <div
              key={i}
              className="fan-card"
              style={{
                transform: `rotate(${startAngle + i * angleStep}deg)`,
                zIndex: i,
              }}
            />
          ))}
        </div>
      )}
      <div className="opponent-info">
        <span className="opponent-name">
          {isShooa && <span className="shooa-marker">💩</span>}
          {player.name}
        </span>
        <span className="score-badge">{player.cardCount}</span>
        {isFinished && (
          <span className="finish-badge">
            {player.finishRank === 1 ? '👑' : player.finishRank === 2 ? '🥈' : player.finishRank === 3 ? '🥉' : `#${player.finishRank}`}
          </span>
        )}
      </div>
      {player.disconnected && player.disconnectTime && (
        <DisconnectTimer disconnectTime={player.disconnectTime} />
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
          <span className="log-icon">
            {entry.msg.includes('שורף') ? '🔥' :
             entry.msg.includes('רביעייה') ? '💥' :
             entry.msg.includes('היפוך') ? '🔄' :
             entry.msg.includes('עצור') ? '⛔' :
             entry.msg.includes('נדלג') ? '⛔' :
             entry.msg.includes('עבר') ? '👋' :
             entry.msg.includes('איפס') ? '♻️' :
             entry.msg.includes('סיים') ? '🏆' :
             '🃏'}
          </span>
          <span className="log-text">{entry.msg}</span>
        </div>
      ))}
    </div>
  );
}

// ==================== EXCHANGE SCREEN ====================
function ExchangeRankBadge({ myRank }) {
  if (!myRank) return null;
  return (
    <div className={`exchange-rank-badge rank-badge-${myRank.emoji === '👑' ? 'king' : myRank.emoji === '🥈' ? 'vice' : myRank.emoji === '💩' ? 'shooa' : 'vice-shooa'}`}>
      <span className="rank-emoji">{myRank.emoji}</span>
      <span className="rank-label">{myRank.label}</span>
    </div>
  );
}

function ExchangeScreen({ gameState, selectedCards, onToggleCard, onExchangePick, onExchangeGive }) {
  const { exchange, hand, myRank } = gameState;
  if (!exchange) return null;

  if (exchange.role === 'taker' && exchange.action === 'pick') {
    return (
      <div className="screen exchange-screen fade-in">
        <div className="exchange-panel">
          <ExchangeRankBadge myRank={myRank} />
          <h2 className="exchange-title">🔄 החלפת שועה</h2>
          <p className="exchange-desc">
            בחר {exchange.remaining} ערכ{exchange.remaining > 1 ? 'ים' : ''} מהיד של {exchange.partnerName}
          </p>
          <div className="value-grid">
            {exchange.values.map(v => (
              <button key={v} className={`btn-value btn-large${v === '2' ? ' btn-value-two' : ''}${v === 'joker' ? ' btn-value-joker' : ''}`} onClick={() => onExchangePick(v)}>
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
          <ExchangeRankBadge myRank={myRank} />
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
        <ExchangeRankBadge myRank={myRank} />
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
function GameOverScreen({ gameState, isHost, onRematch, onLeave }) {
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
        <button className="btn-wood btn-secondary" onClick={onLeave}>
          חזרה לבית
        </button>
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
function GameScreenInner({ gameState, selectedCards, onToggleCard, onPlay, onPass, onReset, onBurstClick, onLeave }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const {
    hand, opponents, pile, isMyTurn, canReset, sevenActive,
    possibleBursts, log, currentPlayerId, mustPlayThreeOfClubs, allPlayers, shooaPlayerId
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
  const isSingleJoker = selectedCount === 1 && hand.find(c => c.id === selectedCards[0])?.rank === 'joker';
  // Single joker bypasses quantity only on empty pile (mirror to open) or singles (mirror/reset)
  const jokerBypassQuantity = isSingleJoker && (pile.isEmpty || pileQuantity === 1);
  const quantityMismatch = !pile.isEmpty && pileQuantity > 0 && selectedCount > 0
    && selectedCount !== pileQuantity && !isResetCard && !jokerBypassQuantity;
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
    const pileMatch = (pile.allCards || pile.topCards || []).filter(c => c.rank === rank && c.rank !== 'joker').length;
    // Hand selected + pile = 4?
    if (realSelected.length + pileMatch === 4) {
      return { rank, cardIds: selectedCards };
    }
    return null;
  })();

  return (
    <div className="game-screen">
      {/* Menu dropdown */}
      <div className="menu-container">
        <button className="btn-wood btn-small" onClick={() => setMenuOpen(prev => !prev)}>
          &#9776;
        </button>
        {menuOpen && (
          <div className="menu-dropdown">
            <button onClick={() => { setMenuOpen(false); setShowLeaveConfirm(true); }}>
              יציאה מהמשחק
            </button>
          </div>
        )}
      </div>

      {/* Leave confirmation modal */}
      {showLeaveConfirm && (
        <div className="modal-overlay" onClick={() => setShowLeaveConfirm(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>בטוח שאתה רוצה לעזוב?</h3>
            <p>הקלפים שלך יזרקו והמשחק ימשיך בלעדיך</p>
            <div style={{ display: 'flex', gap: 'var(--gap-md)', justifyContent: 'center' }}>
              <button className="btn-danger" onClick={() => { setShowLeaveConfirm(false); onLeave(); }}>
                כן, יוצא
              </button>
              <button className="btn-secondary" onClick={() => setShowLeaveConfirm(false)}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Table area — parchment background with opponents and pile */}
      <div className="table-area">
        {/* Opponents around the table */}
        {opponents.map((opp, i) => (
          <Opponent key={opp.id} player={opp} position={positions[i] || 'top'} isShooa={opp.id === shooaPlayerId} />
        ))}

        {/* Pile + Deck in center */}
        <div className="pile-area">
          {/* Closed deck — always visible */}
          <div className="deck-stack">
            <div className="deck-card" />
            <div className="deck-card" />
            <div className="deck-card" />
            <span className="deck-label">שועה</span>
          </div>

          {/* Played cards pile */}
          {pile.isEmpty ? (
            <div className="pile-empty-shadow" />
          ) : (
            <div className="pile-stack">
              {/* Previous cards — allCards minus the current topCards */}
              {(() => {
                const prevCards = (pile.allCards || []).slice(0, -((pile.topCards || []).length || 1));
                const shown = prevCards.slice(-4);
                return shown.length > 0 && (
                  <div className="pile-previous">
                    {shown.map((card, i) => (
                      <div key={card.id || `prev-${i}`} className="pile-card-wrapper"
                        style={{
                          '--pile-z': i,
                          '--pile-rot': `${((i * 17 + 3) % 17) - 8}deg`,
                          '--pile-x': `${((i * 7 + 2) % 7) - 3}px`,
                          '--pile-y': `${((i * 5 + 1) % 5) - 2}px`,
                        }}>
                        <Card card={card} small />
                      </div>
                    ))}
                  </div>
                );
              })()}
              {/* Current play — topCards side by side */}
              <div className="pile-current">
                {(pile.topCards || []).map((card, i) => (
                  <div key={card.id || `top-${i}`} className="pile-card-wrapper"
                    style={{
                      '--pile-z': 10 + i,
                      '--pile-rot': `${((i * 13 + 5) % 7) - 3}deg`,
                    }}>
                    <Card card={card} small />
                  </div>
                ))}
              </div>
              {/* Quantity label for pairs/triples */}
              {pile.quantity > 1 && (
                <div className="pile-quantity-label">
                  {pile.quantity === 2 ? 'זוג' : 'שלישיית'} {RANK_LABELS[pile.topRank] || pile.topRank}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Seven arrow indicator */}
        {sevenActive && <div className="seven-arrow">⬇</div>}

        {/* Status */}
        <div className={`turn-status ${isMyTurn ? 'my-turn' : ''} ${sevenActive ? 'seven-mode' : ''}`}>
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
          {possibleBursts.length > 0 && (
            <button className={`btn-burst ${selectedBurst ? 'burst-ready' : 'burst-available'}`}
              onClick={onBurstClick}
              disabled={!selectedBurst}>
              {selectedBurst
                ? `💥 רביעיית ${selectedBurst.rank}!`
                : `💥 רביעיית ${possibleBursts[0]?.rank}`}
            </button>
          )}
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

  const [player, setPlayer] = useState(getPlayer());
  const [nameInput, setNameInput] = useState('');
  const [sideMenuOpen, setSideMenuOpen] = useState(false);
  const [gameOverSaved, setGameOverSaved] = useState(false);
  const [cachedStats, setCachedStats] = useState(() => getStats());
  const [cachedSessions, setCachedSessions] = useState(() => getSessions());
  const [actionPending, setActionPending] = useState(false);

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
      setSelectedCards(prev =>
        prev.filter(id => state.hand.some(c => c.id === id))
      );
      setIsReconnecting(false);
      setActionPending(false);
      if (state.phase === 'playing' || state.phase === 'exchange' || state.phase === 'gameOver') {
        setScreen('game');
      }
    });

    socket.on('error-msg', ({ msg }) => {
      setErrorMsg(msg);
      setIsReconnecting(false);
      setActionPending(false);
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

  useEffect(() => {
    if (gameState?.phase === 'gameOver' && !gameOverSaved) {
      const allPlayers = gameState.allPlayers || [];
      const totalPlayers = allPlayers.length;
      const myFinishIdx = allPlayers.findIndex(p => p.isMe);
      const myRank = myFinishIdx !== -1 ? (allPlayers[myFinishIdx].finishRank || myFinishIdx + 1) : totalPlayers;
      const isShua = myRank === totalPlayers;
      const isSecondShua = myRank === totalPlayers - 1 && totalPlayers >= 4;

      updateStats({
        rank: myRank,
        isShua,
        isSecondShua,
        bursts: gameState.myBursts || 0,
        burns: gameState.myBurns || 0,
      });

      addSession({
        id: `game-${Date.now()}`,
        date: Date.now(),
        players: allPlayers.map(p => p.name),
        results: allPlayers
          .filter(p => p.finishRank)
          .sort((a, b) => a.finishRank - b.finishRank)
          .map(p => ({
            name: p.name,
            rank: p.finishRank,
            title: p.finishRank === 1 ? 'מלך' :
                   p.finishRank === totalPlayers ? 'שועה' :
                   (p.finishRank === totalPlayers - 1 && totalPlayers >= 4) ? 'סקנד שועה' : '',
          })),
        myRank,
        myBursts: gameState.myBursts || 0,
        myBurns: gameState.myBurns || 0,
        roomCode: roomCode,
      });

      setCachedStats(getStats());
      setCachedSessions(getSessions());
      setGameOverSaved(true);
    }
  }, [gameState?.phase]);

  useEffect(() => {
    if (gameState?.phase === 'playing') {
      setGameOverSaved(false);
    }
  }, [gameState?.phase]);

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
    if (actionPending) return;
    if (!gameState || selectedCards.length === 0) return;
    const selectedCardObjects = selectedCards.map(id =>
      gameState.hand.find(c => c.id === id)
    ).filter(Boolean);
    const hasJoker = selectedCardObjects.some(c => c.rank === 'joker');
    const realCards = selectedCardObjects.filter(c => c.rank !== 'joker');

    if (hasJoker) {
      if (realCards.length > 0) {
        setActionPending(true);
        socket.emit('play-cards', {
          cardIds: selectedCards,
          jokerChoice: { type: 'mirror', value: realCards[0].rank },
        });
      } else {
        setShowJokerModal(true);
      }
    } else {
      setActionPending(true);
      socket.emit('play-cards', { cardIds: selectedCards });
    }
  }, [selectedCards, gameState, actionPending]);

  const handleJokerChoice = useCallback((choice) => {
    setShowJokerModal(false);
    if (!choice) return;
    setActionPending(true);
    socket.emit('play-cards', { cardIds: selectedCards, jokerChoice: choice });
  }, [selectedCards]);

  const handlePass = useCallback(() => {
    if (actionPending) return;
    setActionPending(true);
    socket.emit('pass');
  }, [actionPending]);
  const handleReset = useCallback(() => {
    if (actionPending) return;
    setActionPending(true);
    socket.emit('reset-pile');
  }, [actionPending]);

  const handleBurstClick = useCallback(() => {
    if (actionPending) return;
    if (!gameState || selectedCards.length === 0) return;
    setActionPending(true);
    socket.emit('burst', { cardIds: selectedCards });
  }, [gameState, selectedCards, actionPending]);

  const handleBurst = useCallback((cardIds) => {
    setShowBurstModal(false);
    socket.emit('burst', { cardIds });
  }, []);

  const handleExchangePick = useCallback((value) => {
    socket.emit('exchange-pick', { value });
  }, []);

  const handleExchangeGive = useCallback((cardIds) => {
    socket.emit('exchange-give', { cardIds });
  }, []);

  const handleRematch = useCallback(() => socket.emit('rematch'), []);

  const handleLeave = useCallback(() => {
    socket.emit('leave-room');
    setGameState(null);
    setRoomCode('');
    setPlayers([]);
    setSelectedCards([]);
    setScreen('home');
    clearSession();
  }, []);

  const handleLeaveLobby = useCallback(() => {
    socket.emit('leave-room');
    setRoomCode('');
    setPlayers([]);
    setScreen('home');
    clearSession();
  }, []);

  // Joker reset: pile must have singles (not empty, quantity 1) and exactly 1 card selected
  const canJokerReset = gameState?.pile?.topRank != null && gameState.pile.quantity === 1 && selectedCards.length === 1;

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

      {sideMenuOpen && (
        <div className="side-menu-overlay" onClick={() => setSideMenuOpen(false)}>
          <div className="side-menu" onClick={e => e.stopPropagation()}>
            <button className="side-menu-close" onClick={() => setSideMenuOpen(false)}>✕</button>

            <h2 className="side-menu-title">📊 הסטטיסטיקות שלי</h2>
            <p className="side-menu-player">{player?.name}</p>

            <div className="stats-grid">
              <div className="stat-card">
                <span className="stat-value">{cachedStats.totalGames}</span>
                <span className="stat-label">משחקים</span>
              </div>
              <div className="stat-card gold">
                <span className="stat-value">{cachedStats.wins} 👑</span>
                <span className="stat-label">נצחונות</span>
              </div>
              <div className="stat-card red">
                <span className="stat-value">{cachedStats.spiked} 🍑</span>
                <span className="stat-label">שועה</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{cachedStats.second} 🥈</span>
                <span className="stat-label">מקום שני</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{cachedStats.totalBursts} 💥</span>
                <span className="stat-label">רביעיות</span>
              </div>
              <div className="stat-card">
                <span className="stat-value">{cachedStats.totalBurns} 🔥</span>
                <span className="stat-label">שריפות</span>
              </div>
            </div>

            {cachedStats.totalGames > 0 && (
              <div className="stats-percentages">
                <p>אחוז נצחון: <strong>{Math.round(cachedStats.wins / cachedStats.totalGames * 100)}%</strong></p>
                <p>אחוז שועה: <strong>{Math.round(cachedStats.spiked / cachedStats.totalGames * 100)}%</strong></p>
              </div>
            )}

            <div className="side-menu-divider" />

            <h3 className="sessions-title">📜 משחקים אחרונים</h3>
            <div className="sessions-list">
              {cachedSessions.map(session => (
                <div key={session.id} className="session-card">
                  <div className="session-header">
                    <span className="session-date">
                      {new Date(session.date).toLocaleDateString('he-IL', {
                        day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit'
                      })}
                    </span>
                    <span className="session-rank">
                      {session.myRank === 1 ? '👑' :
                       session.myRank === session.results.length ? '🍑' :
                       `#${session.myRank}`}
                    </span>
                  </div>
                  <div className="session-players">
                    {session.results.map((r, i) => (
                      <span
                        key={i}
                        className={`session-player ${r.rank === 1 ? 'gold' : r.title === 'שועה' ? 'red' : ''}`}
                      >
                        {r.rank === 1 ? '👑' : r.title === 'שועה' ? '🍑' : `${r.rank}.`} {r.name}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              {cachedSessions.length === 0 && (
                <p className="no-sessions">עוד לא שיחקת! 🃏</p>
              )}
            </div>
          </div>
        </div>
      )}

      {screen === 'home' && (
        <HomeScreen
          player={player}
          setPlayer={setPlayer}
          nameInput={nameInput}
          setNameInput={setNameInput}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onOpenStats={() => { setCachedStats(getStats()); setCachedSessions(getSessions()); setSideMenuOpen(true); }}
        />
      )}

      {screen === 'lobby' && (
        <LobbyScreen
          code={roomCode}
          players={players}
          hostId={hostId}
          myId={myId}
          onStart={handleStartGame}
          onLeaveLobby={handleLeaveLobby}
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
              onLeave={handleLeave}
            />
          )}
          {gameState.phase === 'gameOver' && (
            <GameOverScreen
              gameState={gameState}
              isHost={myId === hostId}
              onRematch={handleRematch}
              onLeave={handleLeave}
            />
          )}
        </>
      )}
    </div>
  );
}
