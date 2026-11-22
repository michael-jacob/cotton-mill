import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // relative asset paths, so the built game works from a sub-path such as GitHub Pages' /cotton-mill/
  base: './',
  plugins: [react()],
  server: { port: 5180 },
});
