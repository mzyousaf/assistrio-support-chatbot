import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Info, Pencil, Trash2 } from 'lucide-react';
import { Checkbox, Tooltip } from '@/components/ui';
import { cn } from '@/lib/utils';
import { OnboardingSectionHeading } from './OnboardingSectionHeading';
import {
  OnboardingKnowledgeTabs,
  type OnboardingKnowledgeTabCounts,
  type OnboardingKnowledgeTabId,
} from './OnboardingKnowledgeTabs';

type TabBarProps = {
  value: OnboardingKnowledgeTabId;
  onChange: (tab: OnboardingKnowledgeTabId) => void;
  counts: OnboardingKnowledgeTabCounts;
  disabled?: boolean;
};

export function OnboardingKnowledgeTabBar({ value, onChange, counts, disabled }: TabBarProps) {
  return (
    <OnboardingKnowledgeTabs value={value} onChange={onChange} counts={counts} disabled={disabled} />
  );
}

export function OnboardingKnowledgeRequirementBanner({
  emphasized = false,
  className,
}: {
  emphasized?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'knowledge-requirement-banner',
        emphasized && 'knowledge-requirement-banner--emphasized',
        className,
      )}
      role="status"
    >
      <Info className="knowledge-requirement-banner-icon size-4 shrink-0" aria-hidden />
      <div className="knowledge-requirement-banner-copy">
        <p className="knowledge-requirement-banner-title">Add at least one knowledge source before continuing.</p>
        <p className="knowledge-requirement-banner-text">
          Start with a document, Q&amp;A pair, snippet, or datasheet.
        </p>
      </div>
    </div>
  );
}

export function OnboardingKnowledgeCountTag({
  current,
  max,
  limitMessage,
}: {
  current: number;
  max: number;
  limitMessage?: string;
}) {
  const atLimit = current >= max;
  const tag = (
    <span className="knowledge-source-panel-count-tag" aria-label={`${current} of ${max} used`}>
      ({current}/{max})
    </span>
  );

  if (atLimit && limitMessage) {
    return (
      <Tooltip content={limitMessage} side="bottom">
        <span className="inline-flex">{tag}</span>
      </Tooltip>
    );
  }

  return tag;
}

/** Wraps a disabled-at-limit control so the limit message appears on hover/focus. */
export function OnboardingKnowledgeLimitAction({
  atLimit,
  message,
  children,
}: {
  atLimit: boolean;
  message: string;
  children: ReactNode;
}) {
  if (!atLimit) return <>{children}</>;

  return (
    <Tooltip content={message} side="bottom">
      <span className="inline-flex">{children}</span>
    </Tooltip>
  );
}

export function OnboardingKnowledgePanel({
  title,
  icon,
  count,
  limitMessage,
  helper,
  meta,
  action,
  children,
  className,
}: {
  title: string;
  icon?: LucideIcon;
  count?: { current: number; max: number };
  limitMessage?: string;
  helper?: string;
  meta?: string;
  action?: ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const hasItems = (count?.current ?? 0) > 0;

  return (
    <section className={cn('knowledge-source-panel', className)}>
      <div className="knowledge-source-panel-header">
        <div className="knowledge-source-panel-heading">
          <div
            className={cn(
              'knowledge-source-panel-title-row',
              count && !hasItems && 'knowledge-source-panel-title-row--spaced',
            )}
          >
            <div className="knowledge-source-panel-title-group">
              {icon ? (
                <OnboardingSectionHeading icon={icon} as="h2">
                  {title}
                </OnboardingSectionHeading>
              ) : (
                <h2 className="knowledge-source-panel-title">{title}</h2>
              )}
              {count && hasItems ? (
                <OnboardingKnowledgeCountTag
                  current={count.current}
                  max={count.max}
                  limitMessage={limitMessage}
                />
              ) : null}
            </div>
            {count && !hasItems ? (
              <OnboardingKnowledgeCountTag
                current={count.current}
                max={count.max}
                limitMessage={limitMessage}
              />
            ) : null}
          </div>
          {helper ? <p className="knowledge-source-panel-description">{helper}</p> : null}
        </div>
        <div className="knowledge-source-panel-side">
          {meta ? <div className="knowledge-source-panel-meta">{meta}</div> : null}
          {action ? <div className="knowledge-source-panel-actions">{action}</div> : null}
        </div>
      </div>
      <div className="knowledge-source-panel-body">{children}</div>
    </section>
  );
}

export function OnboardingKnowledgeEmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="knowledge-empty-state">
      <div className="knowledge-empty-state-icon-wrap" aria-hidden>
        <Icon className="size-5" strokeWidth={1.75} />
      </div>
      <div className="knowledge-empty-state-copy">
        <p className="knowledge-empty-state-title">{title}</p>
        {description ? <p className="knowledge-empty-state-description">{description}</p> : null}
      </div>
      {action ? <div className="knowledge-empty-state-action">{action}</div> : null}
    </div>
  );
}

export function OnboardingKnowledgeListCard({
  title,
  meta,
  preview,
  onEdit,
  onDelete,
  disabled,
  selectable,
  selected = false,
  onSelectChange,
  editLabel = 'Edit',
  deleteLabel = 'Delete',
}: {
  title: string;
  meta?: string;
  preview?: string;
  onEdit: () => void;
  onDelete: () => void;
  disabled?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: () => void;
  editLabel?: string;
  deleteLabel?: string;
}) {
  return (
    <li className={cn('knowledge-list-card', selectable && 'knowledge-list-card--selectable')}>
      {selectable ? (
        <div className="shrink-0 self-center" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            disabled={disabled}
            onChange={onSelectChange}
            aria-label={`Select ${title}`}
          />
        </div>
      ) : null}
      <div className="knowledge-list-card-main">
        <div className="knowledge-list-card-title-row">
          <span className="knowledge-list-card-title">{title}</span>
          {meta ? <span className="knowledge-list-card-meta">{meta}</span> : null}
        </div>
        {preview ? <p className="knowledge-list-card-preview">{preview}</p> : null}
      </div>
      <div className="knowledge-list-card-actions">
        <button
          type="button"
          disabled={disabled}
          aria-label={editLabel}
          title={editLabel}
          className="knowledge-list-card-icon-btn"
          onClick={onEdit}
        >
          <Pencil className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-label={deleteLabel}
          title={deleteLabel}
          className="knowledge-list-card-icon-btn knowledge-list-card-icon-btn--danger"
          onClick={onDelete}
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
