import path from 'path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      /** Source entry so dev works without a prior `npm run build` in `chat-widget`. */
      '@assistrio/chat-widget': path.resolve(__dirname, '../chat-widget/src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3002,
  },
});
