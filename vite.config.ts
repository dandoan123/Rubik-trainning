import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Relative asset URLs, so the same build works at a domain root (Render) and under a
  // sub-path (GitHub Pages serves this repo at /<repo-name>/).
  base: './',
  plugins: [react()],
});
