import { AppWindow } from 'lucide-react';

export type ProfilePreviewProps = {
  mountId?: string;
};

/** Profile playground: framed mount stage (placeholder until live widget is connected). */
export function ProfilePreview({ mountId }: ProfilePreviewProps) {
  return (
    <div className="flex w-full min-w-0 flex-col" data-widget-preview-workspace>
      <div
        className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[0_12px_40px_-16px_rgba(15,23,42,0.12),0_4px_14px_-4px_rgba(15,23,42,0.06)]"
        data-widget-preview-frame
      >
        <div
          className="flex h-8 shrink-0 items-center gap-2 border-b border-slate-100 bg-slate-50/90 px-3"
          data-widget-preview-chrome
        >
          <div className="flex gap-1" aria-hidden>
            <span className="h-2 w-2 rounded-full bg-slate-300/85" />
            <span className="h-2 w-2 rounded-full bg-slate-300/85" />
            <span className="h-2 w-2 rounded-full bg-slate-300/85" />
          </div>
          <div className="flex min-w-0 flex-1 justify-center">
            <span className="max-w-full truncate rounded-md bg-white px-2.5 py-0.5 text-[0.625rem] font-medium leading-tight text-slate-500 ring-1 ring-slate-200/80">
              yoursite.com
            </span>
          </div>
        </div>

        <div
          id={mountId}
          data-widget-preview-stage
          className="flex min-h-[11rem] flex-col items-stretch bg-slate-50/70"
        >
          <div className="p-3 sm:p-4">
            <div data-widget-preview-placeholder className="flex items-start gap-3 text-left">
              <div
                className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white text-slate-400 shadow-sm"
                aria-hidden
              >
                <AppWindow size={18} strokeWidth={1.75} />
              </div>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="m-0 text-[0.8125rem] font-semibold text-slate-800">Widget preview</p>
                <p className="mt-1 mb-0 max-w-[18rem] text-[0.75rem] leading-snug text-slate-500">
                  Your live widget will appear here once connected.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
