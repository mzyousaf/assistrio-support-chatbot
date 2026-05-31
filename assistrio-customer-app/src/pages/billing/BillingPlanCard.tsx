import type { ReactNode } from 'react';
import { Check, Infinity, Minus, Package } from 'lucide-react';
import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';
import { Button, Tooltip } from '@/components/ui';
import {
  buildPlanCardIncludedGroups,
  buildPlanModalCardIncludedGroups,
  type BillingPlanKey,
  type PlanCardIncludedGroup,
  type PlanCardIncludedItem,
} from '@/pages/billing/billingPlanComparisonCopy';
import { CUSTOMER_TRAINED_KNOWLEDGE_PER_AI_AGENT } from '@/lib/customerAgentTerminology';
import {
  TRAINED_KNOWLEDGE_MODAL_LIMIT_SOURCE_TYPES,
  TRAINED_KNOWLEDGE_MODAL_LIMIT_TOOLTIP_LEAD,
  TRAINED_KNOWLEDGE_MODAL_LIMIT_UPLOAD_NOTE,
} from '@/lib/trainedKnowledgeStorageCopy';
import {
  resolvePlanModalFeatureTooltip,
  resolvePlanModalLimitTooltip,
  type PlanModalTooltipConfig,
} from '@/pages/billing/planModalFeatureTooltips';
import { AnimatedPlanPriceDisplay } from '@/pages/billing/AnimatedPlanPriceDisplay';
import { BillingPlanIcon } from '@/pages/billing/BillingPlanIcon';
import {
  isRecommendedPlan,
  type PlanBillingPeriod,
  planPricingCardBestFor,
  planPricingCardDescription,
  planPricingCardTitle,
  planPricingCardTrialNote,
  planPricingCardWhySection,
} from '@/pages/billing/planPricingCardDisplay';
import { cn } from '@/lib/utils';

type Props = {
  plan: WorkspaceBillingPlanCatalogCard;
  isCurrent: boolean;
  billingPeriod?: PlanBillingPeriod;
  /** Overrides static plan-page recommendation for button emphasis. */
  recommended?: boolean;
  /** Shows a small Recommended badge when `recommended` is true. */
  showRecommendedBadge?: boolean;
  actionLabel?: string;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  onAction?: () => void;
  /** When set, renders per-plan “What each plan includes” groups from the catalog. */
  planCatalog?: WorkspaceBillingPlanCatalogCard[];
  /** Modal layout: centered chrome, no “Why” section, compact includes panel. */
  variant?: 'page' | 'modal';
  /** Modal Free trial card: “Expires on {date}” when not the current plan. */
  modalExpiresOnButtonLabel?: string | null;
  /** Modal current-plan card: “{n} Days Left” on the CTA. */
  modalDaysLeftButtonLabel?: string | null;
};

function PlanCornerTag({
  label,
  planKey,
  isCurrentPlan = false,
}: {
  label: string;
  planKey: string;
  isCurrentPlan?: boolean;
}) {
  return (
    <span
      className={cn(
        'absolute right-0 top-0 max-w-[11rem] rounded-bl-xl rounded-tr-2xl px-2.5 py-1 text-[10px] font-semibold leading-snug shadow-sm',
        isCurrentPlan && 'bg-primary text-white ring-1 ring-teal-700/30',
        !isCurrentPlan && planKey === 'starter' && 'bg-amber-50 text-amber-900 ring-1 ring-amber-200/80',
        !isCurrentPlan && planKey === 'pro' && 'bg-slate-900 text-white',
        !isCurrentPlan &&
          (planKey === 'free' || !['starter', 'pro'].includes(planKey)) &&
          'bg-teal-50 text-teal-800 ring-1 ring-teal-200/80',
      )}
    >
      {label}
    </span>
  );
}

