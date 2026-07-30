(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CycleCaro = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const DIRECTIONS = Object.freeze([
    Object.freeze({ id: 'H',  dx: 1, dy: 0, label: 'Ngang' }),
    Object.freeze({ id: 'V',  dx: 0, dy: 1, label: 'Dọc' }),
    Object.freeze({ id: 'D1', dx: 1, dy: 1, label: 'Chéo ↘' }),
    Object.freeze({ id: 'D2', dx: 1, dy: -1, label: 'Chéo ↗' })
  ]);

  const keyOf = (x, y) => `${x},${y}`;
  const clampInt = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isInteger(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  };

  function lineKey(direction, x, y) {
    if (direction.id === 'H') return `H:${y}`;
    if (direction.id === 'V') return `V:${x}`;
    if (direction.id === 'D1') return `D1:${x - y}`;
    return `D2:${x + y}`;
  }

  function compareCellsAlongDirection(a, b, direction) {
    if (direction.dx !== 0) return a.x - b.x;
    return a.y - b.y;
  }

  class CycleGame {
    constructor(snapshot, options = {}) {
      this.reset(options);
      if (snapshot) this.load(snapshot, options);
    }

    reset(options = {}) {
      this.groupSize = clampInt(options.groupSize, 3, 25, 5);
      this.targetPoints = clampInt(options.targetPoints, 1, 99, 5);
      this.board = new Map();
      this.turn = 'X';
      this.moveNumber = 0;
      this.scores = { X: 0, O: 0 };
      this.cycles = [];
      this.claimedByLine = new Map();
      this.lastMove = null;
      this.finished = false;
      this.winner = null;
    }

    get(x, y) {
      return this.board.get(keyOf(x, y)) || null;
    }

    isEmpty(x, y) {
      return !this.board.has(keyOf(x, y));
    }

    play(x, y) {
      if (this.finished) return { ok: false, reason: 'finished', winner: this.winner };
      if (!Number.isSafeInteger(x) || !Number.isSafeInteger(y)) {
        return { ok: false, reason: 'invalid-coordinate' };
      }
      if (!this.isEmpty(x, y)) {
        return { ok: false, reason: 'occupied' };
      }

      const player = this.turn;
      this.moveNumber += 1;
      this.board.set(keyOf(x, y), player);
      this.lastMove = { x, y, player, moveNumber: this.moveNumber };

      const newCycles = this._detectNewCycles(x, y, player);
      for (const cycle of newCycles) this._claimCycle(cycle);

      const scored = newCycles.length > 0;
      if (this.scores[player] >= this.targetPoints) {
        this.finished = true;
        this.winner = player;
      } else if (scored) {
        // Bonus-turn rule: scoring at least one point keeps the turn.
        // Even if one move creates multiple points in different directions,
        // it still grants one bonus move, not one bonus move per point.
        this.turn = player;
      } else {
        this.turn = player === 'X' ? 'O' : 'X';
      }

      return {
        ok: true,
        player,
        x,
        y,
        newCycles,
        bonusTurn: scored && !this.finished,
        scores: { ...this.scores },
        nextTurn: this.turn,
        finished: this.finished,
        winner: this.winner,
        groupSize: this.groupSize,
        targetPoints: this.targetPoints
      };
    }

    _detectNewCycles(x, y, player) {
      const found = [];
      for (const direction of DIRECTIONS) {
        const candidate = this._candidateForDirection(x, y, player, direction);
        if (candidate) found.push(candidate);
      }
      return found;
    }

    _candidateForDirection(x, y, player, direction) {
      const needed = this.groupSize;
      const negative = [];
      for (let step = 1; ; step += 1) {
        const cx = x - direction.dx * step;
        const cy = y - direction.dy * step;
        if (this.get(cx, cy) !== player) break;
        negative.push({ x: cx, y: cy });
      }
      negative.reverse();

      const positive = [];
      for (let step = 1; ; step += 1) {
        const cx = x + direction.dx * step;
        const cy = y + direction.dy * step;
        if (this.get(cx, cy) !== player) break;
        positive.push({ x: cx, y: cy });
      }

      const run = [...negative, { x, y }, ...positive]
        .sort((a, b) => compareCellsAlongDirection(a, b, direction));
      if (run.length < needed) return null;

      const moveIndex = run.findIndex(cell => cell.x === x && cell.y === y);
      const startMin = Math.max(0, moveIndex - (needed - 1));
      const startMax = Math.min(moveIndex, run.length - needed);
      const claimed = this.claimedByLine.get(lineKey(direction, x, y)) || new Set();

      // A point uses exactly groupSize cells. A previously scored cell cannot be
      // reused on the same line/direction, so extending N cells to N+1 does not
      // automatically create another point. A later disjoint block can score.
      const windows = [];
      for (let start = startMin; start <= startMax; start += 1) {
        const cells = run.slice(start, start + needed);
        if (cells.some(cell => claimed.has(keyOf(cell.x, cell.y)))) continue;
        const center = start + (needed - 1) / 2;
        windows.push({ cells, distance: Math.abs(center - moveIndex), start });
      }
      if (!windows.length) return null;

      windows.sort((a, b) => a.distance - b.distance || a.start - b.start);
      const cells = windows[0].cells;
      return {
        id: `P${this.cycles.length + 1}-${this.moveNumber}-${direction.id}`,
        player,
        direction: direction.id,
        directionLabel: direction.label,
        lineKey: lineKey(direction, x, y),
        cells,
        moveNumber: this.moveNumber
      };
    }

    _claimCycle(cycle) {
      this.cycles.push(cycle);
      this.scores[cycle.player] += 1;
      let claimed = this.claimedByLine.get(cycle.lineKey);
      if (!claimed) {
        claimed = new Set();
        this.claimedByLine.set(cycle.lineKey, claimed);
      }
      for (const cell of cycle.cells) claimed.add(keyOf(cell.x, cell.y));
    }

    serialize() {
      return {
        version: 2,
        groupSize: this.groupSize,
        targetPoints: this.targetPoints,
        turn: this.turn,
        moveNumber: this.moveNumber,
        scores: { ...this.scores },
        board: Array.from(this.board.entries()),
        cycles: this.cycles.map(cycle => ({
          ...cycle,
          cells: cycle.cells.map(cell => ({ ...cell }))
        })),
        lastMove: this.lastMove ? { ...this.lastMove } : null,
        finished: this.finished,
        winner: this.winner
      };
    }

    load(snapshot, options = {}) {
      if (!snapshot || ![1, 2].includes(snapshot.version) || !Array.isArray(snapshot.board)) {
        throw new Error('Snapshot Caro không hợp lệ.');
      }
      this.reset({
        groupSize: snapshot.groupSize ?? options.groupSize ?? 5,
        targetPoints: snapshot.targetPoints ?? options.targetPoints ?? 5
      });
      this.turn = snapshot.turn === 'O' ? 'O' : 'X';
      this.moveNumber = Number.isFinite(snapshot.moveNumber) ? snapshot.moveNumber : 0;
      this.scores = {
        X: Number(snapshot.scores?.X) || 0,
        O: Number(snapshot.scores?.O) || 0
      };
      this.board = new Map(snapshot.board);
      this.cycles = Array.isArray(snapshot.cycles) ? snapshot.cycles : [];
      this.lastMove = snapshot.lastMove || null;
      this.finished = Boolean(snapshot.finished) || this.scores.X >= this.targetPoints || this.scores.O >= this.targetPoints;
      this.winner = snapshot.winner === 'X' || snapshot.winner === 'O'
        ? snapshot.winner
        : this.scores.X >= this.targetPoints ? 'X' : this.scores.O >= this.targetPoints ? 'O' : null;
      for (const cycle of this.cycles) {
        let claimed = this.claimedByLine.get(cycle.lineKey);
        if (!claimed) {
          claimed = new Set();
          this.claimedByLine.set(cycle.lineKey, claimed);
        }
        for (const cell of cycle.cells || []) claimed.add(keyOf(cell.x, cell.y));
      }
    }
  }

  return { CycleGame, DIRECTIONS, keyOf, lineKey };
});
