import { cn } from '@/lib/utils';
import { botAgentInitials } from '@/pages/usage/usagePageFormat';

type Props = {
  name: string;
  size?: 'sm' | 'md';
  imageUrl?: string | null;
  avatarEmoji?: string | null;
  primaryColor?: string | null;
};

function resolveAccent(primaryColor: string | null | undefined): string {
  const color = String(primaryColor ?? '').trim();
  return color && /^#[0-9a-f]{6}$/i.test(color) ? color : '#0d9488';
}

export function UsageAgentAvatar({
  name,
  size = 'md',
  imageUrl,
  avatarEmoji,
  primaryColor,
}: Props) {
  const sizeClass = size === 'sm' ? 'h-8 w-8 text-[0.6875rem]' : 'h-9 w-9 text-xs';
  const emojiSizeClass = size === 'sm' ? 'text-sm' : 'text-base';
  const accent = resolveAccent(primaryColor);
  const image = String(imageUrl ?? '').trim();
  const emoji = String(avatarEmoji ?? '').trim();

  if (image) {
    return (
      <img
        src={image}
        alt=""
        className={cn('shrink-0 rounded-full object-cover ring-1 ring-slate-200/80', sizeClass)}
      />
    );
  }

  if (emoji) {
    return (
      <span
        className={cn(
          'assistrio-emoji-presentation flex shrink-0 items-center justify-center rounded-full leading-none ring-1 ring-slate-200/80',
          sizeClass,
          emojiSizeClass,
        )}
        style={{ backgroundColor: `${accent}18` }}
        aria-hidden
      >
        {emoji}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full bg-teal-50 font-semibold text-teal-800 ring-1 ring-teal-100',
        sizeClass,
      )}
      aria-hidden
    >
      {botAgentInitials(name)}
    </span>
  );
}
