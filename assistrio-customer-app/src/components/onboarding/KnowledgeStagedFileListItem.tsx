import { Trash2 } from 'lucide-react';
import type { WorkspaceOnboardingStagedKnowledgeItem } from '@/api/types';
import { Checkbox } from '@/components/ui';
import { formatFileSize } from '@/lib/formatFileSize';
import { isLikelyNetworkFailureMessage } from '@/lib/workspaceLoadFailurePresentation';
import { ConversationAttachmentFileIcon } from '@/pages/bot-workspace/conversations/messageAttachmentFileIcon';

function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return null;
  }
}

type Props = {
  item: WorkspaceOnboardingStagedKnowledgeItem;
  variant: 'document' | 'datasheet';
  disabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: () => void;
  onDelete: () => void;
};

export function KnowledgeStagedFileListItem({
  item,
  variant,
  disabled,
  selectable,
  selected = false,
  onSelectChange,
  onDelete,
}: Props) {
  const uploaded = formatDate(item.createdAt);

  const metaParts = [formatFileSize(item.sizeBytes)];
  if (uploaded) metaParts.push(uploaded);

  const itemError =
    item.errorMessage && !isLikelyNetworkFailureMessage(item.errorMessage) ? item.errorMessage : null;

  return (
    <li className="knowledge-list-card knowledge-file-list-item">
      {selectable ? (
        <div className="shrink-0" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            disabled={disabled}
            onChange={onSelectChange}
            aria-label={`Select ${item.originalName}`}
          />
        </div>
      ) : null}
      <ConversationAttachmentFileIcon
        fileName={item.originalName}
        mimeType={item.mimeType ?? ''}
        className="h-8 max-h-8"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-[0.8125rem] font-semibold text-slate-900">{item.originalName}</span>
        </div>
        <p className="m-0 mt-1 text-[0.6875rem] text-slate-500">{metaParts.join(' | ')}</p>
        {itemError ? (
          <p className="m-0 mt-1 text-[0.6875rem] text-[var(--color-danger-text-emphasis)]">{itemError}</p>
        ) : null}
      </div>
      <button
        type="button"
        disabled={disabled}
        aria-label={variant === 'datasheet' ? 'Delete datasheet' : 'Delete file'}
        className="shrink-0 cursor-pointer rounded-md border-none bg-transparent p-2 text-slate-400 hover:bg-red-50 hover:text-[var(--color-danger-text-emphasis)] disabled:opacity-50"
        onClick={onDelete}
      >
        <Trash2 className="size-4" aria-hidden />
      </button>
    </li>
  );
}
