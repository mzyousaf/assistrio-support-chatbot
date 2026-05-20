import type { AdminConversationMessageFeedback } from '@/api/types';
import { cn } from '@/lib/utils';
import { ThumbsDown, ThumbsUp } from 'lucide-react';

type Props = {
  feedback?: AdminConversationMessageFeedback | null;
  className?: string;
};

/** Read-only visitor thumbs for assistant messages only (Insights transcript). */
export function MessageFeedbackStatus({ feedback, className }: Props) {
  const rating = feedback?.rating;
  if (rating !== 'up' && rating !== 'down') return null;

  if (rating === 'up') {
    return (
      <span
        className={cn(
          'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm',
          className,
        )}
        role="status"
        title="Liked"
        aria-label="Liked"
      >
        <ThumbsUp size={12} className="shrink-0 text-white" strokeWidth={2} aria-hidden />
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm',
        className,
      )}
      role="status"
      title="Disliked"
      aria-label="Disliked"
    >
      <ThumbsDown size={12} className="shrink-0 text-white" strokeWidth={2} aria-hidden />
    </span>
  );
}
