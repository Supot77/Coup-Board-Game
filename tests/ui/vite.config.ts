import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

// Isolated UI harness. All Firestore access is replaced, never live data.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: {
    'firebase/firestore': fileURLToPath(new URL('./firestore.ts', import.meta.url)),
    'firebase/auth': fileURLToPath(new URL('./firebase-auth.ts', import.meta.url)),
    '/src/core/roomCommands.ts': fileURLToPath(new URL('./roomCommands.ts', import.meta.url)),
    '/src/core/gameCommands.ts': fileURLToPath(new URL('./gameCommands.ts', import.meta.url)),
    '/src/core/hostCommandProcessor.ts': fileURLToPath(new URL('./hostCommandProcessor.ts', import.meta.url)),
    '/src/core/roomMaintenance.ts': fileURLToPath(new URL('./roomMaintenance.ts', import.meta.url)),
    './components/SessionProvider': fileURLToPath(new URL('./session.tsx', import.meta.url)),
    './SessionProvider': fileURLToPath(new URL('./session.tsx', import.meta.url)),
    [fileURLToPath(new URL('../../src/components/SessionProvider.tsx', import.meta.url))]: fileURLToPath(new URL('./session.tsx', import.meta.url)),
  } },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
});
