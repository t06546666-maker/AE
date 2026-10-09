const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const config = require('../backend/daily-messages.json');
const source = fs.readFileSync('src/dailyGreeting.ts', 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleCopy = { exports: {} };
new Function('require', 'exports', 'module', compiled)(name => name === './api' ? {} : require(name), moduleCopy.exports, moduleCopy);
const { dailyMessage } = moduleCopy.exports;
const start = Date.parse(`${config.rotationStart}T00:00:00+05:30`);
for (const role of ['customer', 'merchant']) {
  assert.equal(config[role].length, 15);
  const settings = { messages: config[role], rotationStart: config.rotationStart };
  for (let day = 0; day < 15; day++) {
    assert.equal(dailyMessage(settings, start + day * 86400000), settings.messages[day]);
    assert.equal(dailyMessage(settings, start + day * 86400000 + 86399999), settings.messages[day].replace('Good morning', 'Good evening'));
  }
  assert.equal(dailyMessage(settings, start + 15 * 86400000), settings.messages[0]);
  assert.equal(dailyMessage(settings, start - 1), settings.messages[14]);
  for (const [hours, greeting] of [[11.999, 'Good morning'], [12, 'Good afternoon'], [16.999, 'Good afternoon'], [17, 'Good evening'], [23.999, 'Good evening']]) {
    assert.equal(dailyMessage(settings, start + hours * 3600000), settings.messages[0].replace('Good morning', greeting));
  }
  assert.equal(dailyMessage(settings, start + 86400000 + 18 * 3600000), settings.messages[1]);
  const expanded = { ...settings, messages: Array.from({ length: 30 }, (_, i) => `Message ${i + 1}`) };
  assert.equal(dailyMessage(expanded, start + 29 * 86400000), 'Message 30');
  assert.equal(dailyMessage(expanded, start + 30 * 86400000), 'Message 1');
}
// Exercise the actual route callback without starting the server or accessing data.
const server = fs.readFileSync('server.js', 'utf8');
const route = server.match(/app.get\('\/api\/daily-greetings',[\s\S]*?\n\}\);/)[0];
let handler;
new Function('app', 'dailyGreetings', route)({ get: (_path, fn) => { handler = fn; } }, config);
for (const role of ['customer', 'merchant', 'admin', undefined]) {
  let status = 200, body, cache;
  const res = { status: code => { status = code; return res; }, json: value => { body = value; }, set: (_key, value) => { cache = value; } };
  handler({ query: { role } }, res);
  if (role === 'customer' || role === 'merchant') {
    assert.equal(status, 200);
    assert.deepEqual(body.messages, config[role]);
    assert.equal(body.rotationStart, config.rotationStart);
    assert.equal(cache, 'no-store');
  } else assert.equal(status, 400);
}
console.log('Passed: backend endpoint, 15/30-day rotation, IST greeting boundaries and unchanged neutral messages.');
