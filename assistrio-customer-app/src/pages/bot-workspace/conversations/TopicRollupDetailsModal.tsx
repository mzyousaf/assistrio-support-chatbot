import { Tag } from 'lucide-react';
import { Button, Modal } from '@/components/ui';
import { cn } from '@/lib/utils';
import {
  topicPillClass,
  topicSecondaryPillClass,
  topicTaxonomyCustomerLabel,
} from './conversationTopicSentimentDisplay';

export type TopicRollupDetailsModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Taxonomy id for the primary / main topic row. */
  primaryTopicId: string;
  /** Additional taxonomy ids (excluding the primary). */
  subTopicIds: string[];
};

export function TopicRollupDetailsModal({
  open,
  onClose,
  title,
  primaryTopicId,
  subTopicIds,
}: TopicRollupDetailsModalProps) {
  const primaryLabel = topicTaxonomyCustomerLabel(primaryTopicId);
  const hasExtras = subTopicIds.length > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="lg"
      className="max-w-sm"
      closeOnBackdropClick
      bodyClassName="min-h-0 px-4 py-3 sm:px-5 sm:py-4"
      footer={
        <Button type="button" variant="primary" size="sm" onClick={onClose}>
          Got it
        </Button>
      }
    >
      <div className="flex min-w-0 flex-col gap-3.5 text-sm text-slate-800">
        <div>
          <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Primary</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            <span className={cn(topicPillClass, 'max-w-full')}>
              <Tag className="size-3 shrink-0 opacity-90" strokeWidth={2} aria-hidden />
              <span className="min-w-0 truncate">{primaryLabel || primaryTopicId}</span>
            </span>
          </div>
        </div>

        {hasExtras ? (
          <div>
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Also tagged</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {subTopicIds.map((id) => (
                <span key={id} className={cn(topicSecondaryPillClass, 'max-w-full')}>
                  <Tag className="size-3 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
                  <span className="min-w-0 truncate">{topicTaxonomyCustomerLabel(id) || id}</span>
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}
