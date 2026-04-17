import {
  forwardRef,
  useCallback,
  useRef,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
  type Ref,
} from 'react';
import { Eye, EyeOff, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/* -------------------------------------------------------------------------- */
/*  Types                                                                      */
/* -------------------------------------------------------------------------- */

type Size = 'sm' | 'md' | 'lg';

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  /** Error appearance: red border + red focus ring + aria-invalid. */
  invalid?: boolean;
  /** Compact (32px), default (36px), or comfortable (44px). */
  inputSize?: Size;
  /** Icon rendered flush inside the left edge of the control. */
  leadingIcon?: ReactNode;
  /** Icon or control rendered flush inside the right edge of the control. */
  trailingIcon?: ReactNode;
  /** Slate-chip prefix rendered outside the text area (e.g. "https://"). */
  leadingAddon?: ReactNode;
  /** Slate-chip suffix (e.g. ".com", "USD"). */
  trailingAddon?: ReactNode;
  /** Shows an X button that clears the value and fires a native input event. */
  clearable?: boolean;
  onClear?: () => void;
  /** Shows a trailing spinner and sets aria-busy. */
  loading?: boolean;
  /**
   * For `type="password"`, renders an eye toggle. Defaults to `true`.
   * Ignored for non-password inputs.
   */
  revealable?: boolean;
  /** Apply classes to the outer wrapper (e.g. `max-w-[16rem]`). */
  wrapperClassName?: string;
  /** Subdued borders and slate focus ring (settings-style forms). */
  quiet?: boolean;
};

/* -------------------------------------------------------------------------- */
/*  Size tables                                                                */
/* -------------------------------------------------------------------------- */

const sizeHeight: Record<Size, string> = {
  sm: 'h-7',
  md: 'h-8',
  lg: 'h-9',
};

const sizeText: Record<Size, string> = {
  sm: 'text-xs',
  md: 'text-[0.8125rem]',
  lg: 'text-sm',
};

const sizePadX: Record<Size, string> = {
  sm: 'px-2.5',
  md: 'px-3',
  lg: 'px-3.5',
};

const sizeIconPx: Record<Size, number> = {
  sm: 14,
  md: 15,
  lg: 17,
};

const leftSlotPad: Record<Size, string> = {
  sm: 'pl-2.5 pr-1.5',
  md: 'pl-3 pr-2',
  lg: 'pl-3.5 pr-2',
};

const rightSlotPad: Record<Size, string> = {
  sm: 'pr-1.5 pl-1',
  md: 'pr-2 pl-1',
  lg: 'pr-2.5 pl-1.5',
};

/* -------------------------------------------------------------------------- */
/*  Utils                                                                      */
/* -------------------------------------------------------------------------- */

function mergeRefs<T>(...refs: (Ref<T> | undefined)[]) {
  return (node: T) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as { current: T | null }).current = node;
    }
  };
}

/** Programmatically set an input value and fire a native `input` event so React state updates. */
function writeInputValue(el: HTMLInputElement, next: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(el, next);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                             */
/* -------------------------------------------------------------------------- */

function TrailingSlotButton({
  size,
  ariaLabel,
  onClick,
  children,
  tabIndex = -1,
}: {
  size: Size;
  ariaLabel: string;
  onClick: () => void;
  children: ReactNode;
  tabIndex?: number;
}) {
  const btnSize = size === 'lg' ? 'h-6 w-6' : 'h-5 w-5';
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      tabIndex={tabIndex}
      onClick={onClick}
      onMouseDown={(e) => e.preventDefault()}
      className={cn(
        'inline-flex items-center justify-center rounded-[var(--ui-radius)] text-slate-400',
        'transition-colors duration-150',
        'hover:bg-slate-100/80 hover:text-slate-700',
        'focus-visible:bg-slate-100/80 focus-visible:text-slate-800 focus-visible:outline-none',
        btnSize,
      )}
    >
      {children}
    </button>
  );
}

function Addon({ size, side, children }: { size: Size; side: 'left' | 'right'; children: ReactNode }) {
  return (
    <span
      className={cn(
        'inline-flex select-none items-center whitespace-nowrap bg-[var(--ui-surface-muted)] font-medium text-slate-500',
        side === 'left' ? 'border-r border-[var(--ui-border)]' : 'border-l border-[var(--ui-border)]',
        sizePadX[size],
        sizeText[size],
      )}
    >
      {children}
    </span>
  );
}


/* -------------------------------------------------------------------------- */
/*  Wrapper styling (shared by all variants)                                  */
/* -------------------------------------------------------------------------- */

const inputWrapperSurface = cn(
  'group inline-flex w-full items-stretch overflow-hidden rounded-[var(--ui-radius)] border border-solid bg-[var(--ui-surface)]',
  'shadow-none transition-[border-color,box-shadow,background-color] duration-150 ease-out',
);

/** Border / hover / focus colors: `style.css` `[data-ui-input-wrapper]` (hover cannot override focus). */
const wrapperStateful = (disabled: boolean | undefined) =>
  cn(disabled && 'cursor-not-allowed bg-[var(--ui-surface-muted)] opacity-80');