function PlanCardComparisonValue({ value }: { value: string }) {
  const normalized = value.trim();

  if (normalized === 'Included' || normalized === 'Advanced') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600" aria-label="Included">
        <Check size={12} strokeWidth={2.5} className="shrink-0 text-teal-600" aria-hidden />
        Included
      </span>
    );
  }

  if (normalized === '—') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-400" aria-label="Not included">
        <Minus size={12} strokeWidth={2} aria-hidden />
        Not included
      </span>
    );
  }

  if (normalized === 'Unlimited') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600">
        <Infinity size={12} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden />
        Unlimited
      </span>
    );
  }

  if (normalized.startsWith('Included, uses credits')) {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600" aria-label="Included">
        <Check size={12} strokeWidth={2.5} className="shrink-0 text-teal-600" aria-hidden />
        Included
      </span>
    );
  }

  if (normalized === 'Available on paid plans' || normalized === 'Coming soon') {
    return <span className="shrink-0 text-xs text-slate-500">{normalized}</span>;
  }

  if (normalized === 'Add-on') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-600">
        <Package size={12} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden />
        Add-on
      </span>
    );
  }

  if (normalized === 'Standard' || normalized === 'Priority') {
    return (
      <span className="inline-flex shrink-0 items-center gap-1 text-xs text-slate-700">
        <Check size={12} strokeWidth={2.5} className="shrink-0 text-teal-600" aria-hidden />
        {normalized}
      </span>
    );
  }

  return <span className="shrink-0 text-right text-xs tabular-nums text-slate-600">{value}</span>;
}

function PlanCardFeatureLabel(props: {
  feature: string;
  featureHint?: readonly string[];
  compact?: boolean;
  /** Modal grid: plain label, optional tooltip without underline. */
  plain?: boolean;
}) {
  const textClass = cn(
    'min-w-0 leading-snug text-slate-600',
    props.compact ? 'text-xs' : 'text-[13px]',
  );

  if (!props.featureHint?.length || props.plain) {
    return <span className={textClass}>{props.feature}</span>;
  }

  return (
    <Tooltip
      content={
        <ul className="m-0 list-none space-y-0.5 p-0">
          {props.featureHint.map((hint) => (
            <li key={hint}>{hint}</li>
          ))}
        </ul>
      }
      side="top"
      panelClassName="max-w-xs"
    >
      <span
        className={cn(
          textClass,
          'cursor-help border-b border-dotted border-slate-400/80',
        )}
      >
        {props.feature}
      </span>
    </Tooltip>
  );
}

function modalCoreLimitLabel(feature: string): string {
  if (feature === 'Agents') return 'AI Agents';
  if (feature === 'Workspace members') return 'Members';
  if (feature === 'AI credits / month' || feature === 'AI credits') return 'AI credits';
  if (feature === CUSTOMER_TRAINED_KNOWLEDGE_PER_AI_AGENT) {
    return 'Trained Knowledge Base Storage';
  }
  return feature;
}

function modalCoreLimitValue(feature: string, value: string): string {
  if (feature === 'AI credits / month' || feature === 'AI credits') {
    return value
      .replace(' AI credits / month', ' / month')
      .replace(' trial credits total', ' trial total');
  }
  return value;
}

function modalFeatureIncluded(value: string): boolean {
  const normalized = value.trim();
  return (
    normalized !== '—' &&
    normalized !== 'Not included' &&
    normalized !== 'Available on paid plans'
  );
}

function modalFeatureSuffix(value: string): string | null {
  const normalized = value.trim();

  if (
    normalized === 'Included' ||
    normalized === 'Advanced' ||
    normalized.startsWith('Included, uses credits')
  ) {
    return null;
  }

  if (normalized === '—') return null;

  if (normalized === 'Unlimited') {
    return null;
  }

  if (
    normalized === 'Standard' ||
    normalized === 'Priority' ||
    normalized === 'Add-on' ||
    normalized === 'Coming soon' ||
    normalized === 'Available on paid plans' ||
    /^\d+ days$/.test(normalized)
  ) {
    return normalized;
  }

  return normalized.length > 0 ? normalized : null;
}

const PLAN_MODAL_TOOLTIP_PANEL = '!max-w-[17rem] !px-3 !py-2.5 !text-white';

function PlanModalTooltipBullet({ children }: { children: ReactNode }) {
  return (
    <li className="flex items-start gap-1.5 text-white">
      <span
        className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-white"
        aria-hidden
      />
      <span>{children}</span>
    </li>
  );
}

function PlanModalBulletedTooltipContent({ config }: { config: PlanModalTooltipConfig }) {
  const footer = config.footer?.trim();
  const hasFooter = Boolean(footer);

  return (
    <div className="max-w-[15rem] text-left text-xs font-normal leading-snug text-white">
      <ul
        className={cn(
          'm-0 list-none space-y-1',
          hasFooter && 'border-b border-white/20 pb-2',
        )}
      >
        {config.bullets.map((bullet) => (
          <PlanModalTooltipBullet key={bullet}>{bullet}</PlanModalTooltipBullet>
        ))}
      </ul>
      {hasFooter ? <p className="m-0 mt-2 text-white">{footer}</p> : null}
    </div>
  );
}

