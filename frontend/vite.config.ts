import path from 'path';
import fs from 'fs';
import { defineConfig, loadEnv, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

const cjsGuardPlugin = (): Plugin => ({
  name: 'prime-cjs-guard',
  enforce: 'pre',
  transform(code, id) {
    if (!id.includes('node_modules/react') && !id.includes('node_modules/react-dom') && !id.includes('node_modules/scheduler')) return;
    if (id.endsWith('.mjs') || id.endsWith('.esm.js')) return;
    if (code.includes('exports.') && !code.startsWith('var exports') && !code.startsWith('var module')) {
      return {
        code: `var exports = {};\nvar module = { exports: exports };\n${code}`,
        map: null,
      };
    }
  },
});

const inlineFontsPlugin = (): Plugin => ({
  name: 'prime-inline-fonts',
  enforce: 'pre',
  load(id: string) {
    if (!/\.(ttf|woff|woff2)$/.test(id)) return;
    const mimeMap: Record<string, string> = { ttf: 'font/truetype', woff: 'font/woff', woff2: 'font/woff2' };
    const ext = id.split('.').pop()!;
    const mime = mimeMap[ext] ?? 'font/truetype';
    try { const b64 = fs.readFileSync(id).toString('base64'); return `export default 'data:${mime};base64,${b64}'`; }
    catch { return null; }
  },
});

const CSP = "default-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:* https://127.0.0.1:* https://localhost:* ws://127.0.0.1:* ws://localhost:* wss://127.0.0.1:* wss://localhost:* data: blob: prime-pdf: https://*.supabase.co wss://*.supabase.co; script-src 'self' 'unsafe-inline' 'unsafe-eval' http://127.0.0.1:* http://localhost:* https://127.0.0.1:* https://localhost:*; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob:; connect-src 'self' http://127.0.0.1:* http://localhost:* https://127.0.0.1:* https://localhost:* ws://127.0.0.1:* ws://localhost:* wss://127.0.0.1:* wss://localhost:* data: blob: https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://openrouter.ai https://open.bigmodel.cn https://api.openai.com https://api.opencode.ai; frame-src 'self' blob: data: prime-pdf: http://127.0.0.1:* http://localhost:* https://127.0.0.1:* https://localhost:*; object-src 'self' blob: data: prime-pdf:; worker-src 'self' blob:; child-src 'self' blob:; font-src 'self' data: blob: https://fonts.gstatic.com";

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: { port: 5173, host: '127.0.0.1', https: true, allowedHosts: ['127.0.0.1', 'localhost'], headers: { 'Content-Security-Policy': CSP } },
      plugins: [basicSsl(), react(), inlineFontsPlugin(), cjsGuardPlugin()],
      optimizeDeps: { include: ['react','react-dom','recharts','lucide-react','react-router-dom','idb','date-fns','@react-pdf/renderer','zustand','dexie'], exclude: ['@supabase/supabase-js','yoga-layout'] },
      define: { 'process.env.API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY), 'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_GEMINI_API_KEY), 'process.env.VITE_AI_PROVIDER': JSON.stringify(env.VITE_AI_PROVIDER), 'process.env.VITE_OPENROUTER_API_KEY': JSON.stringify(env.VITE_OPENROUTER_API_KEY), 'process.env.VITE_OPENROUTER_MODEL': JSON.stringify(env.VITE_OPENROUTER_MODEL) },
      esbuild: { drop: mode === 'production' ? ['console'] : [] },
      resolve: { dedupe: ['react', 'react-dom', 'dexie'], alias: [{ find: '@', replacement: path.resolve(__dirname, '.') }] },
      base: env.VITE_BASE_URL || './',
      build: { outDir: 'dist', emptyOutDir: true, manifest: 'asset-manifest.json', sourcemap: false, commonjsOptions: { transformMixedEsModules: true, requireReturnsDefault: 'auto' }, rollupOptions: { output: { manualChunks(id) { if (id.includes('node_modules')) { if (id.includes('node_modules/lucide-react')) return 'icons'; if (id.includes('node_modules/recharts')) return 'charts'; if (id.includes('node_modules/@supabase')) return 'supabase'; if (id.includes('node_modules/react-pdf') || id.includes('node_modules/@react-pdf')) return 'pdf'; if (id.includes('node_modules/dexie')) return 'dexie'; if (id.includes('node_modules/zustand')) return 'zustand'; if (id.includes('node_modules/idb')) return 'idb'; if (id.includes('node_modules/date-fns')) return 'date-fns'; } return 'vendor'; } } } }
    };
});
