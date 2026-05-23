import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import {
  discardOnboardingStepChanges,
  hasOnboardingStepDirty,
  saveOnboardingStepChanges,
} from './onboardingStepGuard';

type PendingLeave = {
  href: string;
  resolve: (proceeded: boolean) => void;
};

type OnboardingLeaveStepContextValue = {
  requestLeaveTo: (href: string) => Promise<boolean>;
};

const OnboardingLeaveStepContext = createContext<OnboardingLeaveStepContextValue | null>(null);

export function useOnboardingLeaveStep(): OnboardingLeaveStepContextValue {
  const ctx = useContext(OnboardingLeaveStepContext);
  if (!ctx) {
    throw new Error('useOnboardingLeaveStep must be used within OnboardingLeaveStepProvider');
  }
  return ctx;
}

export function OnboardingLeaveStepProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pendingRef = useRef<PendingLeave | null>(null);

  const finish = useCallback((proceeded: boolean) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    setOpen(false);
    setSaving(false);
    setSaveError(null);
    pending?.resolve(proceeded);
  }, []);

  const requestLeaveTo = useCallback(
    (href: string): Promise<boolean> => {
      if (!hasOnboardingStepDirty()) {
        navigate(href);
        return Promise.resolve(true);
      }

      return new Promise((resolve) => {
        pendingRef.current = { href, resolve };
        setSaveError(null);
        setOpen(true);
      });
    },
    [navigate],
  );

  const handleCancel = useCallback(() => {
    finish(false);
  }, [finish]);

  const handleDiscard = useCallback(() => {
    const pending = pendingRef.current;
    if (!pending) return;
    discardOnboardingStepChanges();
    navigate(pending.href);
    finish(true);
  }, [finish, navigate]);

  const handleSave = useCallback(async () => {
    const pending = pendingRef.current;
    if (!pending || saving) return;

    setSaving(true);
    setSaveError(null);
    const saved = await saveOnboardingStepChanges();
    setSaving(false);

    if (!saved) {
      setSaveError('Could not save your changes. Fix any errors on this step and try again.');
      return;
    }

    navigate(pending.href);
    finish(true);
  }, [finish, navigate, saving]);

  const value = useMemo(() => ({ requestLeaveTo }), [requestLeaveTo]);

  return (
    <OnboardingLeaveStepContext.Provider value={value}>
      {children}
      <Modal
        open={open}
        onClose={handleCancel}
        title="Save changes before leaving?"
        description="You have unsaved changes on this step."
        tone="warning"
        footer={
          <>
            <Button type="button" variant="secondary" size="sm" disabled={saving} onClick={handleCancel}>
              Stay on step
            </Button>
            <Button type="button" variant="danger" size="sm" disabled={saving} onClick={handleDiscard}>
              Discard
            </Button>
            <Button type="button" variant="primary" size="sm" disabled={saving} onClick={() => void handleSave()}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save &amp; continue
            </Button>
          </>
        }
      >
        <p className="m-0 text-sm leading-relaxed text-slate-600">
          Save your work to keep it, discard to revert this step, or stay here to keep editing.
        </p>
        {saveError ? (
          <p className="mb-0 mt-3 text-sm leading-relaxed text-[var(--color-danger-text-emphasis)]" role="alert">
            {saveError}
          </p>
        ) : null}
      </Modal>
    </OnboardingLeaveStepContext.Provider>
  );
}
