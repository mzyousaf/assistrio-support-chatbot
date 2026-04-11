/** Trial setup form controls — calm borders, regular-weight text, soft focus */

const radius = "rounded-sm";

/** Label text only (no margin) — compose with spacing in shell */
export const trialFieldLabelTextClass = "block text-[13px] font-medium tracking-tight text-slate-600";

export const trialFieldLabelClass = `mb-1.5 ${trialFieldLabelTextClass}`;

export const trialFieldInputClass =
  `h-10 w-full ${radius} border border-slate-300/90 bg-white px-3 py-2 text-[0.8125rem] font-normal leading-normal text-slate-800 shadow-none outline-none transition duration-150 placeholder:font-normal placeholder:text-slate-400 ` +
  "hover:border-slate-400/90 hover:bg-slate-50/40 " +
  "focus:border-[var(--brand-teal)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(13,148,136,0.12)] focus:ring-0";

export const trialFieldTextareaClass =
  `min-h-[5.25rem] w-full resize-y ${radius} border border-slate-300/90 bg-white px-3 py-2.5 text-[0.8125rem] font-normal leading-relaxed text-slate-800 shadow-none outline-none transition duration-150 placeholder:font-normal placeholder:text-slate-400 ` +
  "hover:border-slate-400/90 hover:bg-slate-50/40 " +
  "focus:border-[var(--brand-teal)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(13,148,136,0.12)] focus:ring-0";

export const trialFieldHintClass = "mt-1.5 text-[12px] leading-relaxed text-slate-500/80";

/** Select — matches input */
export const trialFieldSelectClass =
  `h-10 w-full cursor-pointer appearance-none ${radius} border border-slate-300/90 bg-white pl-3 pr-10 text-[0.8125rem] font-normal text-slate-800 shadow-none outline-none transition duration-150 ` +
  "hover:border-slate-400/90 hover:bg-slate-50/40 " +
  "focus:border-[var(--brand-teal)] focus:bg-white focus:shadow-[0_0_0_3px_rgba(13,148,136,0.12)] focus:ring-0";
