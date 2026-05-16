import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { QUICK_LINK_ICON_IDS } from '@/lib/quickLinkIconIds';
import { getMenuQuickLinksButtonIcon, getQuickLinkIcon, quickLinkIconHumanLabel } from '@/lib/quickLinkIcons';
import { normalizeQuickLinkIcon } from '@/lib/quickLinkIconNormalize';

export type QuickLinkIconPickerProps = {
  /** Normalized icon id, or `undefined` for default. */
  value: string | undefined;
  onChange: (next: string | undefined) => void;
  /** Accessible name for the icon group. */
  ariaLabel: string;
  /** Optional id (e.g. to pair with FieldRow label). */
  id?: string;
  /** Menu control uses widget default (link-2) when unset; per-link uses ExternalLink when unset. */
  variant: 'menu-button' | 'optional-link';
};

const tileBtn =
  'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md border text-slate-700 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-primary)]';

/**
 * Inline icon grid. Default is the first tile (icon only); no separate "Default" row.
 */
export function QuickLinkIconPicker({ value, onChange, ariaLabel, id, variant }: QuickLinkIconPickerProps) {
  const normalized = normalizeQuickLinkIcon(value);
  const DefaultTileIcon =
    variant === 'menu-button' ? getMenuQuickLinksButtonIcon(undefined) : getQuickLinkIcon(undefined);

  const selectIcon = useCallback(
    (next: string | undefined) => {
      onChange(next);
    },
    [onChange],
  );

  return (
    <div id={id} role="group" aria-label={ariaLabel} className="min-w-0">
      <div
        className="max-h-[min(36vh,12rem)] overflow-y-auto overflow-x-hidden rounded-lg border border-slate-100 bg-slate-50/50 p-1.5"
        role="listbox"
        aria-label={`${ariaLabel} choices`}
      >
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-9 md:grid-cols-10">
          <button
            type="button"
            role="option"
            aria-selected={normalized === undefined}
            aria-label="Default"
            onClick={() => selectIcon(undefined)}
            className={cn(
              tileBtn,
              normalized === undefined
                ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/[0.1] text-[var(--color-teal-800)] ring-2 ring-[var(--color-primary)]/35'
                : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-white',
            )}
          >
            <DefaultTileIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
          </button>
          {QUICK_LINK_ICON_IDS.map((iconId) => {
            const Icon = getQuickLinkIcon(iconId);
            const selected = normalized === iconId;
            return (
              <button
                key={iconId}
                type="button"
                role="option"
                aria-selected={selected}
                aria-label={quickLinkIconHumanLabel(iconId)}
                onClick={() => selectIcon(iconId)}
                className={cn(
                  tileBtn,
                  selected
                    ? 'border-[var(--color-primary)] bg-[var(--color-primary)]/[0.1] text-[var(--color-teal-800)] ring-2 ring-[var(--color-primary)]/35'
                    : 'border-slate-200/90 bg-white hover:border-slate-300 hover:bg-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
