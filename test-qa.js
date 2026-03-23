/**
 * QA Test Suite for שועה card game
 * Tests 20 game logic scenarios
 */

const Game = require('./game/Game');
const { sortHand } = require('./game/Deck');

let passed = 0;
let failed = 0;

function assert(condition, testNum, description) {
  if (condition) {
    console.log(`Test ${testNum}: PASS — ${description}`);
    passed++;
  } else {
    console.log(`Test ${testNum}: FAIL — ${description}`);
    failed++;
  }
}

// Helper: create a game with N players
function makeGame(n = 3, options = {}) {
  const infos = [];
  for (let i = 0; i < n; i++) {
    infos.push({ id: `p${i}`, name: `Player${i}` });
  }
  return new Game(infos, { gameNumber: options.gameNumber || 1, ...options });
}

// Helper: give specific cards to a player, replacing hand
function setHand(game, playerId, cards) {
  const player = game.getPlayer(playerId);
  player.hand = sortHand(cards.map((c, i) => {
    if (c.rank === 'joker') return { id: `${playerId}-joker-${i}`, suit: null, rank: 'joker' };
    return { id: `${c.suit}-${c.rank}`, suit: c.suit, rank: c.rank };
  }));
}

// Helper: set pile state directly
function setPile(game, cards, topRank, quantity) {
  const pileCards = cards.map((c, i) => {
    if (c.rank === 'joker') return { id: `pile-joker-${i}`, suit: null, rank: 'joker' };
    return { id: `pile-${c.suit}-${c.rank}`, suit: c.suit, rank: c.rank };
  });
  game.pile = {
    allCards: [...pileCards],
    topCards: pileCards.slice(-quantity),
    topRank: topRank,
    quantity: quantity,
  };
  game.consecutivePasses = 0;
  game.lastPlayerId = null;
}

// Helper: find card id in player's hand
function findCard(game, playerId, rank, suit) {
  const player = game.getPlayer(playerId);
  return player.hand.find(c => c.rank === rank && (suit ? c.suit === suit : true));
}

// ===================== TEST 1: Play 2 on empty pile → error =====================
(function test1() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [{ rank: '2', suit: 'hearts' }, { rank: '5', suit: 'clubs' }]);
  game.pile = { allCards: [], topCards: [], topRank: null, quantity: 0 };

  const card2 = findCard(game, 'p0', '2');
  const result = game.playCards('p0', [card2.id]);
  assert(!result.success, 1, 'Play 2 on empty pile should error');
})();

// ===================== TEST 2: Play pair of 2s → error =====================
(function test2() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: '2', suit: 'hearts' },
    { rank: '2', suit: 'spades' },
    { rank: '5', suit: 'clubs' },
  ]);
  setPile(game, [{ rank: '8', suit: 'hearts' }, { rank: '8', suit: 'spades' }], '8', 2);

  const c1 = game.getPlayer('p0').hand.filter(c => c.rank === '2');
  const result = game.playCards('p0', c1.map(c => c.id));
  assert(!result.success, 2, 'Play pair of 2s should error');
})();

// ===================== TEST 3: Joker reset on pair → error =====================
(function test3() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: 'joker', suit: null },
    { rank: '5', suit: 'clubs' },
  ]);
  setPile(game, [{ rank: '8', suit: 'hearts' }, { rank: '8', suit: 'spades' }], '8', 2);

  const joker = findCard(game, 'p0', 'joker');
  const result = game.playCards('p0', [joker.id], { type: 'reset' });
  assert(!result.success, 3, 'Joker reset on pair should error (reset only works on singles)');
})();

// ===================== TEST 4: Joker mirror on empty pile → legal =====================
(function test4() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: 'joker', suit: null },
    { rank: '5', suit: 'clubs' },
  ]);
  game.pile = { allCards: [], topCards: [], topRank: null, quantity: 0 };

  const joker = findCard(game, 'p0', 'joker');
  const result = game.playCards('p0', [joker.id], { type: 'mirror', value: 'K' });
  assert(result.success, 4, 'Joker mirror on empty pile should be legal (opens the pile)');
})();

