import { createRoot } from 'react-dom/client';
import { App } from './App';
import 'sonner/dist/styles.css';
import './style.css';

const el = document.getElementById('root');
if (!el) {
  throw new Error('Root element #root not found');
}

/**
 * Omit `<StrictMode>`: in development React otherwise mounts passive effects twice in a row,
 * which duplicated identical customer GETs (conversation transcript + detail). Production builds
 * do not double-invoke effects even with StrictMode, but `vite`/dev did — dropping it fixes dev parity.
 */
createRoot(el).render(<App />);