/* -------------------------------------------------------------------------- */
/*  Component                                                                  */
/* -------------------------------------------------------------------------- */

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    className,
    wrapperClassName,
    invalid,
    inputSize = 'md',
    type = 'text',
    leadingIcon,
    trailingIcon,
    leadingAddon,
    trailingAddon,
    clearable,
    onClear,
    loading,
    revealable = true,
    quiet: _quiet = false,
    value,
    defaultValue,
    disabled,
    readOnly,
    ...props
  },
  ref,
) {
  const innerRef = useRef<HTMLInputElement>(null);
  const mergedRef = mergeRefs<HTMLInputElement>(ref, innerRef);

  const [revealed, setRevealed] = useState(false);
  const resolvedType =
    type === 'password' && revealable && revealed ? 'text' : type;

  const hasValue =
    (value !== undefined && value !== null && String(value).length > 0) ||
    (defaultValue !== undefined && String(defaultValue).length > 0);

  const canInteract = !disabled && !readOnly;

  const showClear = Boolean(clearable && hasValue && canInteract && !loading);
  const showReveal = type === 'password' && revealable && canInteract;
  const showLoading = Boolean(loading);

  const handleClear = useCallback(() => {
    const el = innerRef.current;
    if (el) writeInputValue(el, '');
    onClear?.();
  }, [onClear]);

  /* ------------------------------------------------------------------ slots */

  const leftSlot = leadingIcon ? (
    <span
      className={cn(
        'flex shrink-0 items-center text-slate-400 transition-colors duration-150 ease-out group-focus-within:text-slate-500',
        leftSlotPad[inputSize],
      )}
      aria-hidden
    >
      {leadingIcon}
    </span>
  ) : null;

  const trailingNodes: ReactNode[] = [];
  if (showLoading) {
    trailingNodes.push(
      <Loader2
        key="loading"
        size={sizeIconPx[inputSize]}
        strokeWidth={2}
        className="animate-spin text-slate-400"
        aria-hidden
      />,
    );
  }
  if (showClear) {
    trailingNodes.push(
      <TrailingSlotButton
        key="clear"
        size={inputSize}
        ariaLabel="Clear value"
        onClick={handleClear}
      >
        <X size={sizeIconPx[inputSize] - 1} strokeWidth={2.25} />
      </TrailingSlotButton>,
    );
  }
  if (showReveal) {
    trailingNodes.push(
      <TrailingSlotButton
        key="reveal"
        size={inputSize}
        ariaLabel={revealed ? 'Hide password' : 'Show password'}
        tabIndex={0}
        onClick={() => setRevealed((r) => !r)}
      >
        {revealed ? (
          <EyeOff size={sizeIconPx[inputSize]} strokeWidth={2} />
        ) : (
          <Eye size={sizeIconPx[inputSize]} strokeWidth={2} />
        )}
      </TrailingSlotButton>,
    );
  }
  if (trailingIcon && !showLoading && !showClear) {
    trailingNodes.push(
      <span key="trailingIcon" className="inline-flex items-center text-slate-400">
        {trailingIcon}
      </span>,
    );
  }

  const rightSlot = trailingNodes.length > 0 ? (
    <span className={cn('flex shrink-0 items-center gap-1', rightSlotPad[inputSize])}>
      {trailingNodes}
    </span>
  ) : null;

  /* ----------------------------------------------------------------- render */

  return (
    <div
      data-ui-input-wrapper=""
      data-invalid={invalid ? 'true' : undefined}
      data-disabled={disabled ? 'true' : undefined}
      className={cn(inputWrapperSurface, wrapperStateful(disabled), wrapperClassName)}
    >
      {leadingAddon ? <Addon size={inputSize} side="left">{leadingAddon}</Addon> : null}

      <div className="relative flex min-w-0 flex-1 items-center">
        {leftSlot}
        <input
          {...props}
          ref={mergedRef}
          type={resolvedType}
          disabled={disabled}
          readOnly={readOnly}
          value={value}
          defaultValue={defaultValue}
          aria-invalid={invalid || undefined}
          aria-busy={showLoading || undefined}
          className={cn(
            'peer w-full min-w-0 flex-1 border-0 bg-transparent shadow-none outline-none ring-0',
            'focus:ring-0 focus-visible:ring-0 focus:shadow-none focus-visible:shadow-none',
            'text-slate-900 placeholder:text-slate-400',
            'disabled:cursor-not-allowed disabled:text-slate-400',
            // Flatten autofill background in WebKit so it inherits the wrapper's styling
            '[&:-webkit-autofill]:shadow-[0_0_0_1000px_white_inset] [&:-webkit-autofill]:[-webkit-text-fill-color:#0f172a]',
            sizeHeight[inputSize],
            sizeText[inputSize],
            leftSlot ? 'pl-0' : sizePadX[inputSize],
            rightSlot ? 'pr-0' : sizePadX[inputSize],
            className,
          )}
        />
        {rightSlot}
      </div>

      {trailingAddon ? <Addon size={inputSize} side="right">{trailingAddon}</Addon> : null}
    </div>
  );
});
