import { defineConfig, mergeConfig } from 'vite';
import baseConfig from './vite.config';

export default defineConfig(async env => {
  const base = typeof baseConfig === 'function' ? await baseConfig(env) : await baseConfig;
  return mergeConfig(base, {
    define: { 'import.meta.env.VITE_API_URL': JSON.stringify('') },
    server: { host: '127.0.0.1', port: 3023, strictPort: true, proxy: { '/api': 'http://127.0.0.1:3030' } },
  });
});
