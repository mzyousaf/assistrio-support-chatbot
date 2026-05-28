import { useEffect, useId, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Input, Label, Modal } from '@/components/ui';

type Props = {
  open: boolean;
  onClose: () => void;
  workspaceName: string;
  onDelete: () => void | Promise<void>;
};

export function DeleteWorkspaceModal({ open, onClose, workspaceName, onDelete }: Props) {
  const inputId = useId();
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState(false);
  const trimmedName = workspaceName.trim();
  const canDelete = confirmText.trim() === trimmedName && trimmedName.length > 0;

  useEffect(() => {
    if (!open) {
      setConfirmText('');
      setBusy(false);
    }
  }, [open]);

  function handleClose() {
    if (busy) return;
    setConfirmText('');
    onClose();
  }

  async function handleDelete() {
    if (!canDelete || busy) return;
    setBusy(true);
    try {
      await onDelete();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Delete workspace"
      tone="danger"
      footer={
        <>
          <Button type="button" variant="secondary" size="sm" onClick={handleClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            disabled={!canDelete || busy}
            onClick={() => void handleDelete()}
          >
            {busy ? 'Deleting…' : 'Delete workspace'}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-red-100/90 bg-red-50/50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600/90" strokeWidth={2} aria-hidden />
          <div className="min-w-0 space-y-2">
            <p className="m-0 text-sm font-medium leading-relaxed text-slate-900">
              This will permanently delete{' '}
              <span className="font-semibold">{trimmedName || 'this workspace'}</span>.
            </p>
            <p className="m-0 text-sm leading-relaxed text-slate-600">
              All workspace data, agents, knowledge, and settings will be removed. This action cannot be
              undone.
            </p>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor={inputId} className="block text-sm font-medium text-slate-800">
            Type the workspace name to confirm
          </Label>
          <Input
            id={inputId}
            value={confirmText}
            onChange={(event) => setConfirmText(event.target.value)}
            placeholder={trimmedName || 'Workspace name'}
            inputSize="md"
            quiet
            autoComplete="off"
            spellCheck={false}
            disabled={busy}
          />
          <p className="m-0 text-xs leading-relaxed text-slate-500">
            Enter <span className="font-medium text-slate-700">{trimmedName || 'the workspace name'}</span>{' '}
            exactly to enable deletion.
          </p>
        </div>
      </div>
    </Modal>
  );
}