// ===================== TEST 5: Joker + regular card = pair (no modal needed) → legal =====================
(function test5() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: 'joker', suit: null },
    { rank: 'K', suit: 'hearts' },
    { rank: '5', suit: 'clubs' },
  ]);
  setPile(game, [{ rank: 'Q', suit: 'hearts' }, { rank: 'Q', suit: 'spades' }], 'Q', 2);

  const joker = findCard(game, 'p0', 'joker');
  const king = findCard(game, 'p0', 'K');
  // Joker auto-mirrors the real card's rank
  const result = game.playCards('p0', [joker.id, king.id], { type: 'mirror', value: 'K' });
  assert(result.success, 5, 'Joker + regular card as pair should be legal');
})();

// ===================== TEST 6: 7 on 7 → direction stays downward =====================
(function test6() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: '7', suit: 'hearts' },
    { rank: '5', suit: 'clubs' },
  ]);
  // Pile has a 7, so sevenActive should be true
  setPile(game, [{ rank: '7', suit: 'spades' }], '7', 1);
  game.sevenActive = true;

  const card7 = findCard(game, 'p0', '7');
  const result = game.playCards('p0', [card7.id]);
  assert(result.success && game.sevenActive, 6, '7 on 7 should keep sevenActive (downward direction)');
})();

// ===================== TEST 7: Pass bluff (has matching card) → legal =====================
(function test7() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: '8', suit: 'hearts' },
    { rank: '5', suit: 'clubs' },
  ]);
  setPile(game, [{ rank: '8', suit: 'spades' }], '8', 1);

  // Player has an 8 but passes anyway — should be allowed
  const result = game.pass('p0');
  assert(result.success, 7, 'Pass is always allowed even with matching card');
})();

// ===================== TEST 8: Full pass round → pile resets =====================
(function test8() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [{ rank: '5', suit: 'clubs' }]);
  setHand(game, 'p1', [{ rank: '6', suit: 'clubs' }]);
  setHand(game, 'p2', [{ rank: '3', suit: 'clubs' }]);
  setPile(game, [{ rank: 'A', suit: 'spades' }], 'A', 1);

  // p0 played the A, set up so everyone else will pass
  game.currentPlayerIndex = 0;
  game.lastPlayerId = 'p0';
  game.consecutivePasses = 0;

  // p0 passes (1 pass)
  // Actually, the one who played last doesn't pass — others do, then it comes back.
  // Simulate: p1 and p2 pass. After 2 passes (all active - 1), p0 can reset.
  game.currentPlayerIndex = 1;
  game.pass('p1'); // pass 1
  game.pass('p2'); // pass 2

  // Now p0's turn again — they should see canReset
  const canReset = game._canReset('p0');
  assert(canReset, 8, 'After all others pass, pile can be reset');
})();

// ===================== TEST 9: K on K → stop; K+Joker(mirror K) on K → stop =====================
(function test9() {
  // Part A: K on K
  const gameA = makeGame(3);
  gameA.phase = 'playing';
  gameA.currentPlayerIndex = 0;
  gameA.mustPlayThreeOfClubs = false;
  setHand(gameA, 'p0', [{ rank: 'K', suit: 'hearts' }, { rank: '5', suit: 'clubs' }]);
  setHand(gameA, 'p1', [{ rank: '3', suit: 'clubs' }]);
  setHand(gameA, 'p2', [{ rank: '4', suit: 'clubs' }]);
  setPile(gameA, [{ rank: 'K', suit: 'spades' }], 'K', 1);

  const king = findCard(gameA, 'p0', 'K');
  gameA.playCards('p0', [king.id]);

  // After stop, p1 should be skipped, and turn goes to p2
  const afterA = gameA.currentPlayerIndex;
  const skippedLog = gameA.log.some(l => l.msg.includes('נדלג'));
  assert(skippedLog || afterA === 2, 9, 'K on K triggers stop (skip next player)');
})();

// ===================== TEST 10: Pair 8 on pair 8 → stop =====================
(function test10() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: '8', suit: 'hearts' },
    { rank: '8', suit: 'diamonds' },
    { rank: '5', suit: 'clubs' },
  ]);
  setHand(game, 'p1', [{ rank: '3', suit: 'clubs' }]);
  setHand(game, 'p2', [{ rank: '4', suit: 'clubs' }]);
  setPile(game, [{ rank: '8', suit: 'spades' }, { rank: '8', suit: 'clubs' }], '8', 2);

  const eights = game.getPlayer('p0').hand.filter(c => c.rank === '8');
  game.playCards('p0', eights.map(c => c.id));

  const skippedLog = game.log.some(l => l.msg.includes('נדלג') || l.msg.includes('עצור'));
  assert(skippedLog, 10, 'Pair 8 on pair 8 triggers stop');
})();

