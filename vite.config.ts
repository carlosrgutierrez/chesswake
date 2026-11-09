import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'chesswake-production-csp',
      apply: 'build',
      transformIndexHtml(html) {
        const policy = "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'";
        return html.replace('<head>', `<head><meta http-equiv="Content-Security-Policy" content="${policy}"/>`);
      }
    }
  ],
  base: './',
  server: { port: 5173, strictPort: true }
});
