const { createDeck, shuffle, deal, rankValue, sortHand, cardDisplay, RANK_ORDER } = require('./Deck');

const SEVEN_VALUE = rankValue('7'); // index 4

class Game {
  constructor(playerInfos, options = {}) {
    const { gameNumber = 1, previousFinishOrder = null, seatingOrder = null } = options;

    this.gameNumber = gameNumber;
    this.log = [];
    this.finishOrder = [];
    this.previousFinishOrder = previousFinishOrder;

    // Seating order preserved across rematches
    if (seatingOrder) {
      this.seatingOrder = seatingOrder;
      this.players = seatingOrder.map(id => {
        const info = playerInfos.find(p => p.id === id);
        return this._makePlayer(info);
      });
    } else {
      this.seatingOrder = playerInfos.map(p => p.id);
      this.players = playerInfos.map(p => this._makePlayer(p));
    }

    // Deal cards
    const deck = shuffle(createDeck());
    const hands = deal(deck, this.players.length);
    this.players.forEach((p, i) => {
      p.hand = sortHand(hands[i]);
    });

    // Pile state
    this.pile = { allCards: [], topCards: [], topRank: null, quantity: 0 };
    this.sevenActive = false;
    this.consecutivePasses = 0;
    this.lastPlayerId = null;
    this.mustPlayThreeOfClubs = false;

    // Exchange
    this.exchange = null;

    // Determine starting player and phase
    if (gameNumber === 1) {
      this.phase = 'playing';
      const idx = this.players.findIndex(p =>
        p.hand.some(c => c.rank === '3' && c.suit === 'clubs')
      );
      this.currentPlayerIndex = idx >= 0 ? idx : 0;
      this.mustPlayThreeOfClubs = true;
    } else {
      if (previousFinishOrder && previousFinishOrder.length > 0) {
        const shooaId = previousFinishOrder[previousFinishOrder.length - 1].id;
        const shooaIdx = this.players.findIndex(p => p.id === shooaId);
        this.currentPlayerIndex = this._nextActiveIndex(shooaIdx);
      } else {
        this.currentPlayerIndex = 0;
      }

      if (previousFinishOrder && this.players.length >= 2) {
        this.phase = 'exchange';
        this._setupExchange();
      } else {
        this.phase = 'playing';
      }
    }
  }

  _makePlayer(info) {
    return {
      id: info.id,
      name: info.name,
      hand: [],
      finished: false,
      finishRank: null,
      disconnected: false,
    };
  }

  // ==================== PLAYER HELPERS ====================

  getPlayer(id) {
    return this.players.find(p => p.id === id);
  }

  getActivePlayers() {
    return this.players.filter(p => !p.finished && !p.disconnected);
  }

  _nextActiveIndex(fromIndex) {
    let idx = (fromIndex + 1) % this.players.length;
    let attempts = 0;
    while (
      (this.players[idx].finished || this.players[idx].disconnected) &&
      attempts < this.players.length
    ) {
      idx = (idx + 1) % this.players.length;
      attempts++;
    }
    return idx;
  }

  _removeCardsFromHand(player, cardIds) {
    for (const id of cardIds) {
      const idx = player.hand.findIndex(c => c.id === id);
      if (idx !== -1) player.hand.splice(idx, 1);
    }
  }

  _resetPileState() {
    this.pile = { allCards: [], topCards: [], topRank: null, quantity: 0 };
    this.sevenActive = false;
    this.consecutivePasses = 0;
    this.lastPlayerId = null;
  }

  _addLog(msg) {
    this.log.push({ msg, time: Date.now() });
    if (this.log.length > 50) this.log.shift();
  }

  // ==================== EFFECTIVE PLAY PARSING ====================

