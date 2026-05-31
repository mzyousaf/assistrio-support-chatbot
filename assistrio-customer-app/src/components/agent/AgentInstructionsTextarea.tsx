import { FieldRow, Textarea } from '@/components/ui';

import { BOT_FIELD_MAX } from '@/lib/botFieldLimits';

import { cn } from '@/lib/utils';

import {

  MIN_AGENT_INSTRUCTIONS_LENGTH,

  minAgentInstructionsError,
  emptyAgentInstructionsError,

} from '@/onboarding/agentInstructions';



type Props = {

  id?: string;

  value: string;

  onChange: (value: string) => void;

  error?: string | null;

  disabled?: boolean;

  rows?: number;

};



function CharCounter({ length, max }: { length: number; max: number }) {

  const underMin = length > 0 && length < MIN_AGENT_INSTRUCTIONS_LENGTH;

  return (

    <span

      className={cn(

        'ml-auto shrink-0 text-xs tabular-nums text-slate-500',

        underMin && 'text-amber-700',

      )}

      aria-live="polite"

    >

      {length.toLocaleString()} / {max.toLocaleString()}

      {length > 0 && length < MIN_AGENT_INSTRUCTIONS_LENGTH

        ? ` (min ${MIN_AGENT_INSTRUCTIONS_LENGTH})`

        : ''}

    </span>

  );

}



export function AgentInstructionsTextarea({

  id = 'agent-instructions',

  value,

  onChange,

  error,

  disabled,

  rows = 8,

}: Props) {

  return (

    <FieldRow

      label="Describe your AI Agent"

      required

      htmlFor={id}

      error={error}

      helperText="Describe what your agent should do, how it should answer, and what kind of support it should provide."

      labelAddon={<CharCounter length={value.length} max={BOT_FIELD_MAX.personalityDescription} />}

    >

      <Textarea

        id={id}

        quiet

        rows={rows}

        className="min-h-[10rem] resize-y"

        value={value}

        invalid={Boolean(error)}

        maxLength={BOT_FIELD_MAX.personalityDescription}

        disabled={disabled}

        onChange={(e) => onChange(e.target.value.slice(0, BOT_FIELD_MAX.personalityDescription))}

        placeholder="Example: Help customers understand our pricing, product features, refund policy, and support process. Be friendly, clear, and avoid making promises we cannot guarantee."

      />

    </FieldRow>

  );

}



export function validateAgentInstructionsText(text: string): string | null {

  const trimmed = text.trim();

  if (!trimmed) return emptyAgentInstructionsError();

  if (trimmed.length < MIN_AGENT_INSTRUCTIONS_LENGTH) return minAgentInstructionsError();

  return null;

}


