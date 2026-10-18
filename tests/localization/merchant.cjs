const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const ml = require('../../backend/locales/ml.json');
const en = require('../../backend/locales/en.json');
const files = ['src/pages/MerchantOverview.tsx', 'src/pages/More.tsx', 'src/pages/MerchantProfile.tsx', 'src/components/ShopCheckout.tsx'];
let checked = 0;
for (const file of files) {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const checkLiteral = node => {
    if (ts.isStringLiteral(node) && /[A-Za-z]{3}/.test(node.text)) {
      const key = 'ui.' + node.text.trim().replace(/\s+/g, ' ');
      assert.ok(ml[key], `${file}: missing Malayalam entry ${key}`);
      assert.ok(en[key], `${file}: missing English entry ${key}`);
      checked++;
    }
    ts.forEachChild(node, checkLiteral);
  };
  const walk = node => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'uiText') checkLiteral(node.arguments[0]);
    ts.forEachChild(node, walk);
  };
  walk(source);
}
for (const phrase of ['Overview','Insights','Purchases this month','New customers','Returning customers','Give your customers another reason to come back.','Store name','Merchant code']) {
  assert.match(ml['ui.' + phrase], /[\u0d00-\u0d7f]/, phrase);
}
// Exercise the real helper, including labels with variable chart/report numbers.
const fakeI18n = { resolvedLanguage: 'ml', exists: key => !!ml[key], t: (key, values = {}) => String((fakeI18n.resolvedLanguage === 'ml' ? ml : en)[key] || values.defaultValue || key).replace(/\{\{(\w+)\}\}/g, (_, name) => values[name] ?? '') };
const code = ts.transpileModule(fs.readFileSync('src/uiText.ts','utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const scope = { exports: {}, require: () => ({ default: fakeI18n }) };
vm.runInNewContext(code, scope);
assert.equal(scope.exports.uiText('Week 3'), 'ആഴ്ച 3');
assert.equal(scope.exports.uiText('Hello, {{name}}', { name: 'Test Store' }), 'നമസ്കാരം, Test Store');
assert.match(scope.exports.uiText('vs first 18 days of last month'), /18/);
assert.doesNotMatch(scope.exports.uiText('vs first 18 days of last month'), /last month/);
fakeI18n.resolvedLanguage = 'en';
assert.equal(scope.exports.uiText('Week 3'), 'Week 3');
assert.equal(scope.exports.uiText('Give your customers another reason to come back.'), 'Give your customers another reason to come back.');
console.log(`PASS: ${checked} merchant UI literals, Malayalam headings, interpolation and English fallback`);