  _getEffectivePlay(cards, jokerChoice) {
    const realCards = cards.filter(c => c.rank !== 'joker');
    const jokerCount = cards.length - realCards.length;

    // Single card that is a 2 → reset
    if (cards.length === 1 && cards[0].rank === '2') {
      return { type: 'reset', rank: '2', quantity: 1 };
    }

    // Cannot play multiple 2s ever
    if (realCards.some(c => c.rank === '2') && cards.length > 1) {
      return { type: 'invalid', error: 'אסור לשים זוג 2' };
    }
    if (realCards.filter(c => c.rank === '2').length > 1) {
      return { type: 'invalid', error: 'אסור לשים זוג 2' };
    }

    // Single joker as reset
    if (cards.length === 1 && cards[0].rank === 'joker' && jokerChoice?.type === 'reset') {
      return { type: 'reset', rank: 'joker', quantity: 1 };
    }

    // Joker(s) as mirror
    if (jokerCount > 0) {
      let mirrorRank;
      if (realCards.length > 0) {
        // Infer mirror from real cards
        mirrorRank = realCards[0].rank;
        if (!realCards.every(c => c.rank === mirrorRank)) {
          return { type: 'invalid', error: 'כל הקלפים חייבים להיות מאותו ערך' };
        }
        if (mirrorRank === '2') {
          return { type: 'invalid', error: 'אסור לשים זוג 2' };
        }
      } else {
        // All jokers — need jokerChoice
        if (!jokerChoice || jokerChoice.type !== 'mirror' || !jokerChoice.value) {
          return { type: 'invalid', error: 'צריך לבחור ערך לג׳וקר' };
        }
        mirrorRank = jokerChoice.value;
        if (mirrorRank === '2') {
          return { type: 'invalid', error: 'ג׳וקר לא יכול להיות 2' };
        }
      }
      return {
        type: 'play',
        rank: mirrorRank,
        quantity: cards.length,
        isSeven: mirrorRank === '7',
      };
    }

    // All real cards, no jokers
    const rank = realCards[0].rank;
    if (rank === '2') {
      return { type: 'invalid', error: 'אסור לשים זוג 2' };
    }
    if (!realCards.every(c => c.rank === rank)) {
      return { type: 'invalid', error: 'כל הקלפים חייבים להיות מאותו ערך' };
    }
    if (cards.length > 3) {
      return { type: 'invalid', error: 'מקסימום שלישייה' };
    }
    return {
      type: 'play',
      rank,
      quantity: cards.length,
      isSeven: rank === '7',
    };
  }

  // ==================== EFFECTIVE RANK HELPER ====================

  _getEffectiveRank(cards, jokerChoice) {
    const realCards = cards.filter(c => c.rank !== 'joker');
    if (realCards.length > 0) return realCards[0].rank;
    // All jokers — use mirror choice
    if (jokerChoice?.mode === 'mirror' || jokerChoice?.type === 'mirror') {
      return jokerChoice.value || jokerChoice.rank || null;
    }
    return null;
  }

  // ==================== PLAY CARDS ====================

