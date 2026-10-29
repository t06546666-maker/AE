import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import dotenv from 'dotenv';
const { assertStaging } = createRequire(import.meta.url)('./backend/staging-safety.cjs');

export default defineConfig(({ mode, command }) => {
  // Vite normally merges .env into every mode; never allow that in staging.
  const staging = mode === 'staging' || process.env.AE_ENV === 'staging';
  const env = staging
    ? { ...(fs.existsSync('.env.staging') ? dotenv.parse(fs.readFileSync('.env.staging')) : {}), ...process.env }
    : loadEnv(mode, process.cwd(), '');
  if (mode === 'staging' || process.env.AE_ENV === 'staging') {
    assertStaging({ ...env, AE_ENV: 'staging' }, { backend: false });
  }
  const supabaseUrl = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || '').trim();
  const supabaseAnonKey = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || '').trim();

  if (command === 'build') {
    const required = {
      SUPABASE_URL: supabaseUrl,
      SUPABASE_ANON_KEY: supabaseAnonKey,
      VITE_FIREBASE_API_KEY: env.VITE_FIREBASE_API_KEY,
      VITE_FIREBASE_AUTH_DOMAIN: env.VITE_FIREBASE_AUTH_DOMAIN,
      VITE_FIREBASE_PROJECT_ID: env.VITE_FIREBASE_PROJECT_ID,
      VITE_FIREBASE_APP_ID: env.VITE_FIREBASE_APP_ID,
      VITE_FIREBASE_MESSAGING_SENDER_ID: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    };
    const missing = Object.entries(required).filter(([, value]) => !value?.trim()).map(([name]) => name);
    if (missing.length) {
      throw new Error(`Build stopped: missing client configuration: ${missing.join(', ')}. Load the deployment environment before building the app.`);
    }
    if (!/^https?:\/\//.test(supabaseUrl)) {
      throw new Error('Build stopped: SUPABASE_URL must be an HTTP(S) URL.');
    }
    let keyProject: string | undefined;
    try { keyProject = JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1], 'base64url').toString()).ref; }
    catch { /* New publishable keys are opaque rather than JWTs. */ }
    if (keyProject && new URL(supabaseUrl).hostname.endsWith('.supabase.co') && new URL(supabaseUrl).hostname !== `${keyProject}.supabase.co`) {
      throw new Error('Build stopped: the Supabase URL does not match the project in the public anon key.');
    }
    if (supabaseAnonKey.startsWith('sb_secret_') || (() => {
      try { return JSON.parse(Buffer.from(supabaseAnonKey.split('.')[1], 'base64url').toString()).role === 'service_role'; }
      catch { return false; }
    })()) {
      throw new Error('Build stopped: use a Supabase public anon/publishable key, never a service-role key, in the client.');
    }
  }
  
  return {
    envDir: staging ? false : undefined,
    plugins: [react()],
    define: {
      ...(staging ? Object.fromEntries(Object.entries(env).filter(([key]) => key.startsWith('VITE_')).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)])) : {}),
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(supabaseUrl),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(supabaseAnonKey),
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://localhost:3000',
      },
    },
    build: {
      outDir: mode === 'staging' ? 'dist-staging' : 'dist',
      sourcemap: false,
    },
  };
});
