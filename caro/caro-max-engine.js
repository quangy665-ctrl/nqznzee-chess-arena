(function (root, factory) {
  const cycleApi = (typeof module === 'object' && module.exports)
    ? require('./cycle-engine.js')
    : root.CycleCaro;
  const api = factory(cycleApi);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.NQZCaroMax = api;
})(typeof window !== 'undefined' ? window : globalThis, function (CycleApi) {
  'use strict';

  if (!CycleApi) throw new Error('NQZCaroMax cần CycleCaro.');
  const { CycleGame, DIRECTIONS, keyOf, lineKey } = CycleApi;

  const WIN_VALUE = 1_000_000_000_000;
  const SCORE_VALUE = 42_000_000;
  const TIMEOUT = Symbol('NQZ_MAX_TIMEOUT');

  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  function other(player) { return player === 'X' ? 'O' : 'X'; }
  function parseKey(key) {
    const comma = key.indexOf(',');
    return { x: Number(key.slice(0, comma)), y: Number(key.slice(comma + 1)) };
  }

  function countHypotheticalLine(state, player, x, y, direction) {
    let negative = 0;
    let positive = 0;
    const scan = Math.max(5, Math.min(27, (state.groupSize || 5) + 2));
    for (let step = 1; step <= scan; step += 1) {
      if (state.get(x - direction.dx * step, y - direction.dy * step) !== player) break;
      negative += 1;
    }
    for (let step = 1; step <= scan; step += 1) {
      if (state.get(x + direction.dx * step, y + direction.dy * step) !== player) break;
      positive += 1;
    }
    const ax = x - direction.dx * (negative + 1);
    const ay = y - direction.dy * (negative + 1);
    const bx = x + direction.dx * (positive + 1);
    const by = y + direction.dy * (positive + 1);
    const openEnds = (state.isEmpty(ax, ay) ? 1 : 0) + (state.isEmpty(bx, by) ? 1 : 0);
    return { length: 1 + negative + positive, negative, positive, openEnds };
  }

  // Pure version of CycleGame's scoring detector. It respects already-claimed cells,
  // so MAX does not hallucinate points from a group that was scored earlier.
  function wouldScoreDirections(state, player, x, y) {
    if (!state.isEmpty(x, y)) return [];
    const needed = Math.max(3, state.groupSize || 5);
    const scored = [];

    for (const direction of DIRECTIONS) {
      const negative = [];
      for (let step = 1; ; step += 1) {
        const cx = x - direction.dx * step;
        const cy = y - direction.dy * step;
        if (state.get(cx, cy) !== player) break;
        negative.push({ x: cx, y: cy });
      }
      negative.reverse();

      const positive = [];
      for (let step = 1; ; step += 1) {
        const cx = x + direction.dx * step;
        const cy = y + direction.dy * step;
        if (state.get(cx, cy) !== player) break;
        positive.push({ x: cx, y: cy });
      }

      const run = [...negative, { x, y }, ...positive];
      if (run.length < needed) continue;
      const moveIndex = negative.length;
      const startMin = Math.max(0, moveIndex - (needed - 1));
      const startMax = Math.min(moveIndex, run.length - needed);
      const claimed = state.claimedByLine.get(lineKey(direction, x, y)) || new Set();

      let legalWindow = false;
      for (let start = startMin; start <= startMax; start += 1) {
        const cells = run.slice(start, start + needed);
        if (cells.some(cell => claimed.has(keyOf(cell.x, cell.y)))) continue;
        legalWindow = true;
        break;
      }
      if (legalWindow) scored.push(direction.id);
    }
    return scored;
  }

  function patternScore(state, player, x, y) {
    const needed = Math.max(3, state.groupSize || 5);
    let score = 0;
    let threats = 0;
    for (const direction of DIRECTIONS) {
      const line = countHypotheticalLine(state, player, x, y, direction);
      const capped = Math.min(line.length, needed);
      const progress = capped / needed;
      let value;
      if (capped >= needed) value = 6_000_000;
      else {
        const exponent = Math.min(7, Math.max(0, capped - 1));
        value = 22 * Math.pow(7.2, exponent) * (1 + progress * 2.2);
      }
      value *= 1 + line.openEnds * 0.34;
      score += value;
      if (capped >= Math.max(2, needed - 2) && line.openEnds) threats += 1;
    }
    if (threats >= 2) score += 620_000 * threats;
    return { score, threats };
  }

  function candidateCells(state, radius = 2) {
    if (!state.board.size) return [{ x: 0, y: 0 }];
    const seen = new Set();
    const out = [];
    for (const key of state.board.keys()) {
      const c = parseKey(key);
      for (let dy = -radius; dy <= radius; dy += 1) {
        for (let dx = -radius; dx <= radius; dx += 1) {
          if (dx === 0 && dy === 0) continue;
          // Corners two cells away are low-value noise on large boards.
          if (radius > 1 && Math.abs(dx) === radius && Math.abs(dy) === radius) continue;
          const x = c.x + dx;
          const y = c.y + dy;
          const k = keyOf(x, y);
          if (seen.has(k) || !state.isEmpty(x, y)) continue;
          seen.add(k);
          out.push({ x, y });
        }
      }
    }
    return out;
  }

  function candidateInfo(state, player, opponent, cell) {
    const ownDirs = wouldScoreDirections(state, player, cell.x, cell.y);
    const oppDirs = wouldScoreDirections(state, opponent, cell.x, cell.y);
    const ownPattern = patternScore(state, player, cell.x, cell.y);
    const oppPattern = patternScore(state, opponent, cell.x, cell.y);
    const ownWin = state.scores[player] + ownDirs.length >= state.targetPoints;
    const blocksWin = state.scores[opponent] + oppDirs.length >= state.targetPoints;
    const dist = state.lastMove ? Math.hypot(cell.x - state.lastMove.x, cell.y - state.lastMove.y) : 0;

    let priority = ownPattern.score * 1.16 + oppPattern.score * 1.09;
    priority += ownDirs.length * 31_000_000;
    priority += oppDirs.length * 27_000_000;
    if (ownDirs.length >= 2) priority += 18_000_000;
    if (oppDirs.length >= 2) priority += 16_000_000;
    if (ownWin) priority += 900_000_000_000;
    if (blocksWin) priority += 760_000_000_000;
    priority -= dist * 0.12;

    return {
      ...cell,
      priority,
      ownCycles: ownDirs.length,
      oppCycles: oppDirs.length,
      ownWin,
      blocksWin,
      ownThreats: ownPattern.threats,
      oppThreats: oppPattern.threats
    };
  }

  function orderedCandidates(state, player, opponent, limit = 12, radius = 2) {
    const cells = candidateCells(state, radius);
    const scored = cells.map(cell => candidateInfo(state, player, opponent, cell));
    scored.sort((a, b) => b.priority - a.priority);
    return scored.slice(0, Math.max(1, limit));
  }

  function tacticalCandidates(state, player, opponent, limit = 8) {
    const candidates = orderedCandidates(state, player, opponent, Math.max(18, limit * 2), 2);
    const tactical = candidates.filter(c => c.ownCycles > 0 || c.oppCycles > 0 || c.ownThreats >= 2 || c.oppThreats >= 2);
    return (tactical.length ? tactical : candidates).slice(0, limit);
  }

  function simulateMove(state, player, x, y) {
    const clone = new CycleGame(state.serialize());
    clone.turn = player;
    const result = clone.play(x, y);
    return result.ok ? { state: clone, result } : null;
  }

  function hasImmediateWin(state, player, opponent) {
    const candidates = orderedCandidates(state, player, opponent, 18, 2);
    return candidates.some(c => c.ownWin);
  }

  function quickEvaluation(state, bot, human, ctx) {
    if (state.finished) {
      if (state.winner === bot) return WIN_VALUE - state.moveNumber * 1000;
      if (state.winner === human) return -WIN_VALUE + state.moveNumber * 1000;
    }

    const cacheKey = ctx && state.board.size <= 70 ? evaluationKey(state) : null;
    if (cacheKey && ctx.evalCache.has(cacheKey)) return ctx.evalCache.get(cacheKey);

    let value = (state.scores[bot] - state.scores[human]) * SCORE_VALUE;
    const botNeed = Math.max(0, state.targetPoints - state.scores[bot]);
    const humanNeed = Math.max(0, state.targetPoints - state.scores[human]);
    value += (humanNeed - botNeed) * 4_200_000;

    const botTop = orderedCandidates(state, bot, human, 5, 2);
    const humanTop = orderedCandidates(state, human, bot, 5, 2);
    if (botTop[0]) {
      value += Math.min(botTop[0].priority, 36_000_000) * 0.19;
      value += botTop.filter(c => c.ownCycles > 0).length * 2_700_000;
      if (botTop.filter(c => c.ownCycles > 0).length >= 2) value += 4_800_000;
    }
    if (humanTop[0]) {
      value -= Math.min(humanTop[0].priority, 36_000_000) * 0.22;
      value -= humanTop.filter(c => c.ownCycles > 0).length * 3_150_000;
      if (humanTop.filter(c => c.ownCycles > 0).length >= 2) value -= 6_200_000;
    }

    // Side to move matters more under the bonus-turn rule because a scorer keeps initiative.
    value += state.turn === bot ? 190_000 : -210_000;
    if (cacheKey) ctx.evalCache.set(cacheKey, value);
    return value;
  }

  function evaluationKey(state) {
    let key = `${state.turn}|${state.scores.X},${state.scores.O}|${state.groupSize}|${state.targetPoints}|`;
    for (const [cell, piece] of state.board) key += `${cell}${piece};`;
    key += '|';
    for (const cycle of state.cycles) {
      key += `${cycle.lineKey}:${(cycle.cells || []).map(c => keyOf(c.x, c.y)).join('.')};`;
    }
    return key;
  }

  function checkDeadline(ctx) {
    ctx.nodes += 1;
    if ((ctx.nodes & 31) === 0 && now() >= ctx.deadline) throw TIMEOUT;
  }

  function search(state, depth, alpha, beta, bot, human, ctx, extensionBudget) {
    checkDeadline(ctx);
    if (state.finished) return quickEvaluation(state, bot, human, ctx);

    const player = state.turn;
    const opponent = other(player);
    let tacticalOnly = false;

    if (depth <= 0) {
      if (extensionBudget > 0) {
        const tactical = tacticalCandidates(state, player, opponent, 5);
        const hasTactic = tactical.some(c => c.ownCycles > 0 || c.oppCycles > 0 || c.ownWin || c.blocksWin);
        if (hasTactic) {
          depth = 1;
          extensionBudget -= 1;
          tacticalOnly = true;
        } else {
          return quickEvaluation(state, bot, human, ctx);
        }
      } else {
        return quickEvaluation(state, bot, human, ctx);
      }
    }

    let limit;
    if (depth >= 4) limit = 7;
    else if (depth === 3) limit = 8;
    else if (depth === 2) limit = 9;
    else limit = 7;

    let moves = tacticalOnly
      ? tacticalCandidates(state, player, opponent, limit)
      : orderedCandidates(state, player, opponent, limit, 2);

    if (!moves.length) return quickEvaluation(state, bot, human, ctx);

    // Exact winning moves are always first; alpha-beta then prunes the rest immediately.
    moves.sort((a, b) => Number(b.ownWin) - Number(a.ownWin) || b.priority - a.priority);

    const maximizing = player === bot;
    let best = maximizing ? -Infinity : Infinity;

    for (const move of moves) {
      checkDeadline(ctx);
      const sim = simulateMove(state, player, move.x, move.y);
      if (!sim) continue;

      if (sim.result.finished) {
        const terminal = sim.result.winner === bot
          ? WIN_VALUE - ctx.ply * 10_000
          : -WIN_VALUE + ctx.ply * 10_000;
        if (maximizing) {
          best = Math.max(best, terminal);
          alpha = Math.max(alpha, best);
        } else {
          best = Math.min(best, terminal);
          beta = Math.min(beta, best);
        }
        if (beta <= alpha) break;
        continue;
      }

      let nextDepth = depth - 1;
      let nextExtension = extensionBudget;
      if (sim.result.bonusTurn && extensionBudget > 0) {
        // A scoring move keeps the same player. Extend one move so a score+bonus combo
        // is not cut off merely because conventional chess-like ply depth expired.
        nextDepth += 1;
        nextExtension -= 1;
      }

      ctx.ply += 1;
      const score = search(sim.state, nextDepth, alpha, beta, bot, human, ctx, nextExtension);
      ctx.ply -= 1;

      if (maximizing) {
        if (score > best) best = score;
        if (best > alpha) alpha = best;
      } else {
        if (score < best) best = score;
        if (best < beta) beta = best;
      }
      if (beta <= alpha) break;
    }

    return Number.isFinite(best) ? best : quickEvaluation(state, bot, human, ctx);
  }

  function safeRootMoves(state, bot, human, candidates, ctx) {
    const safe = [];
    const unsafe = [];
    for (const move of candidates) {
      if (now() >= ctx.deadline) break;
      const sim = simulateMove(state, bot, move.x, move.y);
      if (!sim) continue;
      if (sim.result.finished && sim.result.winner === bot) return [move];

      // If scoring gives MAX another turn, the opponent cannot win immediately yet.
      const exposesImmediateLoss = sim.state.turn === human && hasImmediateWin(sim.state, human, bot);
      (exposesImmediateLoss ? unsafe : safe).push(move);
    }
    return safe.length ? safe : (unsafe.length ? unsafe : candidates);
  }

  function searchRoot(state, bot, human, depth, ctx, preferredMove) {
    let root = orderedCandidates(state, bot, human, 15, 2);
    if (!root.length) return { move: { x: 0, y: 0 }, value: -Infinity };

    const win = root.find(c => c.ownWin);
    if (win) return { move: win, value: WIN_VALUE };

    root = safeRootMoves(state, bot, human, root, ctx);
    if (preferredMove) {
      root.sort((a, b) => {
        const ap = a.x === preferredMove.x && a.y === preferredMove.y ? 1 : 0;
        const bp = b.x === preferredMove.x && b.y === preferredMove.y ? 1 : 0;
        return bp - ap || b.priority - a.priority;
      });
    }

    let alpha = -Infinity;
    const beta = Infinity;
    let bestMove = root[0];
    let bestValue = -Infinity;

    for (const move of root) {
      checkDeadline(ctx);
      const sim = simulateMove(state, bot, move.x, move.y);
      if (!sim) continue;

      let value;
      if (sim.result.finished) value = WIN_VALUE;
      else {
        let nextDepth = depth - 1;
        let extensionBudget = 2;
        if (sim.result.bonusTurn) {
          nextDepth += 1;
          extensionBudget -= 1;
        }
        ctx.ply = 1;
        value = search(sim.state, nextDepth, alpha, beta, bot, human, ctx, extensionBudget);
      }

      // Root ordering remains a tiny tie-breaker, never enough to override a tactical result.
      value += Math.min(90_000, move.priority * 0.00008);
      if (value > bestValue) {
        bestValue = value;
        bestMove = move;
      }
      alpha = Math.max(alpha, bestValue);
    }

    return { move: bestMove, value: bestValue };
  }

  function chooseMove(state, bot = 'O', human = 'X', options = {}) {
    const timeMs = Math.max(180, Math.min(3500, Number(options.timeMs) || 1350));
    const start = now();
    const ctx = {
      deadline: start + timeMs,
      nodes: 0,
      ply: 0,
      evalCache: new Map()
    };

    if (!state || state.finished) return { x: 0, y: 0 };
    const root = orderedCandidates(state, bot, human, 18, 2);
    if (!root.length) return { x: 0, y: 0 };
    const immediateWin = root.find(c => c.ownWin);
    if (immediateWin) return { x: immediateWin.x, y: immediateWin.y };

    let best = root[0];
    let completedDepth = 0;
    const boardSize = state.board.size;
    const maxDepth = boardSize <= 18 ? 5 : boardSize <= 42 ? 4 : 4;

    for (let depth = 2; depth <= maxDepth; depth += 1) {
      if (now() >= ctx.deadline - 30) break;
      try {
        const result = searchRoot(state, bot, human, depth, ctx, best);
        if (result?.move) best = result.move;
        completedDepth = depth;
      } catch (error) {
        if (error !== TIMEOUT) throw error;
        break;
      }
    }

    chooseMove.lastStats = {
      nodes: ctx.nodes,
      depth: completedDepth,
      elapsedMs: Math.round(now() - start),
      move: { x: best.x, y: best.y }
    };
    return { x: best.x, y: best.y };
  }

  chooseMove.lastStats = { nodes: 0, depth: 0, elapsedMs: 0, move: null };

  return {
    chooseMove,
    wouldScoreDirections,
    orderedCandidates,
    patternScore,
    getLastStats: () => ({ ...chooseMove.lastStats })
  };
});