  playCards(playerId, cardIds, jokerChoice) {
    if (this.phase !== 'playing') return { success: false, error: 'לא בשלב משחק' };

    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return { success: false, error: 'לא התור שלך' };

    // Get cards from hand
    const cards = [];
    for (const id of cardIds) {
      const card = currentPlayer.hand.find(c => c.id === id);
      if (!card) return { success: false, error: 'קלף לא נמצא ביד' };
      cards.push(card);
    }

    if (cards.length === 0) return { success: false, error: 'צריך לבחור קלפים' };

    // Parse effective play
    const effective = this._getEffectivePlay(cards, jokerChoice);
    if (effective.type === 'invalid') return { success: false, error: effective.error };

    // First turn: 3♣ holder starts but can play ANY card
    if (this.mustPlayThreeOfClubs) {
      this.mustPlayThreeOfClubs = false;
    }

    // === RESET PLAY (2 or joker reset) ===
    if (effective.type === 'reset') {
      if (this.pile.topRank === null) {
        return { success: false, error: '2 לא יכול לפתוח רצף' };
      }
      // Joker reset only on singles
      if (effective.rank === 'joker' && this.pile.quantity !== 1) {
        return { success: false, error: 'ג׳וקר מאפס רק על בודד' };
      }

      this._removeCardsFromHand(currentPlayer, cardIds);
      const display = effective.rank === '2' ? '2' : '🃏';
      this._addLog(`${currentPlayer.name} שורף עם ${display}! 🔥`);
      this._resetPileState();
      this.lastPlayerId = playerId;
      this.mustPlayThreeOfClubs = false;

      // Check if player finished
      if (currentPlayer.hand.length === 0) {
        this._playerFinished(currentPlayer);
        if (this._checkGameOver()) return { success: true, gameOver: true };
        // After reset finish, next player gets empty pile
        this.currentPlayerIndex = this._nextActiveIndex(this.currentPlayerIndex);
      }
      // Turn stays with this player (they start a new sequence)
      // Unless they finished, in which case we already advanced
      return { success: true };
    }

    // === NORMAL PLAY ===
    // Validate quantity matches pile (or pile is empty)
    if (this.pile.topRank !== null && effective.quantity !== this.pile.quantity) {
      return { success: false, error: `צריך ${this.pile.quantity === 1 ? 'בודד' : this.pile.quantity === 2 ? 'זוג' : 'שלישייה'}` };
    }

    // Validate value
    const rv = rankValue(effective.rank);
    if (this.pile.topRank !== null) {
      const pileRv = rankValue(this.pile.topRank);

      if (this.sevenActive) {
        // Must play <= 7 (can play 7 itself for stop/continuation)
        if (rv > SEVEN_VALUE) {
          return { success: false, error: 'צריך לשים מתחת ל-7!' };
        }
      } else {
        // Must play >= pile value
        if (rv < pileRv) {
          return { success: false, error: 'צריך ערך גבוה יותר' };
        }
      }
    }

    // Check for stop (same value as pile top) — use effective rank to cover joker mirrors
    const effectiveRank = this._getEffectiveRank(cards, jokerChoice) || effective.rank;
    const isStop = this.pile.topRank !== null && effectiveRank === this.pile.topRank;

    // Execute the play
    this._removeCardsFromHand(currentPlayer, cardIds);

    // Add cards to pile with effective rank info on jokers
    const pileCards = cards.map(c => {
      if (c.rank === 'joker') {
        return { ...c, effectiveRank: effective.rank };
      }
      return { ...c };
    });
    this.pile.allCards.push(...pileCards);
    this.pile.topCards = pileCards;
    this.pile.topRank = effective.rank;
    this.pile.quantity = effective.quantity;

    this.consecutivePasses = 0;
    this.lastPlayerId = playerId;
    this.mustPlayThreeOfClubs = false;

    // Handle seven
    if (effective.isSeven) {
      this.sevenActive = true;
    } else if (this.sevenActive) {
      // Played below 7, revert to ascending
      this.sevenActive = false;
    }

    // Log
    const cardStr = pileCards.map(c => cardDisplay(c)).join(' ');
    if (isStop) {
      this._addLog(`${currentPlayer.name} שם ${cardStr} — עצור! ⛔`);
    } else if (effective.isSeven) {
      this._addLog(`${currentPlayer.name} שם ${cardStr} — היפוך! 🔄`);
    } else {
      this._addLog(`${currentPlayer.name} שם ${cardStr}`);
    }

    // Check if player finished
    const playerFinished = currentPlayer.hand.length === 0;
    if (playerFinished) {
      this._playerFinished(currentPlayer);
      if (this._checkGameOver()) return { success: true, gameOver: true };
    }

    // Advance turn
    this._advanceTurn(isStop);

    return { success: true };
  }

  // ==================== PASS ====================

  pass(playerId) {
    if (this.phase !== 'playing') return { success: false, error: 'לא בשלב משחק' };
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return { success: false, error: 'לא התור שלך' };

    this.consecutivePasses++;
    this._addLog(`${currentPlayer.name} עבר`);

    // Advance turn
    const nextIdx = this._nextActiveIndex(this.currentPlayerIndex);
    this.currentPlayerIndex = nextIdx;

    // Check if all active players passed and last player is finished → auto-reset
    const lastPlayer = this.getPlayer(this.lastPlayerId);
    if (lastPlayer && (lastPlayer.finished || lastPlayer.disconnected)) {
      const activeCount = this.getActivePlayers().length;
      if (this.consecutivePasses >= activeCount) {
        this._resetPileState();
        this._addLog('החבילה התרוקנה 🔄');
      }
    }

    return { success: true };
  }

  // ==================== RESET PILE (canReset action) ====================

  resetPile(playerId) {
    if (this.phase !== 'playing') return { success: false, error: 'לא בשלב משחק' };
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return { success: false, error: 'לא התור שלך' };

    // Verify canReset
    if (!this._canReset(playerId)) {
      return { success: false, error: 'לא ניתן לאפס עכשיו' };
    }

    this._resetPileState();
    this._addLog(`${currentPlayer.name} איפס את החבילה 🔄`);

    // Turn stays with this player — they start a new sequence
    return { success: true };
  }

  _canReset(playerId) {
    if (this.pile.topRank === null) return false;
    const currentPlayer = this.players[this.currentPlayerIndex];
    if (currentPlayer.id !== playerId) return false;
    if (this.lastPlayerId !== playerId) return false;
    const activeCount = this.getActivePlayers().length;
    return this.consecutivePasses >= activeCount - 1;
  }

  // ==================== BURST (4-of-a-kind) ====================

