const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const compiled = ts.transpileModule(fs.readFileSync('src/game/scoring.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exportsObject = {};
new Function('exports', compiled)(exportsObject);
const rounds = [
  { index: 1, results: [{ playerId: 'a', score: 100 }, { playerId: 'b', score: 20 }, { playerId: 'c', score: 30 }] },
  { index: 2, results: [{ playerId: 'a', score: -10 }, { playerId: 'b', score: 30 }, { playerId: 'c', score: 20 }] },
  { index: 3, results: [{ playerId: 'a', score: -100 }, { playerId: 'b', score: 60 }, { playerId: 'c', score: 0 }] },
];
const original = JSON.stringify(rounds);
const ranked = exportsObject.rankResultsByRound([...rounds].reverse(), ['a', 'b', 'c']);
assert.deepEqual(ranked.get(1).map(r => r.playerId), ['a', 'c', 'b']);
// Il delta di B è maggiore, ma A resta primo; B e C sono pari, risolti per posto.
assert.deepEqual(ranked.get(2).map(r => r.playerId), ['a', 'b', 'c']);
assert.deepEqual(ranked.get(3).map(r => r.playerId), ['b', 'c', 'a']);
assert.equal(JSON.stringify(rounds), original);
assert.equal(exportsObject.rankResultsByRound([], []).size, 0);
console.log('Round rankings: cumulative totals, ties, chronology and immutability passed');
