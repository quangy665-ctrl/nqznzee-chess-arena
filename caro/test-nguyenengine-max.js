'use strict';
const assert = require('assert');
const { CycleGame, keyOf } = require('./cycle-engine.js');
const Max = require('./caro-max-engine.js');

function stateWith(opts, pieces, turn='O', scores={X:0,O:0}) {
  const g = new CycleGame(null, opts);
  g.board.clear();
  let moveNumber = 0;
  for (const [x,y,p] of pieces) {
    g.board.set(keyOf(x,y), p);
    moveNumber += 1;
  }
  g.moveNumber = moveNumber;
  g.turn = turn;
  g.scores = {...scores};
  g.finished = false;
  g.winner = null;
  g.lastMove = pieces.length ? {x:pieces.at(-1)[0], y:pieces.at(-1)[1], player:pieces.at(-1)[2], moveNumber} : null;
  return g;
}

// 1) MAX must take a forced immediate win.
{
  const g = stateWith({groupSize:3,targetPoints:1}, [
    [-1,0,'X'], [0,0,'O'], [1,0,'O']
  ]);
  const m = Max.chooseMove(g,'O','X',{timeMs:450});
  assert.deepStrictEqual(m,{x:2,y:0}, `expected immediate win 2,0, got ${JSON.stringify(m)}`);
}

// 2) MAX must block the opponent's only immediate winning cell.
{
  const g = stateWith({groupSize:3,targetPoints:1}, [
    [-1,0,'O'], [0,0,'X'], [1,0,'X']
  ]);
  const m = Max.chooseMove(g,'O','X',{timeMs:650});
  assert.deepStrictEqual(m,{x:2,y:0}, `expected forced block 2,0, got ${JSON.stringify(m)}`);
  const sim = new CycleGame(g.serialize());
  sim.turn='O'; sim.play(m.x,m.y);
  const humanWins = Max.orderedCandidates(sim,'X','O',20,2).some(c => c.ownWin);
  assert.strictEqual(humanWins,false,'MAX block still leaves an immediate human win');
}

// 3) Scoring detector must respect already-claimed cells on the same line.
{
  const g = new CycleGame(null,{groupSize:3,targetPoints:5});
  g.turn='O'; g.play(0,0);
  g.turn='O'; g.play(1,0);
  g.turn='O'; const scored = g.play(2,0);
  assert.strictEqual(scored.newCycles.length,1);
  const dirs = Max.wouldScoreDirections(g,'O',3,0);
  assert.strictEqual(dirs.length,0,'extension of an already-claimed group must not score again');
}

// 4) In a normal position, returned move must be legal and search stats must be populated.
{
  const g = stateWith({groupSize:5,targetPoints:5}, [
    [0,0,'X'],[1,0,'O'],[0,1,'X'],[1,1,'O'],[-1,0,'X'],[2,1,'O']
  ]);
  const m = Max.chooseMove(g,'O','X',{timeMs:500});
  assert.ok(Number.isSafeInteger(m.x) && Number.isSafeInteger(m.y));
  assert.ok(g.isEmpty(m.x,m.y),'MAX returned an occupied cell');
  const stats = Max.getLastStats();
  assert.ok(stats.nodes > 0,'search did not visit nodes');
}

console.log('PASS NguyenEngine MAX tactical tests');
