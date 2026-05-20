import { ConversationDetailCopyButton } from './ConversationDetailCopyButton';
import { ConversationDetailRow } from './ConversationDetailRow';

type Props = {
  label: string;
  value: string | undefined;
};

export function ConversationDetailTextCopyRow({ label, value }: Props) {
  const v = value?.trim();
  if (!v) return null;
  return (
    <ConversationDetailRow
      label={label}
      value={
        <span className="flex min-w-0 items-start gap-2">
          <span className="min-w-0 flex-1 break-all text-sm text-slate-800" title={v}>
            {v}
          </span>
          <ConversationDetailCopyButton value={v} ariaLabel={`Copy ${label}`} />
        </span>
      }
    />
  );
}
