const SUITS = ['clubs', 'diamonds', 'hearts', 'spades'];
const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
const RANK_ORDER = ['3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

const SUIT_SYMBOLS = { clubs: '♣', diamonds: '♦', hearts: '♥', spades: '♠' };

function createDeck() {
  const cards = [];
  let id = 0;
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({ id: String(id++), suit, rank });
    }
  }
  cards.push({ id: String(id++), suit: null, rank: 'joker' });
  cards.push({ id: String(id++), suit: null, rank: 'joker' });
  return cards;
}

function shuffle(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function deal(cards, numPlayers) {
  const hands = Array.from({ length: numPlayers }, () => []);
  cards.forEach((card, i) => {
    hands[i % numPlayers].push(card);
  });
  return hands;
}

function rankValue(rank) {
  return RANK_ORDER.indexOf(rank);
}

function sortHand(hand) {
  return [...hand].sort((a, b) => {
    if (a.rank === 'joker' && b.rank === 'joker') return 0;
    if (a.rank === 'joker') return 1;
    if (b.rank === 'joker') return 1;
    if (a.rank === '2' && b.rank === '2') return 0;
    if (a.rank === '2') return -1;
    if (b.rank === '2') return -1;
    return rankValue(a.rank) - rankValue(b.rank);
  });
}

function cardDisplay(card) {
  if (card.rank === 'joker') return '🃏';
  return `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
}

module.exports = {
  createDeck,
  shuffle,
  deal,
  rankValue,
  sortHand,
  cardDisplay,
  RANK_ORDER,
  SUITS,
  RANKS,
  SUIT_SYMBOLS,
};
