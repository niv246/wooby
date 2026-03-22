import React from 'react';

const SUIT_SYMBOLS = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

const RANK_DISPLAY = {
  '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
  '7': '7', '8': '8', '9': '9', '10': '10',
  J: 'J', Q: 'Q', K: 'K', A: 'A',
};

// Traditional playing card pip positions (percentage-based)
// x/y are percentages within the pip area
const PIP_LAYOUTS = {
  'A': [{ x: 50, y: 50, large: true }],
  '2': [
    { x: 50, y: 12 },
    { x: 50, y: 88, flip: true },
  ],
  '3': [
    { x: 50, y: 12 },
    { x: 50, y: 50 },
    { x: 50, y: 88, flip: true },
  ],
  '4': [
    { x: 30, y: 12 }, { x: 70, y: 12 },
    { x: 30, y: 88, flip: true }, { x: 70, y: 88, flip: true },
  ],
  '5': [
    { x: 30, y: 12 }, { x: 70, y: 12 },
    { x: 50, y: 50 },
    { x: 30, y: 88, flip: true }, { x: 70, y: 88, flip: true },
  ],
  '6': [
    { x: 30, y: 12 }, { x: 70, y: 12 },
    { x: 30, y: 50 }, { x: 70, y: 50 },
    { x: 30, y: 88, flip: true }, { x: 70, y: 88, flip: true },
  ],
  '7': [
    { x: 30, y: 12 }, { x: 70, y: 12 },
    { x: 50, y: 32 },
    { x: 30, y: 50 }, { x: 70, y: 50 },
    { x: 30, y: 88, flip: true }, { x: 70, y: 88, flip: true },
  ],
  '8': [
    { x: 30, y: 12 }, { x: 70, y: 12 },
    { x: 50, y: 32 },
    { x: 30, y: 50 }, { x: 70, y: 50 },
    { x: 50, y: 68, flip: true },
    { x: 30, y: 88, flip: true }, { x: 70, y: 88, flip: true },
  ],
  '9': [
    { x: 30, y: 10 }, { x: 70, y: 10 },
    { x: 30, y: 35 }, { x: 70, y: 35 },
    { x: 50, y: 50 },
    { x: 30, y: 65, flip: true }, { x: 70, y: 65, flip: true },
    { x: 30, y: 90, flip: true }, { x: 70, y: 90, flip: true },
  ],
  '10': [
    { x: 30, y: 10 }, { x: 70, y: 10 },
    { x: 50, y: 24 },
    { x: 30, y: 35 }, { x: 70, y: 35 },
    { x: 30, y: 65, flip: true }, { x: 70, y: 65, flip: true },
    { x: 50, y: 76, flip: true },
    { x: 30, y: 90, flip: true }, { x: 70, y: 90, flip: true },
  ],
};

export default function Card({ card, selected, onClick, small, faceDown, disabled }) {
  if (faceDown) {
    return (
      <div className={`card card-back ${small ? 'card-small' : ''}`}>
        <div className="card-back-inner">
          <div className="card-back-pattern"></div>
          <span className="card-back-logo">W</span>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const isJoker = card.rank === 'joker';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';
  const isFace = ['J', 'Q', 'K'].includes(card.rank);

  const classes = [
    'card',
    selected && 'card-selected',
    small && 'card-small',
    disabled && 'card-disabled',
    isJoker && 'card-joker',
    !isJoker && (isRed ? 'card-red' : 'card-black'),
  ].filter(Boolean).join(' ');

  if (isJoker) {
    return (
      <div className={classes} onClick={disabled ? undefined : onClick}>
        <div className="card-inner">
          <div className="card-corner">
            <span className="card-rank joker-star">★</span>
          </div>
          <div className="card-body">
            <span className="card-joker-text">J<br/>O<br/>K<br/>E<br/>R</span>
          </div>
          <div className="card-corner card-corner-bottom">
            <span className="card-rank joker-star">★</span>
          </div>
        </div>
      </div>
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit] || '';
  const display = RANK_DISPLAY[card.rank] || card.rank;
  const pipLayout = PIP_LAYOUTS[card.rank];

  return (
    <div className={classes} onClick={disabled ? undefined : onClick}>
      <div className="card-inner">
        <div className="card-corner">
          <span className="card-rank">{display}</span>
          <span className="card-suit">{symbol}</span>
        </div>
        <div className="card-body">
          {isFace ? (
            <div className="card-face">
              <span className="card-face-suit">{symbol}</span>
              <span className="card-face-letter">{display}</span>
              <span className="card-face-suit card-face-suit-bottom">{symbol}</span>
            </div>
          ) : pipLayout ? (
            pipLayout.map((pip, i) => (
              <span
                key={i}
                className={`card-pip${pip.flip ? ' card-pip-flip' : ''}${pip.large ? ' card-pip-large' : ''}`}
                style={{ left: `${pip.x}%`, top: `${pip.y}%` }}
              >
                {symbol}
              </span>
            ))
          ) : (
            <span className="card-center-suit">{symbol}</span>
          )}
        </div>
        <div className="card-corner card-corner-bottom">
          <span className="card-rank">{display}</span>
          <span className="card-suit">{symbol}</span>
        </div>
      </div>
    </div>
  );
}
