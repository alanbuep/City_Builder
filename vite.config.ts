import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  server: {
    // Puerto propio y fijo para no chocar con otras apps (p. ej. la plataforma
    // IoT que también usa Vite en el 5173). strictPort: si está ocupado, falla
    // en vez de saltar a otro puerto en silencio.
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    open: true,
  },
});
