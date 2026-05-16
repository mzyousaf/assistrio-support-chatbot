"use client";

import { InternalAnalyticsOverview } from "@/components/analytics/InternalAnalyticsOverview";
import { useAdminUser } from "@/hooks/useAdminUser";

export default function AdminAnalyticsPage() {
  const { user, loading: authLoading } = useAdminUser();
  return <InternalAnalyticsOverview authLoading={authLoading} isAuthenticated={!!user} />;
}
