const assert = require('assert');
const { CycleGame } = require('./cycle-engine.js');

const a = new CycleGame(null, { groupSize: 3, targetPoints: 3 });
const b = new CycleGame(null, { groupSize: 3, targetPoints: 3 });

const moves = [
  [0,0], [20,20],
  [1,0], [21,20],
  [2,0], // X +1, bonus turn
  [5,5], // X bonus move, no score -> O
  [22,20], // O +1, bonus turn
  [30,30] // O bonus move
];

for (const [x,y] of moves) {
  const ra = a.play(x,y);
  const rb = b.play(x,y);
  assert.strictEqual(ra.ok, true, `A rejected ${x},${y}`);
  assert.strictEqual(rb.ok, true, `B rejected ${x},${y}`);
  assert.deepStrictEqual(b.serialize(), a.serialize(), `desync after ${x},${y}`);
}

assert.strictEqual(a.scores.X, 1);
assert.strictEqual(a.scores.O, 1);
assert.strictEqual(a.turn, 'X');
console.log('PASS online deterministic sync simulation');
