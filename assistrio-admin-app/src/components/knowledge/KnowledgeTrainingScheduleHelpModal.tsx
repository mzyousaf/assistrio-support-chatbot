import { Button, Modal } from '@/components/ui';
import { KNOWLEDGE_SMART_DELAY_ROWS } from '@/lib/knowledgeTrainingScheduleHelpCopy';

export type KnowledgeTrainingScheduleHelpModalProps = {
  open: boolean;
  onClose: () => void;
};

export function KnowledgeTrainingScheduleHelpModal({ open, onClose }: KnowledgeTrainingScheduleHelpModalProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Training countdown"
      titleClassName="text-sm"
      size="md"
      closeOnBackdropClick
      footerClassName="[&_button]:!text-sm"
      description={
        <p className="m-0 max-w-prose text-xs leading-snug font-normal text-slate-600 [&_strong]:font-semibold [&_strong]:text-slate-800">
          The countdown shows <strong>when</strong> training is set to begin—not how long the training step takes. After a
          save, we pause briefly so a few quick edits can roll into one update; if you see <strong>Training soon</strong>,
          hover the underlined time for the exact start. In your bot’s settings you can choose one wait time for all
          knowledge—we’ll use that when it’s set.
        </p>
      }
      footer={
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          Got it!
        </Button>
      }
    >
      <div className="min-w-0 text-xs leading-snug text-slate-700">
        <div className="overflow-x-auto rounded-md border border-slate-200/90 bg-white">
          <table className="m-0 w-full border-collapse text-left text-xs leading-snug">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80">
                <th className="px-2.5 py-2 font-semibold text-slate-800 sm:px-3">Knowledge</th>
                <th className="px-2.5 py-2 font-semibold text-slate-800 sm:px-3">Typical wait</th>
              </tr>
            </thead>
            <tbody>
              {KNOWLEDGE_SMART_DELAY_ROWS.map((row) => (
                <tr key={row.source} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-2.5 py-2 align-middle font-normal text-slate-700 sm:px-3">{row.source}</td>
                  <td className="px-2.5 py-2 align-middle sm:px-3">
                    <span className="font-mono text-xs font-medium tabular-nums text-slate-900">
                      {row.waitLabel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
