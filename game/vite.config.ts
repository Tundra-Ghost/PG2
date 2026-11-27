import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { buildInfo } from '../scripts/build-info.mjs';

export default defineConfig({
  plugins: [react()],
  base: './', // Relative, so the build works at any address (pigeonchess.app/play, github.io)
  define: { __BUILD_INFO__: JSON.stringify(buildInfo()) },
});
