import type { CustomerLeadFieldDefinition } from '@/api/types';
import { cn } from '@/lib/utils';
import {
  displayLeadFieldValue,
  formatLeadCellValue,
  formatLeadUrlInboxDisplay,
  isSafeHttpOrHttpsUrl,
  isSafeMailtoLocalPart,
  sanitizeTelHref,
} from './leadsUiHelpers';

type Props = {
  field: CustomerLeadFieldDefinition;
  data: Record<string, string> | undefined;
  /**
   * When true, phone/email/URL render as plain text so a parent row `<tr>` can open the drawer
   * without interactive `<a>` elements blocking the click.
   */
  suppressInteractiveLinks?: boolean;
};

function typeTone(t: string | undefined): 'email' | 'phone' | 'url' | 'text' {
  const ls = (t ?? '').toLowerCase();
  if (ls === 'email') return 'email';
  if (ls === 'tel' || ls === 'phone') return 'phone';
  if (ls === 'url' || ls === 'website') return 'url';
  return 'text';
}

export function LeadValueCell({ field, data, suppressInteractiveLinks }: Props) {
  const key = field.key.trim();
  const raw = formatLeadCellValue(data, key);
  const display = displayLeadFieldValue(data, key);
  const muted = display === '—';
  const inferred =
    typeTone(field.type) === 'text'
      ? key.toLowerCase() === 'email'
        ? 'email'
        : key.toLowerCase() === 'phone' || key.toLowerCase() === 'mobile'
          ? 'phone'
          : isSafeHttpOrHttpsUrl(raw)
            ? 'url'
            : 'text'
      : typeTone(field.type);

  if (muted) {
    return <span className="text-sm text-slate-400">—</span>;
  }

  if (inferred === 'email' && isSafeMailtoLocalPart(raw)) {
    if (suppressInteractiveLinks) {
      return (
        <span className="line-clamp-2 break-all text-sm font-medium text-teal-700" title={raw}>
          {raw}
        </span>
      );
    }
    return (
      <a
        href={`mailto:${raw.trim()}`}
        className="line-clamp-2 break-all text-sm font-medium text-teal-700 underline-offset-2 hover:text-teal-900 hover:underline"
        title={raw}
      >
        {raw}
      </a>
    );
  }

  if (inferred === 'phone') {
    const tel = sanitizeTelHref(raw);
    if (tel.length >= 6) {
      if (suppressInteractiveLinks) {
        return (
          <span className="line-clamp-2 break-all text-sm font-medium text-teal-700" title={raw}>
            {raw}
          </span>
        );
      }
      return (
        <a
          href={`tel:${tel}`}
          className="line-clamp-2 break-all text-sm font-medium text-teal-700 underline-offset-2 hover:text-teal-900 hover:underline"
          title={raw}
        >
          {raw}
        </a>
      );
    }
  }

  if (inferred === 'url' && isSafeHttpOrHttpsUrl(raw)) {
    const shown = formatLeadUrlInboxDisplay(raw) || raw.trim();
    if (suppressInteractiveLinks) {
      return (
        <span className="line-clamp-2 max-w-full text-sm font-medium text-teal-700" title={raw}>
          {shown}
        </span>
      );
    }
    return (
      <a
        href={raw.trim()}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'line-clamp-2 max-w-full text-sm font-medium text-teal-700 underline-offset-2 hover:text-teal-900 hover:underline',
        )}
        title={raw}
      >
        {shown}
      </a>
    );
  }

  return (
    <span className="line-clamp-2 break-words text-sm text-slate-800" title={raw}>
      {display}
    </span>
  );
}
