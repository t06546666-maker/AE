const assert = require('node:assert/strict'),
  fs = require('node:fs'),
  vm = require('node:vm'),
  ts = require('typescript');
const source = fs.readFileSync(require.resolve('../src/merchantPoster.ts'), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require: id => {
    assert.match(id, /merchant-qr-poster\.css\?inline$/);
    return '';
  },
});
const { headingPresets, assignedHeading, batchPosterDocument, singlePosterDocument } = exportsObject;

assert.equal(headingPresets.length, 4);
assert.equal(headingPresets[0].lines[1], 'നമ്മുടെ സ്ഥാപനങ്ങൾ');
assert.deepEqual(
  Array.from({ length: 6 }, (_, i) => assignedHeading(i, true, 0).id),
  ['original', 'happiness', 'savings', 'growth', 'original', 'happiness']
);
assert.equal(assignedHeading(5, false, 2).id, 'savings');

// 1. Default A3 4-in-1 layout test with 6 shops (produces 2 A3 sheets: Sheet 1 with 4, Sheet 2 with 2 + 2 empty slots)
const htmlA3 = batchPosterDocument(
  'data:image/png;base64,AA',
  Array.from({ length: 6 }, (_, i) => ({
    name: `Shop ${i + 1}<script>`,
    merchant_code: `M00${i + 1}&code`,
    qr: `data:image/svg+xml,test${i}`,
    lines: assignedHeading(i, true, 0).lines,
  })),
  { size: 27, weight: 900, design: 'bold', scan: 'സ്കാൻ ചെയ്യൂ' }
);

assert.equal((htmlA3.match(/<article /g) || []).length, 6);
assert.equal((htmlA3.match(/class="ae-a3-sheet"/g) || []).length, 2);
assert.equal((htmlA3.match(/ae-a3-slot-empty/g) || []).length, 2);
assert.ok(htmlA3.includes('@page{size:A3 portrait;margin:0}'));
assert.ok(htmlA3.includes('break-after:page'));
assert.ok(!htmlA3.includes('<script>'));
assert.ok(htmlA3.includes('Shop 6&lt;script&gt;'));
assert.ok(htmlA3.includes('M001&amp;code'));
for (let i = 0; i < 6; i++) assert.ok(htmlA3.includes(`data:image/svg+xml,test${i}`));

// 2. A5 single layout test
const htmlA5 = batchPosterDocument(
  'data:image/png;base64,AA',
  Array.from({ length: 6 }, (_, i) => ({
    name: `Shop ${i + 1}`,
    merchant_code: `M00${i + 1}`,
    qr: `data:image/svg+xml,test${i}`,
    lines: assignedHeading(i, true, 0).lines,
  })),
  { size: 27, weight: 900, design: 'bold', scan: 'സ്കാൻ ചെയ്യൂ', paperSize: 'A5' }
);
assert.equal((htmlA5.match(/<article /g) || []).length, 6);
assert.equal((htmlA5.match(/class="ae-a3-sheet"/g) || []).length, 0);
assert.ok(htmlA5.includes('@page{size:A5 portrait;margin:0}'));
assert.ok(htmlA5.includes('break-after:page'));

// 3. Single poster document test (A3: 4 copies on 1 sheet, A5: 1 copy)
const singleA3 = singlePosterDocument(
  'data:image/png;base64,AA',
  { name: 'Baker & Spice', merchant_code: 'BSP-01', qr: 'data:image/svg+xml,bsp', lines: headingPresets[0].lines },
  { size: 27, weight: 900, design: 'bold', scan: 'സ്കാൻ ചെയ്യൂ', paperSize: 'A3' }
);
assert.equal((singleA3.match(/<article /g) || []).length, 4, 'A3 single poster should repeat 4 copies on 1 sheet');
assert.ok(singleA3.includes('ae-a3-sheet'));
assert.ok(singleA3.includes('Baker &amp; Spice'));
assert.ok(singleA3.includes('BSP-01'));

const singleA5 = singlePosterDocument(
  'data:image/png;base64,AA',
  { name: 'Baker & Spice', merchant_code: 'BSP-01', qr: 'data:image/svg+xml,bsp', lines: headingPresets[0].lines },
  { size: 27, weight: 900, design: 'bold', scan: 'സ്കാൻ ചെയ്യൂ', paperSize: 'A5' }
);
assert.equal((singleA5.match(/<article /g) || []).length, 1);
assert.ok(!singleA5.includes('ae-a3-sheet'));

console.log('PASS: six-merchant rotation, A3 4-in-1 layout, empty slot placeholders, merchant code escaping, and A5 fallback');
