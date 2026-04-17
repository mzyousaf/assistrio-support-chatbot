/** Shared Tailwind class strings that replace the old pageLayout.module.css */

export const pageLayout = {
  narrow: 'w-full max-w-[40rem] mx-auto',
  standard: 'w-full max-w-[56rem] mx-auto',
  wide: 'w-full',

  pageHeader:
    'flex flex-wrap items-end justify-between gap-x-[1.75rem] gap-y-4 mb-8',
  pageHeaderMain: 'flex-[1_1_14rem] min-w-0',
  pageTitle:
    'mt-0 mb-1.5 text-[1.375rem] font-semibold tracking-tight text-slate-900 leading-tight',
  pageLead:
    'm-0 text-[0.9375rem] leading-[1.55] text-slate-400 max-w-[38rem]',
  pageActions:
    'shrink-0 flex flex-col items-end gap-1.5',

  sectionOverline:
    'mt-9 mb-2.5 first:mt-0 text-[0.6875rem] font-semibold tracking-[0.055em] uppercase text-slate-300',
  stack: 'flex flex-col gap-5',
} as const;
