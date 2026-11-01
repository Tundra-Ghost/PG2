import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './', // Relative, so the build works at any address (pigeonchess.app/play, github.io)
});
