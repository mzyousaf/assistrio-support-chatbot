"use client";

import { InternalAnalyticsOverview } from "@/components/analytics/InternalAnalyticsOverview";
import { useUser } from "@/hooks/useUser";

export default function UserAnalyticsPage() {
  const { user, loading: authLoading } = useUser();
  return <InternalAnalyticsOverview authLoading={authLoading} isAuthenticated={!!user} />;
}
