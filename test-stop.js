const Game = require('./game/Game');

let passed = 0;
let failed = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  PASS: ${testName}`);
    passed++;
  } else {
    console.log(`  FAIL: ${testName} ${detail}`);
    failed++;
  }
}

function makeCard(rank, suit) {
  if (rank === 'joker') {
    return { id: `joker-${suit || '1'}`, suit: null, rank: 'joker' };
  }
  return { id: `${suit}-${rank}`, suit, rank };
}

function createTestGame(numPlayers = 4) {
  const playerInfos = [];
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  for (let i = 0; i < numPlayers; i++) {
    playerInfos.push({ id: `p${i}`, name: names[i] });
  }
  const game = new Game(playerInfos, { gameNumber: 1 });

  // Override mustPlayThreeOfClubs and set starting player to A (index 0)
  game.mustPlayThreeOfClubs = false;
  game.currentPlayerIndex = 0;

  return game;
}

function setHand(game, playerIndex, cards) {
  game.players[playerIndex].hand = cards;
}

// ====================================================================
console.log('\nTest 1: Basic single-card stop (A plays 6, B plays 6 -> C skipped)');
// ====================================================================
{
  const game = createTestGame(4);

  setHand(game, 0, [makeCard('6', 'clubs'), makeCard('3', 'hearts'), makeCard('4', 'hearts')]);
  setHand(game, 1, [makeCard('6', 'diamonds'), makeCard('5', 'hearts'), makeCard('4', 'diamonds')]);
  setHand(game, 2, [makeCard('9', 'clubs'), makeCard('10', 'clubs')]);
  setHand(game, 3, [makeCard('K', 'clubs'), makeCard('A', 'clubs')]);

  // A plays 6 (single)
  let result = game.playCards('p0', ['clubs-6']);
  assert(result.success, 'A plays 6', JSON.stringify(result));
  assert(game.currentPlayerIndex === 1, 'Turn goes to B', `currentPlayerIndex=${game.currentPlayerIndex}`);

  // B plays 6 (single) -> STOP -> C skipped
  result = game.playCards('p1', ['diamonds-6']);
  assert(result.success, 'B plays 6', JSON.stringify(result));
  assert(game.currentPlayerIndex === 3, 'C is skipped, turn goes to D (index 3)', `currentPlayerIndex=${game.currentPlayerIndex}`);
}

// ====================================================================
console.log('\nTest 2: Pair stop (A plays pair K, B plays pair K -> C skipped)');
// ====================================================================
{
  const game = createTestGame(4);

  setHand(game, 0, [makeCard('K', 'clubs'), makeCard('K', 'diamonds'), makeCard('3', 'hearts')]);
  setHand(game, 1, [makeCard('K', 'hearts'), makeCard('K', 'spades'), makeCard('5', 'hearts')]);
  setHand(game, 2, [makeCard('9', 'clubs'), makeCard('10', 'clubs')]);
  setHand(game, 3, [makeCard('A', 'clubs'), makeCard('A', 'diamonds')]);

  // A plays pair K
  let result = game.playCards('p0', ['clubs-K', 'diamonds-K']);
  assert(result.success, 'A plays pair K', JSON.stringify(result));
  assert(game.currentPlayerIndex === 1, 'Turn goes to B', `currentPlayerIndex=${game.currentPlayerIndex}`);

  // B plays pair K -> STOP -> C skipped
  result = game.playCards('p1', ['hearts-K', 'spades-K']);
  assert(result.success, 'B plays pair K', JSON.stringify(result));
  assert(game.currentPlayerIndex === 3, 'C is skipped, turn goes to D (index 3)', `currentPlayerIndex=${game.currentPlayerIndex}`);
}

// ====================================================================
console.log('\nTest 3: Joker mirror stop (A plays pair K, B plays K + Joker mirror -> C skipped)');
// ====================================================================
{
  const game = createTestGame(4);

  setHand(game, 0, [makeCard('K', 'clubs'), makeCard('K', 'diamonds'), makeCard('3', 'hearts')]);
  setHand(game, 1, [makeCard('K', 'hearts'), makeCard('joker', '1'), makeCard('5', 'hearts')]);
  setHand(game, 2, [makeCard('9', 'clubs'), makeCard('10', 'clubs')]);
  setHand(game, 3, [makeCard('A', 'clubs'), makeCard('A', 'diamonds')]);

  // A plays pair K
  let result = game.playCards('p0', ['clubs-K', 'diamonds-K']);
  assert(result.success, 'A plays pair K', JSON.stringify(result));
  assert(game.currentPlayerIndex === 1, 'Turn goes to B', `currentPlayerIndex=${game.currentPlayerIndex}`);

  // B plays K + Joker (mirror K) -> STOP because effective rank K == pile top K
  result = game.playCards('p1', ['hearts-K', 'joker-1']);
  assert(result.success, 'B plays K + Joker (mirror K)', JSON.stringify(result));
  assert(game.currentPlayerIndex === 3, 'C is skipped, turn goes to D (index 3)', `currentPlayerIndex=${game.currentPlayerIndex}`);
}

// ====================================================================
console.log('\nTest 4: Joker mirror pair stop (A plays pair 8, B plays 8 + Joker mirror 8 -> C skipped)');
// ====================================================================
{
  const game = createTestGame(4);

  setHand(game, 0, [makeCard('8', 'clubs'), makeCard('8', 'diamonds'), makeCard('3', 'hearts')]);
  setHand(game, 1, [makeCard('8', 'spades'), makeCard('joker', '1'), makeCard('5', 'hearts')]);
  setHand(game, 2, [makeCard('9', 'clubs'), makeCard('10', 'clubs')]);
  setHand(game, 3, [makeCard('A', 'clubs'), makeCard('A', 'diamonds')]);

  // A plays pair 8
  let result = game.playCards('p0', ['clubs-8', 'diamonds-8']);
  assert(result.success, 'A plays pair 8', JSON.stringify(result));
  assert(game.currentPlayerIndex === 1, 'Turn goes to B', `currentPlayerIndex=${game.currentPlayerIndex}`);

  // B plays 8 + Joker (mirror 8) -> STOP
  result = game.playCards('p1', ['spades-8', 'joker-1']);
  assert(result.success, 'B plays 8 + Joker (mirror 8)', JSON.stringify(result));
  assert(game.currentPlayerIndex === 3, 'C is skipped, turn goes to D (index 3)', `currentPlayerIndex=${game.currentPlayerIndex}`);
}

// ====================================================================
console.log('\nTest 5: Stop with burst override (A plays 6, B plays 6, C has quartet -> C not skipped)');
// ====================================================================
{
  const game = createTestGame(4);

  // A has one 6
  setHand(game, 0, [makeCard('6', 'clubs'), makeCard('3', 'hearts'), makeCard('4', 'hearts')]);
  // B has one 6
  setHand(game, 1, [makeCard('6', 'diamonds'), makeCard('5', 'hearts'), makeCard('4', 'diamonds')]);
  // C has the other two 6s (+ the two from pile = 4 total for burst)
  setHand(game, 2, [makeCard('6', 'hearts'), makeCard('6', 'spades'), makeCard('10', 'clubs')]);
  setHand(game, 3, [makeCard('K', 'clubs'), makeCard('A', 'clubs')]);

  // A plays 6
  let result = game.playCards('p0', ['clubs-6']);
  assert(result.success, 'A plays 6', JSON.stringify(result));

  // B plays 6 -> stop triggered, but C can burst
  result = game.playCards('p1', ['diamonds-6']);
  assert(result.success, 'B plays 6', JSON.stringify(result));
  // C should NOT be skipped because C can burst with their two 6s + two on pile
  assert(game.currentPlayerIndex === 2, 'C is NOT skipped (can burst)', `currentPlayerIndex=${game.currentPlayerIndex}`);

  // Verify C can indeed burst
  const bursts = game.getPossibleBursts('p2');
  assert(bursts.length > 0, 'C has a possible burst', JSON.stringify(bursts));
}

// ====================================================================
console.log('\nTest 6: Not a stop (different value) — A plays 6, B plays 7 -> C gets turn');
// ====================================================================
{
  const game = createTestGame(4);

  setHand(game, 0, [makeCard('6', 'clubs'), makeCard('3', 'hearts'), makeCard('4', 'hearts')]);
  setHand(game, 1, [makeCard('7', 'diamonds'), makeCard('5', 'hearts'), makeCard('4', 'diamonds')]);
  setHand(game, 2, [makeCard('9', 'clubs'), makeCard('10', 'clubs')]);
  setHand(game, 3, [makeCard('K', 'clubs'), makeCard('A', 'clubs')]);

  // A plays 6
  let result = game.playCards('p0', ['clubs-6']);
  assert(result.success, 'A plays 6', JSON.stringify(result));

  // B plays 7 -> NOT a stop (different rank)
  result = game.playCards('p1', ['diamonds-7']);
  assert(result.success, 'B plays 7', JSON.stringify(result));
  // C should get the turn (no skip)
  assert(game.currentPlayerIndex === 2, 'C is NOT skipped (different rank, no stop)', `currentPlayerIndex=${game.currentPlayerIndex}`);
}

// ====================================================================
console.log('\n========================================');
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log('========================================');
process.exit(failed > 0 ? 1 : 0);
