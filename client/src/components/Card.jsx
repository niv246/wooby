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

export default React.memo(function Card({ card, selected, onClick, small, faceDown, disabled, style }) {
  if (faceDown) {
    return (
      <div className={`card card-back ${small ? 'card-small' : ''}`} style={style}>
        <div className="card-back-inner">
          <div className="card-back-pattern"></div>
          <span className="card-back-logo">שועה</span>
        </div>
      </div>
    );
  }

  if (!card) return null;

  const isJoker = card.rank === 'joker';
  const isTwo = card.rank === '2';
  const isRed = card.suit === 'hearts' || card.suit === 'diamonds';

  const classes = [
    'card',
    selected && 'card-selected',
    small && 'card-small',
    disabled && 'card-disabled',
    isJoker && 'card-joker',
    isTwo && 'card-two',
    !isJoker && (isRed ? 'card-red' : 'card-black'),
  ].filter(Boolean).join(' ');

  if (isJoker) {
    return (
      <div className={classes} onClick={disabled ? undefined : onClick} style={style}>
        <div className="card-corner-top">
          <span className="card-value">★</span>
        </div>
        <div className="card-center-suit card-joker-emoji">🃏</div>
        <div className="card-corner-bottom">
          <span className="card-value">★</span>
        </div>
      </div>
    );
  }

  const symbol = SUIT_SYMBOLS[card.suit] || '';
  const display = RANK_DISPLAY[card.rank] || card.rank;

  return (
    <div className={classes} onClick={disabled ? undefined : onClick} style={style}>
      <div className="card-corner-top">
        <span className="card-value">{display}</span>
        <span className="card-suit-small">{symbol}</span>
      </div>
      <div className="card-center-suit">{symbol}</div>
      <div className="card-corner-bottom">
        <span className="card-value">{display}</span>
        <span className="card-suit-small">{symbol}</span>
      </div>
    </div>
  );
});
