import { Button, Modal } from '@/components/ui';

const STATUS_ROWS: { status: string; meaning: string }[] = [
  { status: 'Uploading', meaning: 'Your file is still uploading.' },
  { status: 'Uploaded', meaning: 'We have the file; we have not finished pulling the text out yet.' },
  { status: 'Extracting', meaning: 'We are reading the text from the file so the assistant can learn it.' },
  {
    status: 'Training Required',
    meaning: 'The text is ready, but the assistant has not been told to learn it yet. Common when Auto Train is off—you can queue training yourself.',
  },
  {
    status: 'Training Queued',
    meaning: 'Learning this item is on the list. You may see a short countdown until it starts.',
  },
  { status: 'Training', meaning: 'The assistant is actively learning this item right now.' },
  {
    status: 'Trained',
    meaning: 'This item is up to date in the assistant’s memory. If “Use in replies” is on, it can help answer visitors.',
  },
  {
    status: 'Failed',
    meaning: 'Something went wrong. Open the item and tap Retry if you see it, or try again later.',
  },
];

const FLOW_BULLETS: string[] = [
  'For files: upload first, then we pull out the text, then the assistant learns it—either automatically (Auto Train) or when you choose to train.',
  'For Q&A, snippets, datasheets, and suggestions: when you save changes, the assistant will learn them the same way—on your schedule or automatically.',
  '“Use in replies” only turns an item on or off for answers. It does not change how suggestion chips look in the chat widget.',
  'Storage numbers update when your content is saved. The “trained” step updates when the assistant has finished learning the latest version.',
];

export function KnowledgeTrainingStatusesModal(props: { open: boolean; onClose: () => void }) {
  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title="What the status labels mean"
      description="Simple guide to the words you see on knowledge items and in the Your Agent card."
      size="lg"
      closeOnBackdropClick
      footer={
        <Button type="button" variant="primary" className="min-w-[7rem]" onClick={props.onClose}>
          Got it
        </Button>
      }
    >
      <div className="flex flex-col gap-5 text-sm text-slate-700">
        <div className="overflow-x-auto rounded-lg border border-slate-200/90">
          <table className="w-full min-w-[280px] border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/90">
                <th className="px-3 py-2.5 font-semibold text-slate-800">What you see</th>
                <th className="px-3 py-2.5 font-semibold text-slate-800">Plain-English meaning</th>
              </tr>
            </thead>
            <tbody>
              {STATUS_ROWS.map((r) => (
                <tr key={r.status} className="border-b border-slate-100 last:border-b-0">
                  <td className="whitespace-nowrap px-3 py-2 align-top font-medium text-slate-900">{r.status}</td>
                  <td className="px-3 py-2 align-top text-slate-600">{r.meaning}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <p className="m-0 text-xs font-semibold uppercase tracking-wide text-slate-500">The usual order of things</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-slate-600">
            {FLOW_BULLETS.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </Modal>
  );
}
