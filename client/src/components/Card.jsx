import React from 'react';

const SUIT_SYMBOLS = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const SUIT_COLORS = {
  clubs: '#1a1a2e',
  diamonds: '#e74c3c',
  hearts: '#e74c3c',
  spades: '#1a1a2e',
};

const RANK_DISPLAY = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', '10': '10',
  J: 'J', Q: 'Q', K: 'K', A: 'A',
};

export default function Card({ card, selected, onClick, small, faceDown, disabled }) {
  if (faceDown) {
    return (
      <div
        className={`card card-back ${small ? 'card-small' : ''}`}
        style={{
          background: 'linear-gradient(135deg, #1a3a5c, #0d2137)',
          border: '2px solid #f5c542',
        }}
      >
        <span className="card-back-icon">🃏</span>
      </div>
    );
  }

  if (!card) return null;

  const isJoker = card.rank === 'joker';

  if (isJoker) {
    return (
      <div
        className={`card card-joker ${selected ? 'card-selected' : ''} ${small ? 'card-small' : ''} ${disabled ? 'card-disabled' : ''}`}
        onClick={disabled ? undefined : onClick}
      >
        <div className="card-corner">
          <span className="card-rank" style={{ color: '#f5c542' }}>★</span>
        </div>
        <div className="card-center">
          <span className="joker-emoji">🃏</span>
        </div>
        <div className="card-corner card-corner-bottom">
          <span className="card-rank" style={{ color: '#f5c542' }}>★</span>
        </div>
      </div>
    );
  }

  const suit = card.suit;
  const rank = card.rank;
  const color = SUIT_COLORS[suit] || '#1a1a2e';
  const symbol = SUIT_SYMBOLS[suit] || '';
  const display = RANK_DISPLAY[rank] || rank;

  return (
    <div
      className={`card ${selected ? 'card-selected' : ''} ${small ? 'card-small' : ''} ${disabled ? 'card-disabled' : ''}`}
      onClick={disabled ? undefined : onClick}
    >
      <div className="card-corner">
        <span className="card-rank" style={{ color }}>{display}</span>
        <span className="card-suit" style={{ color }}>{symbol}</span>
      </div>
      <div className="card-center">
        <span className="card-center-suit" style={{ color }}>{symbol}</span>
      </div>
      <div className="card-corner card-corner-bottom">
        <span className="card-rank" style={{ color }}>{display}</span>
        <span className="card-suit" style={{ color }}>{symbol}</span>
      </div>
    </div>
  );
}
