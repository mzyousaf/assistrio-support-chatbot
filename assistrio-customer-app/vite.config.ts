import path from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const overrideDir = path.resolve(__dirname, 'src/assistrio-chat-override');

/**
 * Only the customer dashboard: swap these two `chat-widget` sources for local copies
 * (idle-session modal + onSend return false) without forking the published package.
 */
function assistrioCustomerChatOverridePlugin() {
  return {
    name: 'assistrio-customer-chat-override',
    enforce: 'pre' as const,
    resolveId(id: string) {
      const n = id.replace(/\\/g, '/');
      if (n.includes('chat-widget/src/components/AdminLiveChatAdapter.tsx')) {
        return path.join(overrideDir, 'AdminLiveChatAdapter.tsx');
      }
      if (n.includes('chat-widget/src/components/chat-ui/Chat.tsx')) {
        return path.join(overrideDir, 'Chat.tsx');
      }
      return null;
    },
  };
}

export default defineConfig({
  plugins: [assistrioCustomerChatOverridePlugin(), tailwindcss(), react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@acw': path.resolve(__dirname, '../chat-widget/src'),
      /** Source entry so dev works without a prior `npm run build` in `chat-widget`. */
      '@assistrio/chat-widget': path.resolve(__dirname, '../chat-widget/src/index.ts'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    port: 3002,
  },
});
