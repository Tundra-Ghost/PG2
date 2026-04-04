import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/PG2/game/dist/', // GitHub Pages: tundra-ghost.github.io/PG2/game/dist/
});
