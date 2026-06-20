const assert = require('assert');

function stripComments(text) {
  if (!text) return text;
  return text.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, '').trim();
}

try {
  assert.strictEqual(stripComments('1girl, // red hair'), '1girl,');
  assert.strictEqual(stripComments('1girl, /* red hair, */ blue eyes'), '1girl,  blue eyes');
  assert.strictEqual(stripComments('/* = */ red hair'), 'red hair'); // trimmed
  console.log('All tests passed!');
} catch (e) {
  console.error('Test failed:', e.message);
  process.exit(1);
}
