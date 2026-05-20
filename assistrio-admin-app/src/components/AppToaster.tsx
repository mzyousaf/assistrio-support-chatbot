import { Toaster } from 'sonner';
import '../styles/app-toaster.css';

/** Sonner `classNames` keys — keep in sync with `app-toaster.css`. */
const TOAST_CLASS_NAMES = {
  toast: 'app-toast',
  title: 'app-toast__title',
  description: 'app-toast__description',
  content: 'app-toast__content',
  icon: 'app-toast__icon',
  closeButton: 'app-toast__close',
  actionButton: 'app-toast__btn app-toast__btn--primary',
  cancelButton: 'app-toast__btn app-toast__btn--secondary',
} as const;

/**
 * Global Sonner host: top-right stack, spacing, and shared toast chrome.
 * Visual design lives in `app-toaster.css` (tokens from `style.css` / `:root`).
 */
export function AppToaster() {
  return (
    <Toaster
      className="app-toaster"
      position="top-right"
      theme="light"
      closeButton
      expand={false}
      richColors={false}
      gap={10}
      visibleToasts={4}
      offset={{ top: 'max(1rem, env(safe-area-inset-top))', right: 'max(1rem, env(safe-area-inset-right))' }}
      duration={3000}
      toastOptions={{
        classNames: TOAST_CLASS_NAMES,
      }}
    />
  );
}
