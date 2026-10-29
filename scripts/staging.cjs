const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const dotenv = require('dotenv');
const { assertStaging } = require('../backend/staging-safety.cjs');
const root = path.resolve(__dirname, '..');
const file = path.join(root, '.env.staging');
if (!fs.existsSync(file)) { console.error('Create .env.staging from staging.env.example with separate staging credentials. Production .env will NOT be loaded.'); process.exit(1); }
const config = dotenv.parse(fs.readFileSync(file));
const inherited = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|COMSPEC|PATHEXT)$/i.test(key)));
const env = { ...inherited, ...config, AE_ENV: 'staging', VITE_AE_ENV: 'staging', DOTENV_CONFIG_PATH: file };
try { assertStaging(env); } catch (error) { console.error(error.message); process.exit(1); }
const action = process.argv[2] || 'check';
if (action === 'check') { console.log('PASS: staging isolation configuration. No network requests made.'); process.exit(0); }
const commands = { start: ['server.js'], build: ['node_modules/vite/bin/vite.js', 'build', '--mode', 'staging', '--configLoader', 'runner'] };
if (!commands[action]) { console.error('Use check, build or start'); process.exit(1); }
const result = spawnSync(process.execPath, commands[action], { cwd: root, env, stdio: 'inherit', windowsHide: true });
process.exit(result.status ?? 1);