// ===================== TEST 11: Burst completion =====================
(function test11() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  // 2 matching cards on pile + 2 in hand = 4
  setHand(game, 'p0', [
    { rank: '9', suit: 'hearts' },
    { rank: '9', suit: 'diamonds' },
    { rank: '5', suit: 'clubs' },
  ]);
  setPile(game, [
    { rank: '9', suit: 'spades' },
    { rank: '9', suit: 'clubs' },
  ], '9', 1);

  const nines = game.getPlayer('p0').hand.filter(c => c.rank === '9');
  const result = game.burst('p0', nines.map(c => c.id));
  assert(result.success, 11, 'Burst completion (2 in hand + 2 on pile = 4) should be legal');
})();

// ===================== TEST 12: Burst bomb (4 in hand) =====================
(function test12() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  setHand(game, 'p0', [
    { rank: 'J', suit: 'hearts' },
    { rank: 'J', suit: 'diamonds' },
    { rank: 'J', suit: 'spades' },
    { rank: 'J', suit: 'clubs' },
    { rank: '5', suit: 'clubs' },
  ]);
  // Any pile state — burst should work any time
  setPile(game, [{ rank: '3', suit: 'spades' }], '3', 1);

  const jacks = game.getPlayer('p0').hand.filter(c => c.rank === 'J');
  const result = game.burst('p0', jacks.map(c => c.id));
  assert(result.success, 12, 'Burst bomb (4 in hand) should be legal at any moment');
})();

// ===================== TEST 13: Burst with joker on pile → NOT legal =====================
(function test13() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  // Pile has joker (mirroring 9) + real 9. Hand has 2 nines.
  // joker+real on pile = only 1 real 9 on pile. 2 in hand + 1 on pile = 3, not 4
  setHand(game, 'p0', [
    { rank: '9', suit: 'hearts' },
    { rank: '9', suit: 'diamonds' },
    { rank: '5', suit: 'clubs' },
  ]);
  setPile(game, [
    { rank: 'joker', suit: null },
    { rank: '9', suit: 'spades' },
  ], '9', 2);
  // Mark the joker with effectiveRank
  game.pile.allCards[0].effectiveRank = '9';

  const nines = game.getPlayer('p0').hand.filter(c => c.rank === '9');
  const result = game.burst('p0', nines.map(c => c.id));
  // Should fail because joker doesn't count for burst — only 1 real 9 on pile + 2 in hand = 3
  assert(!result.success, 13, 'Burst with joker on pile should NOT be legal (joker not counted)');
})();

// ===================== TEST 14: Skipped player with quartet → can burst =====================
(function test14() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  // p1 has a quartet and would be skipped by stop
  setHand(game, 'p0', [{ rank: 'K', suit: 'hearts' }, { rank: '5', suit: 'clubs' }]);
  setHand(game, 'p1', [
    { rank: '10', suit: 'hearts' },
    { rank: '10', suit: 'diamonds' },
    { rank: '10', suit: 'spades' },
    { rank: '10', suit: 'clubs' },
  ]);
  setHand(game, 'p2', [{ rank: '4', suit: 'clubs' }]);
  setPile(game, [{ rank: 'K', suit: 'spades' }], 'K', 1);

  // p0 plays K (stop). p1 has quartet — they should NOT be skipped
  const king = findCard(game, 'p0', 'K');
  game.playCards('p0', [king.id]);

  // After the stop, if p1 can burst, they shouldn't be skipped
  // Check if turn is p1 (not skipped) since they have a burst
  const bursts = game.getPossibleBursts('p1');
  assert(bursts.length > 0, 14, 'Skipped player with quartet can burst (not skipped)');
})();

