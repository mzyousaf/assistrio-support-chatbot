import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui';
import { appToast } from '@/lib/app-toast';
import { copyTextToClipboard } from '@/lib/copyToClipboard';

type Props = {
  value: string;
  label?: string;
};

export function SettingsCopyButton({ value, label = 'Copy' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const ok = await copyTextToClipboard(value);
    if (!ok) return;
    appToast.success('Copied');
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      className="shrink-0 gap-1.5"
      onClick={() => void handleCopy()}
      aria-label={copied ? 'Copied' : `Copy ${label}`}
    >
      {copied ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
      {copied ? 'Copied' : label}
    </Button>
  );
}