  burst(playerId, cardIds) {
    if (this.phase !== 'playing') return { success: false, error: 'לא בשלב משחק' };

    const player = this.getPlayer(playerId);
    if (!player || player.finished) return { success: false, error: 'שחקן לא פעיל' };

    // Get cards from hand
    const cards = [];
    for (const id of cardIds) {
      const card = player.hand.find(c => c.id === id);
      if (!card) return { success: false, error: 'קלף לא נמצא ביד' };
      cards.push(card);
    }

    // All cards must be same rank, no jokers
    if (cards.some(c => c.rank === 'joker')) {
      return { success: false, error: 'ג׳וקר לא יכול להשתתף ברביעייה' };
    }

    const rank = cards[0].rank;
    if (!cards.every(c => c.rank === rank)) {
      return { success: false, error: 'כל הקלפים חייבים להיות מאותו ערך' };
    }
    if (rank === '2') {
      return { success: false, error: 'אי אפשר רביעייה של 2' };
    }

    // Count real cards of this rank on pile (jokers don't count)
    const pileCount = this.pile.allCards.filter(
      c => c.rank === rank && c.rank !== 'joker'
    ).length;

    // hand cards + pile cards must = 4
    if (cards.length + pileCount !== 4) {
      return { success: false, error: 'צריך בדיוק 4 קלפים אמיתיים לרביעייה' };
    }

    // Valid burst!
    this._removeCardsFromHand(player, cardIds);
    this._addLog(`${player.name} — רביעייה ${rank}! 💥`);
    this._resetPileState();

    // Check if player finished
    if (player.hand.length === 0) {
      this._playerFinished(player);
      if (this._checkGameOver()) return { success: true, gameOver: true };
      // Next player after the burster starts fresh
      const playerIdx = this.players.findIndex(p => p.id === playerId);
      this.currentPlayerIndex = this._nextActiveIndex(playerIdx);
    } else {
      // Turn goes to burster — they start a new sequence
      const playerIdx = this.players.findIndex(p => p.id === playerId);
      this.currentPlayerIndex = playerIdx;
    }

    this.lastPlayerId = playerId;
    return { success: true };
  }

  // ==================== BURST DETECTION ====================

  getPossibleBursts(playerId) {
    const player = this.getPlayer(playerId);
    if (!player || player.finished) return [];

    const bursts = [];

    // Count real cards per rank in hand (no jokers, no 2s)
    const handCounts = {};
    for (const c of player.hand) {
      if (c.rank !== 'joker' && c.rank !== '2') {
        handCounts[c.rank] = handCounts[c.rank] || { count: 0, cardIds: [] };
        handCounts[c.rank].count++;
        handCounts[c.rank].cardIds.push(c.id);
      }
    }

    // Count real cards per rank across ALL pile cards (no jokers)
    const pileCounts = {};
    for (const c of this.pile.allCards) {
      if (c.rank !== 'joker' && c.rank !== '2') {
        pileCounts[c.rank] = (pileCounts[c.rank] || 0) + 1;
      }
    }

    for (const rank of Object.keys(handCounts)) {
      const inHand = handCounts[rank].count;
      const onPile = pileCounts[rank] || 0;

      if (inHand + onPile === 4) {
        bursts.push({
          rank,
          cardIds: handCounts[rank].cardIds,
          type: inHand === 4 ? 'hand' : 'complete',
        });
      }
    }

    return bursts;
  }

  // ==================== TURN MANAGEMENT ====================

  _advanceTurn(stopTriggered = false) {
    let nextIdx = this._nextActiveIndex(this.currentPlayerIndex);

    if (stopTriggered) {
      const skippedPlayer = this.players[nextIdx];
      if (!skippedPlayer.finished && !skippedPlayer.disconnected) {
        // Check if skipped player can burst (they'd do it themselves)
        const bursts = this.getPossibleBursts(skippedPlayer.id);
        if (bursts.length === 0) {
          // Skip this player — advance to the one after them
          this._addLog(`⛔ ${skippedPlayer.name} נדלג!`);
          nextIdx = this._nextActiveIndex(nextIdx);
        }
        // If they CAN burst, they aren't skipped — they'll burst on their turn
      }
    }

    this.currentPlayerIndex = nextIdx;

    // Handle disconnected player's turn — auto-pass
    const nextPlayer = this.players[nextIdx];
    if (nextPlayer.disconnected) {
      this.consecutivePasses++;
      this.currentPlayerIndex = this._nextActiveIndex(nextIdx);
    }
  }