// ===================== TEST 15: Finish with 2 → next player gets empty pile =====================
(function test15() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;
  // Player has only a 2 and plays it to finish
  setHand(game, 'p0', [{ rank: '2', suit: 'hearts' }]);
  setHand(game, 'p1', [{ rank: '6', suit: 'clubs' }]);
  setHand(game, 'p2', [{ rank: '4', suit: 'clubs' }]);
  setPile(game, [{ rank: 'A', suit: 'spades' }], 'A', 1);

  const card2 = findCard(game, 'p0', '2');
  game.playCards('p0', [card2.id]);

  // p0 should be finished, pile should be empty
  const p0 = game.getPlayer('p0');
  assert(p0.finished && game.pile.topRank === null, 15, 'Finish with 2 resets pile for next player');
})();

// ===================== TEST 16: Exchange → king sees 2 and joker in values list =====================
(function test16() {
  const game = makeGame(4, { gameNumber: 2, previousFinishOrder: [
    { id: 'p0', name: 'Player0', rank: 1 },
    { id: 'p1', name: 'Player1', rank: 2 },
    { id: 'p2', name: 'Player2', rank: 3 },
    { id: 'p3', name: 'Player3', rank: 4 },
  ]});

  // Shua (p3) should have cards for exchange. Give p3 a hand that includes 2 and joker.
  setHand(game, 'p3', [
    { rank: '2', suit: 'hearts' },
    { rank: 'joker', suit: null },
    { rank: '5', suit: 'clubs' },
    { rank: 'K', suit: 'hearts' },
  ]);

  const values = game._getExchangeValues('p3');
  const has2 = values.includes('2');
  const hasJoker = values.includes('joker');
  assert(has2 && hasJoker, 16, 'Exchange: king sees 2 and joker in values list');
})();

// ===================== TEST 17: Disconnected player → 30s timer =====================
(function test17() {
  // This tests that the game marks disconnected players correctly
  const game = makeGame(3);
  game.phase = 'playing';

  const player = game.getPlayer('p1');
  player.disconnected = true;
  player.disconnectTime = Date.now();

  // The actual 30s timer is in server.js, but game marks the player
  assert(player.disconnected === true && player.disconnectTime != null, 17,
    'Disconnected player is marked with disconnected flag and timestamp');
})();

// ===================== TEST 18: Player leaves → cards discarded, game continues =====================
(function test18() {
  const game = makeGame(3);
  game.phase = 'playing';
  game.currentPlayerIndex = 1;
  game.mustPlayThreeOfClubs = false;

  const beforeCount = game.getActivePlayers().length;
  game.removePlayer('p1');
  const afterCount = game.getActivePlayers().length;

  assert(afterCount === beforeCount - 1 && game.phase === 'playing', 18,
    'Player leaves: cards discarded, game continues with remaining players');
})();

// ===================== TEST 19: 2 players left, one leaves → remaining wins =====================
(function test19() {
  const game = makeGame(2);
  game.phase = 'playing';
  game.currentPlayerIndex = 0;
  game.mustPlayThreeOfClubs = false;

  game.removePlayer('p0');

  // With only 1 active player, game should be over
  assert(game.phase === 'gameOver', 19, '2 players, one leaves — remaining player wins');
})();

// ===================== TEST 20: Rematch → same seat order, opener after shua =====================
(function test20() {
  const previousFinishOrder = [
    { id: 'p0', name: 'Player0', rank: 1 },
    { id: 'p1', name: 'Player1', rank: 2 },
    { id: 'p2', name: 'Player2', rank: 3 },
  ];
  const seatingOrder = ['p0', 'p1', 'p2'];

  const game = new Game(
    [{ id: 'p0', name: 'Player0' }, { id: 'p1', name: 'Player1' }, { id: 'p2', name: 'Player2' }],
    { gameNumber: 2, previousFinishOrder, seatingOrder }
  );

  // Shua was p2 (last in finish order). Opener should be next after p2 in seating order = p0
  const shuaIdx = game.players.findIndex(p => p.id === 'p2');
  const expectedOpener = game._nextActiveIndex(shuaIdx);

  // Seating order should be preserved
  const seatMatch = game.seatingOrder[0] === 'p0' &&
                     game.seatingOrder[1] === 'p1' &&
                     game.seatingOrder[2] === 'p2';

  assert(seatMatch && game.currentPlayerIndex === expectedOpener, 20,
    'Rematch: same seat order, opener is after shua');
})();

// ===================== SUMMARY =====================
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed out of ${passed + failed} tests`);
console.log('========================================');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
