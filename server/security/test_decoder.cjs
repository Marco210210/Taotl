const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
// SDK 58 no longer depends on query-string; keep testing our decoder directly.
const decode = require('decode-uri-component');
assert.equal(decode('ciao+mondo'), 'ciao mondo');
assert.equal(decode('%C3%A8%20ok'), 'è ok');
assert.equal(decode('%F0%9F%98%80'), '😀');
assert.equal(decode('%FF'), '%FF');
const result = spawnSync(process.execPath, ['-e', "const decode=require('decode-uri-component'); if(decode('%FF'.repeat(1500)) !== '%FF'.repeat(1500)) process.exit(1)"], { timeout: 2000 });
assert.equal(result.error, undefined);
assert.equal(result.status, 0);
console.log('Decoder regression checks passed, including malformed URL timeout guard');
