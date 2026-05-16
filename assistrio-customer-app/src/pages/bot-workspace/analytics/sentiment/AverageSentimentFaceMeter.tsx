import { Angry, Frown, Meh, Smile, SmilePlus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type AverageSentimentFaceId =
  | 'superHappy'
  | 'happy'
  | 'neutral'
  | 'unhappy'
  | 'superAngry';

/** Map model score in roughly −1…1 to the displayed average-sentiment face. */
export function scoreToAverageSentimentFace(score: number): AverageSentimentFaceId {
  const s = Math.max(-1, Math.min(1, score));
  if (s >= 0.5) return 'superHappy';
  if (s >= 0.1) return 'happy';
  if (s >= -0.09) return 'neutral';
  if (s >= -0.49) return 'unhappy';
  return 'superAngry';
}

export const AVERAGE_SENTIMENT_FACE_BANDS: ReadonlyArray<{
  id: AverageSentimentFaceId;
  Icon: LucideIcon;
  label: string;
  /** Human-readable score band on roughly −1…1. */
  range: string;
  iconClass: string;
}> = [
  {
    id: 'superHappy',
    Icon: SmilePlus,
    label: 'Super happy',
    range: '0.5–1',
    iconClass: 'text-emerald-600',
  },
  {
    id: 'happy',
    Icon: Smile,
    label: 'Happy',
    range: '0.1–0.49',
    iconClass: 'text-teal-600',
  },
  {
    id: 'neutral',
    Icon: Meh,
    label: 'Neutral',
    range: '−0.09–0.09',
    iconClass: 'text-slate-500',
  },
  {
    id: 'unhappy',
    Icon: Frown,
    label: 'Unhappy',
    range: '−0.49–−0.1',
    iconClass: 'text-amber-600',
  },
  {
    id: 'superAngry',
    Icon: Angry,
    label: 'Super angry',
    range: '−1–−0.5',
    iconClass: 'text-red-600',
  },
];

const FACES = AVERAGE_SENTIMENT_FACE_BANDS;

type Props = {
  /** Null when there is not enough score data to show a face. */
  score: number | null;
  className?: string;
  compact?: boolean;
  /** Icon only — stroke color follows score band. */
  iconOnly?: boolean;
};

export function resolveAverageSentimentFace(score: number | null) {
  const faceId =
    score != null && Number.isFinite(score) ? scoreToAverageSentimentFace(score) : null;
  return faceId != null ? (FACES.find((f) => f.id === faceId) ?? null) : null;
}

export function AverageSentimentFaceMeter({ score, className, compact, iconOnly }: Props) {
  const face = resolveAverageSentimentFace(score);

  if (iconOnly) {
    if (!face) {
      return (
        <span
          className={cn('shrink-0 text-base font-semibold leading-none text-slate-300', className)}
          aria-hidden
        >
          —
        </span>
      );
    }
    const Icon = face.Icon;
    return (
      <Icon
        className={cn('size-7 shrink-0 sm:size-8', face.iconClass, className)}
        strokeWidth={2.25}
        aria-hidden
      />
    );
  }

  if (!face) {
    return (
      <div
        className={cn('flex items-center gap-3', className)}
        data-testid="average-sentiment-face-meter"
        data-face-id="none"
        aria-label="No average score"
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center text-xl font-semibold text-slate-300 sm:size-11"
          aria-hidden
        >
          —
        </span>
        <p className="m-0 text-sm font-medium text-slate-400 sm:text-base">No score data</p>
      </div>
    );
  }

  const Icon = face.Icon;
  const iconSize = compact ? 'size-10 sm:size-11' : 'size-11 sm:size-12';

  return (
    <div
      role="img"
      aria-label={`Average sentiment: ${face.label}`}
      data-testid="average-sentiment-face-meter"
      data-face-id={face.id}
      className={cn('flex items-center gap-3 sm:gap-3.5', className)}
    >
      <Icon className={cn('shrink-0', iconSize, face.iconClass)} strokeWidth={2.25} aria-hidden />
      <p className="m-0 text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl">
        {face.label}
      </p>
    </div>
  );
}