function TrainedKnowledgeLimitTooltipContent() {
  return (
    <PlanModalBulletedTooltipContent
      config={{
        bullets: [
          TRAINED_KNOWLEDGE_MODAL_LIMIT_TOOLTIP_LEAD,
          ...TRAINED_KNOWLEDGE_MODAL_LIMIT_SOURCE_TYPES,
        ],
        footer: TRAINED_KNOWLEDGE_MODAL_LIMIT_UPLOAD_NOTE,
      }}
    />
  );
}

function PlanModalDottedHintLabel(props: {
  label: string;
  tooltip: ReactNode;
  className?: string;
}) {
  return (
    <Tooltip content={props.tooltip} side="top" panelClassName={PLAN_MODAL_TOOLTIP_PANEL}>
      <span
        className={cn(
          'cursor-help border-b border-dotted border-slate-400/80',
          props.className,
        )}
      >
        {props.label}
      </span>
    </Tooltip>
  );
}

function PlanCardModalLimitRow({
  feature,
  value,
  featureHint,
  planKey,
}: {
  feature: string;
  value: string;
  featureHint?: readonly string[];
  planKey: BillingPlanKey;
}) {
  const label = modalCoreLimitLabel(feature);
  const isTrainedKnowledge = feature === CUSTOMER_TRAINED_KNOWLEDGE_PER_AI_AGENT;
  const limitTooltip = resolvePlanModalLimitTooltip(feature, planKey, featureHint);

  let labelNode: ReactNode = <span className="text-xs text-slate-500">{label}</span>;

  if (isTrainedKnowledge) {
    labelNode = (
      <PlanModalDottedHintLabel
        label={label}
        className="text-xs text-slate-500"
        tooltip={<TrainedKnowledgeLimitTooltipContent />}
      />
    );
  } else if (limitTooltip) {
    labelNode = (
      <PlanModalDottedHintLabel
        label={label}
        className="text-xs text-slate-500"
        tooltip={<PlanModalBulletedTooltipContent config={limitTooltip} />}
      />
    );
  }

  return (
    <li className="flex items-baseline justify-between gap-3 py-0.5">
      {labelNode}
      <span className="shrink-0 text-right text-xs font-normal tabular-nums text-slate-800">
        {modalCoreLimitValue(feature, value)}
      </span>
    </li>
  );
}

function modalFeatureDisplayLabel(feature: string): string {
  if (feature === 'Lead capture') return 'Lead Capture';
  if (feature === 'Lead management') return 'Lead Management';
  return feature;
}

function modalFeatureIsUnlimited(value: string): boolean {
  return value.trim() === 'Unlimited';
}

function PlanCardModalFeatureItem({
  item,
  planKey,
}: {
  item: PlanCardIncludedItem;
  planKey: BillingPlanKey;
}) {
  const isUnlimited = modalFeatureIsUnlimited(item.value);
  const suffix = modalFeatureSuffix(item.value);
  const label = modalFeatureDisplayLabel(item.feature);
  const featureTooltip = resolvePlanModalFeatureTooltip(item.feature, planKey, item.featureHint);

  const labelNode = featureTooltip ? (
    <PlanModalDottedHintLabel
      label={label}
      className="text-xs leading-snug text-slate-600"
      tooltip={<PlanModalBulletedTooltipContent config={featureTooltip} />}
    />
  ) : (
    <span className="text-xs leading-snug text-slate-600">{label}</span>
  );

  return (
    <li
      className={cn(
        'flex min-w-0 items-start gap-1.5 py-0.5',
        item.feature === 'Priority support' && 'sm:col-span-2',
      )}
    >
      {isUnlimited ? (
        <Infinity
          size={12}
          strokeWidth={2}
          className="mt-0.5 shrink-0 text-teal-600"
          aria-label="Unlimited"
        />
      ) : (
        <Check
          size={12}
          strokeWidth={2.5}
          className="mt-0.5 shrink-0 text-teal-600"
          aria-hidden
        />
      )}
      <span className="inline-flex min-w-0 flex-nowrap items-baseline gap-0 whitespace-nowrap">
        {labelNode}
        {suffix ? (
          <>
            <span
              className="shrink-0 px-1 text-[11px] font-semibold leading-none text-slate-500"
              aria-hidden
            >
              ·
            </span>
            <span className="text-xs text-slate-500">{suffix}</span>
          </>
        ) : null}
      </span>
    </li>
  );
}