  _playerFinished(player) {
    player.finished = true;
    player.finishRank = this.finishOrder.length + 1;
    this.finishOrder.push({ id: player.id, name: player.name, rank: player.finishRank });
    const emoji = player.finishRank === 1 ? '👑' : `#${player.finishRank}`;
    this._addLog(`${player.name} סיים! ${emoji}`);
  }

  _checkGameOver() {
    const active = this.getActivePlayers();
    if (active.length <= 1) {
      if (active.length === 1) {
        const shooa = active[0];
        this._playerFinished(shooa);
        this._addLog(`${shooa.name} הוא השועה! 🍑`);
      }
      this.phase = 'gameOver';
      return true;
    }
    return false;
  }

  // ==================== EXCHANGE ====================

  _setupExchange() {
    const fo = this.previousFinishOrder;
    if (!fo || fo.length < 2) {
      this.phase = 'playing';
      return;
    }

    const pairs = [];

    // King (1st) ↔ Shoo'a (last): 2 cards
    pairs.push({
      takerId: fo[0].id,
      giverId: fo[fo.length - 1].id,
      count: 2,
      phase: 'pick', // pick → give → done
      picksMade: 0,
    });

    // 2nd ↔ 2nd-to-last: 1 card (only if 4+ players)
    if (fo.length >= 4) {
      pairs.push({
        takerId: fo[1].id,
        giverId: fo[fo.length - 2].id,
        count: 1,
        phase: 'pick',
        picksMade: 0,
      });
    }

    this.exchange = { pairs, currentPairIndex: 0 };
  }

  _getExchangeValues(giverId) {
    const giver = this.getPlayer(giverId);
    if (!giver) return [];
    const valuesSet = new Set();
    for (const c of giver.hand) {
      valuesSet.add(c.rank === 'joker' ? 'joker' : c.rank);
    }
    return [...valuesSet].sort((a, b) => {
      if (a === 'joker') return 1;
      if (b === 'joker') return -1;
      if (a === '2') return 1;
      if (b === '2') return -1;
      return rankValue(a) - rankValue(b);
    });
  }

  exchangePick(playerId, value) {
    if (this.phase !== 'exchange' || !this.exchange) {
      return { success: false, error: 'לא בשלב החלפה' };
    }
    const pair = this.exchange.pairs[this.exchange.currentPairIndex];
    if (!pair || pair.phase !== 'pick') {
      return { success: false, error: 'לא בשלב בחירה' };
    }
    if (playerId !== pair.takerId) {
      return { success: false, error: 'לא התור שלך להחליף' };
    }

    const giver = this.getPlayer(pair.giverId);
    let cardIdx;
    if (value === 'joker') {
      cardIdx = giver.hand.findIndex(c => c.rank === 'joker');
    } else {
      cardIdx = giver.hand.findIndex(c => c.rank === value);
    }
    if (cardIdx === -1) {
      return { success: false, error: 'הערך לא נמצא ביד' };
    }

    // Transfer card from giver to taker
    const [card] = giver.hand.splice(cardIdx, 1);
    const taker = this.getPlayer(pair.takerId);
    taker.hand.push(card);
    taker.hand = sortHand(taker.hand);

    pair.picksMade++;
    this._addLog(`${taker.name} לקח קלף מ${giver.name}`);

    if (pair.picksMade >= pair.count) {
      pair.phase = 'give';
    }

    return { success: true };
  }

  exchangeGive(playerId, cardIds) {
    if (this.phase !== 'exchange' || !this.exchange) {
      return { success: false, error: 'לא בשלב החלפה' };
    }
    const pair = this.exchange.pairs[this.exchange.currentPairIndex];
    if (!pair || pair.phase !== 'give') {
      return { success: false, error: 'לא בשלב נתינה' };
    }
    if (playerId !== pair.takerId) {
      return { success: false, error: 'לא התור שלך' };
    }
    if (cardIds.length !== pair.count) {
      return { success: false, error: `צריך לתת ${pair.count} קלפים` };
    }

    const taker = this.getPlayer(pair.takerId);
    const giver = this.getPlayer(pair.giverId);

    // Transfer cards from taker to giver
    for (const cardId of cardIds) {
      const idx = taker.hand.findIndex(c => c.id === cardId);
      if (idx === -1) return { success: false, error: 'קלף לא נמצא ביד' };
      const [card] = taker.hand.splice(idx, 1);
      giver.hand.push(card);
    }

    taker.hand = sortHand(taker.hand);
    giver.hand = sortHand(giver.hand);

    pair.phase = 'done';
    this._addLog(`${taker.name} נתן ${pair.count} קלפים ל${giver.name}`);

    // Advance to next exchange pair or start game
    this.exchange.currentPairIndex++;
    if (this.exchange.currentPairIndex >= this.exchange.pairs.length) {
      this.phase = 'playing';
      this.exchange = null;
      this._addLog('ההחלפה הסתיימה — יאללה! 🎯');
    }

    return { success: true };
  }

