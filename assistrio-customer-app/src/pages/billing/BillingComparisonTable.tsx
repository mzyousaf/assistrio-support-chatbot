import { Fragment, type ReactNode } from 'react';
import { Check, ChevronDown, Infinity, Info, Minus, Package } from 'lucide-react';
import type { WorkspaceBillingPlanCatalogCard } from '@/api/types';
import { Tooltip } from '@/components/ui';
import {
  type BillingPlanKey,
  PLAN_COLUMN_LABELS,
  PLAN_KEYS,
  type PlanComparisonRow,
} from '@/pages/billing/billingPlanComparisonCopy';
import { cn } from '@/lib/utils';
type SectionProps = {
  id: string;
  title: string;
  subtitle?: string;
  note?: ReactNode;
  align?: 'left' | 'center';
  compact?: boolean;
  children: ReactNode;
  className?: string;
};

export function BillingComparisonSection({
  id,
  title,
  subtitle,
  note,
  align = 'left',
  compact = false,
  children,
  className,
}: SectionProps) {
  const centered = align === 'center';

  return (
    <section
      aria-labelledby={id}
      className={cn(compact ? 'space-y-3' : centered ? 'space-y-5' : 'space-y-3', className)}
    >
      <div className={cn(centered && 'mx-auto max-w-2xl text-center')}>
        <h2
          id={id}
          className={cn(
            'm-0 font-semibold tracking-tight text-slate-900',
            compact ? 'text-lg' : centered ? 'text-xl' : 'text-base',
          )}
        >
          {title}
        </h2>
        {subtitle ? (
          <p
            className={cn(
              'm-0 text-sm leading-relaxed text-slate-500',
              compact ? 'mt-1' : 'mt-2',
              centered && 'mx-auto max-w-lg',
            )}
          >
            {subtitle}
          </p>
        ) : null}
        {note ? (
          <div
            className={cn(
              'flex gap-2.5 rounded-xl border border-slate-200/90 bg-white px-4 py-3 text-left shadow-[var(--shadow-card)]',
              compact ? 'mt-2.5' : 'mt-4',
              centered && 'mx-auto max-w-lg',
            )}
          >
            <Info size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-teal-600/70" aria-hidden />
            <p className="m-0 text-sm leading-relaxed text-slate-600">{note}</p>
          </div>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function ComparisonCellValue({ value, compact = false }: { value: string; compact?: boolean }) {
  const normalized = value.trim();
  const iconSize = compact ? 14 : 16;
  const textClass = cn(compact ? 'text-xs leading-snug' : 'text-sm leading-relaxed', 'text-slate-700');

  if (normalized === 'Included' || normalized === 'Advanced') {
    return (
      <span className="inline-flex items-center justify-center" aria-label="Included">
        <Check size={iconSize} strokeWidth={2.5} className="shrink-0 text-teal-600" aria-hidden />
      </span>
    );
  }

  if (normalized === '—') {
    return (
      <span className="inline-flex items-center justify-center text-slate-300" aria-label="Not included">
        <Minus size={iconSize} strokeWidth={2} aria-hidden />
      </span>
    );
  }

  if (normalized === 'Unlimited') {
    return (
      <span className="inline-flex items-center justify-center gap-1.5">
        <Infinity size={iconSize} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden />
        <span className={textClass}>Unlimited</span>
      </span>
    );
  }

  if (/^\d+ days$/.test(normalized)) {
    return <span className={textClass}>{normalized}</span>;
  }

  if (normalized.startsWith('Included, uses credits')) {
    return (
      <span className="inline-flex items-center justify-center" aria-label="Included">
        <Check size={iconSize} strokeWidth={2.5} className="shrink-0 text-teal-600" aria-hidden />
      </span>
    );
  }

  if (normalized === 'Add-on') {
    return (
      <span className="inline-flex items-center justify-center gap-1.5">
        <Package size={iconSize} strokeWidth={2} className="shrink-0 text-slate-500" aria-hidden />
        <span className={textClass}>Add-on</span>
      </span>
    );
  }

  if (normalized === 'Standard' || normalized === 'Priority') {
    return (
      <span className="inline-flex items-center justify-center gap-1.5">
        <Check size={iconSize} strokeWidth={2.5} className="shrink-0 text-teal-600" aria-hidden />
        <span className={cn(textClass, 'font-medium text-slate-800')}>{normalized}</span>
      </span>
    );
  }

  return <span className={textClass}>{value}</span>;
}

function isCurrentPlanColumn(planKey: BillingPlanKey, currentPlanKey?: string | null): boolean {
  return Boolean(currentPlanKey && planKey === currentPlanKey);
}

function resolvePlanColumnHeaders(catalog?: WorkspaceBillingPlanCatalogCard[]) {
  return PLAN_KEYS.map((planKey) => {
    const plan = catalog?.find((entry) => entry.key === planKey);
    return {
      key: planKey,
      name: plan?.name ?? PLAN_COLUMN_LABELS[planKey],
    };
  });
}

function ComparisonPlanColumnHeader(props: { name: string }) {
  return (
    <span className="text-xs font-semibold text-slate-900">{props.name}</span>
  );
}

type CompactPlanComparisonTableProps = {
  rows?: PlanComparisonRow[];
  groups?: Array<{ id: string; title: string; rows: PlanComparisonRow[] }>;
  planCatalog?: WorkspaceBillingPlanCatalogCard[];
  currentPlanKey?: string | null;
};

const FEATURE_COLUMN_CLASS = 'sticky left-0 z-10 bg-white';

const PLAN_COLUMN_CLASS = 'w-[25%] px-3 py-2 align-middle text-center break-words';

const CURRENT_PLAN_COLUMN_CLASS = 'bg-teal-50/10';

function ComparisonFeatureLabel({ row }: { row: PlanComparisonRow }) {
  if (!row.featureHint?.length) {
    return row.feature;
  }

  return (
    <Tooltip
      content={
        <ul className="m-0 list-none space-y-0.5 p-0">
          {row.featureHint.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      }
      side="top"
      panelClassName="max-w-xs"
    >
      <span className="cursor-help border-b border-dotted border-slate-400/80">{row.feature}</span>
    </Tooltip>
  );
}

function ComparisonFeatureRow({
  row,
  currentPlanKey,
}: {
  row: PlanComparisonRow;
  currentPlanKey?: string | null;
}) {
  return (
    <tr className="border-b border-slate-100/80 last:border-b-0">
      <th
        scope="row"
        className={cn(FEATURE_COLUMN_CLASS, 'px-3 py-2 pl-4 text-left text-xs font-medium break-words text-slate-600')}
      >
        <ComparisonFeatureLabel row={row} />
      </th>
      {PLAN_KEYS.map((planKey) => {
        const isCurrent = isCurrentPlanColumn(planKey, currentPlanKey);
        return (
          <td key={planKey} className={cn(PLAN_COLUMN_CLASS, isCurrent && CURRENT_PLAN_COLUMN_CLASS)}>
            <ComparisonCellValue value={row.values[planKey]} compact />
          </td>
        );
      })}
    </tr>
  );
}

export function BillingCompactPlanComparisonTable({
  rows,
  groups,
  planCatalog,
  currentPlanKey,
}: CompactPlanComparisonTableProps) {
  const columnCount = 1 + PLAN_KEYS.length;
  const tableGroups =
    groups ??
    (rows ? [{ id: 'features', title: '', rows }] : []);
  const planColumns = resolvePlanColumnHeaders(planCatalog);

  return (
    <div className="overflow-x-auto overscroll-x-contain">
      <table className="w-full min-w-[520px] table-fixed border-collapse">
        <colgroup>
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
          <col style={{ width: '25%' }} />
        </colgroup>
        <thead>
          <tr className="border-b-2 border-teal-600">
            <th
              scope="col"
              className={cn(FEATURE_COLUMN_CLASS, 'px-3 py-2.5 pl-4')}
              aria-hidden
            />
            {planColumns.map((planColumn) => {
              const isCurrent = isCurrentPlanColumn(planColumn.key, currentPlanKey);
              return (
                <th
                  key={planColumn.key}
                  scope="col"
                  className={cn(
                    PLAN_COLUMN_CLASS,
                    'py-2.5 align-middle',
                    isCurrent && CURRENT_PLAN_COLUMN_CLASS,
                  )}
                >
                  <ComparisonPlanColumnHeader name={planColumn.name} />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {tableGroups.map((group) => (
            <Fragment key={group.id}>
              {group.title ? (
                <tr className="border-y border-slate-200/70 bg-gradient-to-r from-slate-50 via-teal-50/25 to-slate-50">
                  <th
                    colSpan={columnCount}
                    scope="colgroup"
                    className="sticky left-0 z-10 px-5 py-2.5 text-left text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600"
                  >
                    {group.title}
                  </th>
                </tr>
              ) : null}
              {group.rows.map((row) => (
                <ComparisonFeatureRow
                  key={`${group.id}-${row.feature}`}
                  row={row}
                  currentPlanKey={currentPlanKey}
                />
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function BillingPlanComparisonTable(props: {
  groups: Array<{ id: string; title: string; rows: PlanComparisonRow[] }>;
  planCatalog?: WorkspaceBillingPlanCatalogCard[];
  currentPlanKey?: string | null;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]">
      <BillingCompactPlanComparisonTable {...props} />
    </div>
  );
}

type FeatureGroup = { id: string; title: string; rows: PlanComparisonRow[] };

export function BillingFeatureComparisonAccordion(props: {
  groups: FeatureGroup[];
  currentPlanKey?: string | null;
}) {
  return (
    <div className="space-y-2">
      {props.groups.map((group, index) => (
        <details
          key={group.id}
          open={index === 0}
          className="group overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-[var(--shadow-card)]"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
            <span className="text-sm font-medium text-slate-900">{group.title}</span>
            <ChevronDown
              size={16}
              aria-hidden
              className="shrink-0 text-slate-400 transition-transform duration-200 group-open:rotate-180"
            />
          </summary>
          <div className="border-t border-slate-100 px-1 pb-1 pt-0">
            <BillingCompactPlanComparisonTable
              rows={group.rows}
              currentPlanKey={props.currentPlanKey}
            />
          </div>
        </details>
      ))}
    </div>
  );
}

export function BillingKbStorageInfoCard(props: { title: string; notes: readonly string[] }) {
  return (
    <div className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[var(--shadow-card)]">
      <h3 className="m-0 text-sm font-semibold text-slate-900">{props.title}</h3>
      <div className="mt-2 space-y-1.5">
        {props.notes.map((note) => (
          <p key={note} className="m-0 text-xs leading-relaxed text-slate-600">
            {note}
          </p>
        ))}
      </div>
    </div>
  );
}

type GuideRow = { plan: string; guide: string };

export function BillingTrainedKnowledgeGuideCards({ rows }: { rows: GuideRow[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-3">
      {rows.map((row) => (
        <div
          key={row.plan}
          className="rounded-xl border border-slate-200/90 bg-white px-4 py-3.5 shadow-[var(--shadow-card)]"
        >
          <p className="m-0 text-sm font-semibold text-slate-900">{row.plan}</p>
          <p className="m-0 mt-1.5 text-sm leading-relaxed text-slate-600">{row.guide}</p>
        </div>
      ))}
    </div>
  );
}