function PlanCardModalIncludesSection({
  groups,
  planKey,
}: {
  groups: PlanCardIncludedGroup[];
  planKey: BillingPlanKey;
}) {
  if (groups.length === 0) return null;

  return (
    <div className="w-full text-left">
      {groups.map((group, groupIndex) => {
        const isLimits = group.id === 'core-limits';

        return (
          <div
            key={group.id}
            className={cn(groupIndex > 0 && 'mt-4 border-t border-slate-100 pt-4')}
          >
            <p className="m-0 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              {group.title}
            </p>
            {isLimits ? (
              <ul className="m-0 mt-2 list-none space-y-0 p-0">
                {group.items.map((item) => (
                  <PlanCardModalLimitRow
                    key={`${group.id}-${item.feature}`}
                    feature={item.feature}
                    value={item.value}
                    featureHint={item.featureHint}
                    planKey={planKey}
                  />
                ))}
              </ul>
            ) : (
              <ul className="m-0 mt-2 grid list-none grid-cols-1 gap-x-4 gap-y-0 p-0 sm:grid-cols-2">
                {group.items
                  .filter((item) => modalFeatureIncluded(item.value))
                  .map((item) => (
                    <PlanCardModalFeatureItem
                      key={`${group.id}-${item.feature}`}
                      item={item}
                      planKey={planKey}
                    />
                  ))}
              </ul>
            )}
            {group.note && group.id !== 'core-limits' ? (
              <p className="m-0 mt-1.5 text-[10px] leading-snug text-slate-400">{group.note}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function PlanCardIncludesSection(props: {
  planKey: string;
  planCatalog: WorkspaceBillingPlanCatalogCard[];
  variant?: 'page' | 'modal';
}) {
  const planKey = props.planKey as BillingPlanKey;
  const isModal = props.variant === 'modal';

  if (isModal) {
    const groups = buildPlanModalCardIncludedGroups(planKey, props.planCatalog);
    return <PlanCardModalIncludesSection groups={groups} planKey={planKey} />;
  }

  const groups = buildPlanCardIncludedGroups(planKey, props.planCatalog);
  if (groups.length === 0) return null;

  return (
    <div className="space-y-4 text-left">
      <h4 className="m-0 text-xs font-semibold tracking-wide text-slate-800">What&apos;s included</h4>
      {groups.map((group) => (
        <div key={group.id} className="space-y-2">
          <p className="m-0 text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {group.title}
          </p>
          <ul className="m-0 mt-0 list-none space-y-1.5 p-0">
            {group.items.map((item) => (
              <li
                key={`${group.id}-${item.feature}`}
                className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 gap-y-0.5"
              >
                <PlanCardFeatureLabel feature={item.feature} featureHint={item.featureHint} />
                <PlanCardComparisonValue value={item.value} />
              </li>
            ))}
          </ul>
          {group.note ? (
            <p className="m-0 text-[11px] leading-snug text-slate-400">{group.note}</p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PlanWhySection({ planKey }: { planKey: string }) {
  const { heading, bullets, footnote } = planPricingCardWhySection(planKey);

  return (
    <div className="text-left">
      <h4 className="m-0 text-xs font-semibold tracking-wide text-slate-800">{heading}</h4>
      <ul className="m-0 mt-3 list-none space-y-2 p-0">
        {bullets.map((bullet) => (
          <li key={bullet} className="flex items-start gap-2">
            <Check
              size={14}
              strokeWidth={2.25}
              className="mt-0.5 shrink-0 text-teal-600/80"
              aria-hidden
            />
            <span className="text-[13px] leading-snug text-slate-600">{bullet}</span>
          </li>
        ))}
      </ul>
      {footnote ? (
        <p className="m-0 mt-2.5 border-t border-slate-100/90 pt-2 text-[11px] font-normal text-slate-400">
          {footnote}
        </p>
      ) : null}
    </div>
  );
}

export function BillingPlanCard({
  plan,
  isCurrent,
  billingPeriod = 'monthly',
  recommended: recommendedOverride,
  showRecommendedBadge = false,
  actionLabel,
  actionDisabled = true,
  actionLoading = false,
  onAction,
  planCatalog,
  variant = 'page',
  modalExpiresOnButtonLabel = null,
  modalDaysLeftButtonLabel = null,
}: Props) {
  const isModal = variant === 'modal';
  const recommended = recommendedOverride ?? isRecommendedPlan(plan.key);
  const trialNote = planPricingCardTrialNote(plan.key);
  const showModalCurrentCornerTag = isModal && isCurrent;
  const showModalExpiresOnButton =
    isModal && !isCurrent && Boolean(modalExpiresOnButtonLabel?.trim());
  const showModalDaysLeftButton =
    isModal && isCurrent && Boolean(modalDaysLeftButtonLabel?.trim());
  const cornerTagLabel = showModalCurrentCornerTag
    ? 'Current plan'
    : planPricingCardBestFor(plan.key);
  const buttonLabel =
    showModalDaysLeftButton && modalDaysLeftButtonLabel
      ? modalDaysLeftButtonLabel
      : showModalExpiresOnButton && modalExpiresOnButtonLabel
        ? modalExpiresOnButtonLabel
        : actionLabel ?? (isCurrent ? 'Current plan' : 'Coming soon');
  const buttonDisabled =
    showModalDaysLeftButton ||
    showModalExpiresOnButton ||
    actionDisabled ||
    actionLoading;

  return (
    <article
      aria-current={isCurrent ? 'true' : undefined}
      className={cn(
        'relative flex h-full flex-col rounded-2xl border border-slate-200/90 shadow-[var(--shadow-card)]',
        isModal
          ? 'min-h-0 w-full max-w-[365px] bg-[var(--bg-workspace-canvas)] p-5'
          : 'bg-white p-6',
      )}
    >
      {showRecommendedBadge && recommended ? (
        <span className="absolute left-0 top-0 rounded-br-xl rounded-tl-2xl bg-teal-50 px-2.5 py-1 text-[10px] font-semibold leading-snug text-teal-800 ring-1 ring-teal-200/80">
          Recommended
        </span>
      ) : null}
      <PlanCornerTag
        label={cornerTagLabel}
        planKey={plan.key}
        isCurrentPlan={showModalCurrentCornerTag}
      />

      <div
        className={cn(
          'flex w-full flex-col text-left',
          isModal ? 'shrink-0 pr-14' : 'pr-14',
        )}
      >
        <div
          className={cn(
            'flex items-center gap-2.5',
            !isModal && 'min-h-11 gap-3',
          )}
        >
          <BillingPlanIcon planKey={plan.key} />
          <h3
            className={cn(
              'm-0 min-w-0 font-semibold leading-snug tracking-tight text-slate-900',
              isModal ? 'text-base' : 'text-lg',
            )}
          >
            {planPricingCardTitle(plan.key, plan.name)}
          </h3>
        </div>

        <AnimatedPlanPriceDisplay
          priceMonthly={plan.priceMonthly}
          planKey={plan.key}
          billingPeriod={billingPeriod}
          pricing={plan}
          align="left"
          size={isModal ? 'compact' : 'default'}
        />

        {isModal ? (
          <p className="m-0 mt-3 text-xs leading-snug text-slate-500">
            {planPricingCardDescription(plan.key)}
          </p>
        ) : null}
      </div>

      <div className="mt-4 w-full shrink-0">
        <Button
          type="button"
          variant={recommended && !buttonDisabled ? 'primary' : 'secondary'}
          size="md"
          disabled={buttonDisabled}
          className={cn(
            'h-10 text-sm',
            isModal ? 'w-full' : 'w-full min-w-full',
          )}
          onClick={onAction}
        >
          {actionLoading ? 'Starting checkout…' : buttonLabel}
        </Button>
      </div>

      {isModal && planCatalog?.length ? (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <PlanCardIncludesSection
            planKey={plan.key}
            planCatalog={planCatalog}
            variant="modal"
          />
        </div>
      ) : (
        <div className="mt-6 flex-1 space-y-5 border-t border-slate-100 pt-5">
          <PlanWhySection planKey={plan.key} />
          {planCatalog?.length ? (
            <div className="border-t border-slate-100/90 pt-5">
              <PlanCardIncludesSection planKey={plan.key} planCatalog={planCatalog} variant="page" />
            </div>
          ) : null}
        </div>
      )}

      {trialNote ? (
        <p
          className={cn(
            'm-0 mt-4 shrink-0 border-t border-slate-100 pt-4 text-[11px] leading-snug text-slate-400',
            'text-left',
          )}
        >
          {trialNote}
        </p>
      ) : null}
    </article>
  );
}
