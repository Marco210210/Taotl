const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');

const source = fs.readFileSync('src/game/classicaTable.ts', 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;
const exportsObject = {};
new Function('exports', compiled)(exportsObject);
const table = exportsObject.CLASSICA_TABLE;

assert.deepEqual(table[7], [10, 8, 5, 3, 2, 1]);
for (let players = 2; players <= 12; players++) {
  const rounds = table[players];
  assert.equal(rounds.length, 6);
  assert.deepEqual(rounds.slice(-3), [3, 2, 1]);
  rounds.forEach((cards, index) => {
    assert(Number.isInteger(cards) && cards > 0 && cards * players <= 72);
    if (index) assert(cards < rounds[index - 1]);
  });
}
console.log('Classica: seven-player regression and deck limits passed');
