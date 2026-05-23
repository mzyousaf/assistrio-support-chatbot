import { useEffect, useMemo, useState } from 'react';

import {
  ONBOARDING_KNOWLEDGE_LIST_PAGE_SIZE,
  clampOnboardingKnowledgePageSize,
  onboardingKnowledgePageSizeOptions,
} from '@/lib/onboardingKnowledgeLimits';

export function useOnboardingKnowledgeListPagination<T>(items: readonly T[], maxItems: number) {
  const pageSizeOptions = useMemo(() => onboardingKnowledgePageSizeOptions(maxItems), [maxItems]);
  const [pageSize, setPageSizeState] = useState(() =>
    clampOnboardingKnowledgePageSize(ONBOARDING_KNOWLEDGE_LIST_PAGE_SIZE, maxItems),
  );
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPageSizeState((current) => clampOnboardingKnowledgePageSize(current, maxItems));
  }, [maxItems, pageSizeOptions]);

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));

  useEffect(() => {
    setPage((current) => Math.min(current, pageCount));
  }, [pageCount, items.length]);

  const safePage = Math.min(page, pageCount);

  const pageItems = useMemo(
    () => items.slice((safePage - 1) * pageSize, safePage * pageSize),
    [items, safePage, pageSize],
  );

  const showPageControls = items.length > pageSize;
  const from = items.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const to = items.length === 0 ? 0 : Math.min(safePage * pageSize, items.length);

  function setPageSize(nextSize: number) {
    const clamped = clampOnboardingKnowledgePageSize(nextSize, maxItems);
    setPageSizeState(clamped);
    setPage(1);
  }

  return {
    pageItems,
    page: safePage,
    pageCount,
    setPage,
    pageSize,
    pageSizeOptions,
    setPageSize,
    total: items.length,
    showPageControls,
    from,
    to,
  };
}