  // ==================== STATE SERIALIZATION ====================

  getStateForPlayer(playerId) {
    const playerIdx = this.players.findIndex(p => p.id === playerId);
    const player = this.players[playerIdx];

    // Build opponents list (in seating order, excluding self)
    const opponents = [];
    for (let i = 0; i < this.players.length; i++) {
      if (i === playerIdx) continue;
      const p = this.players[i];
      opponents.push({
        id: p.id,
        name: p.name,
        cardCount: p.hand.length,
        finished: p.finished,
        finishRank: p.finishRank,
        disconnected: p.disconnected,
        disconnectTime: p.disconnectTime || null,
        isCurrentTurn: i === this.currentPlayerIndex,
      });
    }

    // All players in seating order (including self) for the player bar
    const allPlayers = this.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      cardCount: p.hand.length,
      finished: p.finished,
      finishRank: p.finishRank,
      disconnected: p.disconnected,
      disconnectTime: p.disconnectTime || null,
      isCurrentTurn: i === this.currentPlayerIndex,
      isMe: p.id === playerId,
    }));

    const currentPlayerId = this.players[this.currentPlayerIndex]?.id;
    const isMyTurn = currentPlayerId === playerId;
    const canReset = isMyTurn && this._canReset(playerId);
    const possibleBursts = this.getPossibleBursts(playerId);

    // Exchange state for this player
    let exchangeState = null;
    if (this.phase === 'exchange' && this.exchange) {
      const pair = this.exchange.pairs[this.exchange.currentPairIndex];
      if (pair) {
        if (playerId === pair.takerId) {
          if (pair.phase === 'pick') {
            exchangeState = {
              role: 'taker',
              action: 'pick',
              values: this._getExchangeValues(pair.giverId),
              remaining: pair.count - pair.picksMade,
              partnerName: this.getPlayer(pair.giverId)?.name,
            };
          } else if (pair.phase === 'give') {
            exchangeState = {
              role: 'taker',
              action: 'give',
              count: pair.count,
              partnerName: this.getPlayer(pair.giverId)?.name,
            };
          }
        } else if (playerId === pair.giverId) {
          exchangeState = {
            role: 'giver',
            action: 'waiting',
            partnerName: this.getPlayer(pair.takerId)?.name,
          };
        } else {
          exchangeState = {
            role: 'spectator',
            action: 'waiting',
          };
        }
      }
    }

    // Player rank from previous game (for exchange display + sho'a marker)
    let myRank = null;
    let shooaPlayerId = null;
    const fo = this.previousFinishOrder;
    if (fo && fo.length >= 2) {
      shooaPlayerId = fo[fo.length - 1].id;
      const myFoIdx = fo.findIndex(p => p.id === playerId);
      if (myFoIdx === 0) myRank = { label: 'מלך', emoji: '👑' };
      else if (myFoIdx === 1 && fo.length >= 4) myRank = { label: 'סגן מלך', emoji: '🥈' };
      else if (myFoIdx === fo.length - 1) myRank = { label: 'שועה', emoji: '💩' };
      else if (myFoIdx === fo.length - 2 && fo.length >= 4) myRank = { label: 'סגן שועה', emoji: '🤢' };
    }

    return {
      phase: this.phase,
      hand: player ? [...player.hand] : [],
      opponents,
      allPlayers,
      pile: {
        topCards: [...this.pile.topCards],
        allCards: this.pile.allCards.slice(-12), // last 12 individual cards (covers 4 plays of triples)
        topRank: this.pile.topRank,
        quantity: this.pile.quantity,
        isEmpty: this.pile.topRank === null,
      },
      currentPlayerId,
      isMyTurn,
      canReset,
      sevenActive: this.sevenActive,
      possibleBursts,
      log: this.log.slice(-5),
      exchange: exchangeState,
      finishOrder: [...this.finishOrder],
      gameNumber: this.gameNumber,
      mustPlayThreeOfClubs: this.mustPlayThreeOfClubs && isMyTurn,
      myId: playerId,
      myRank,
      shooaPlayerId,
    };
  }
}

module.exports = Game;
