"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const PLATFORM_VISITOR_ID_STORAGE_KEY = "platform_visitor_id";

export function useVisitorId() {
  const [platformVisitorId, setPlatformVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const platformVisitorIdFromQuery = searchParams.get("platformVisitorId");

    if (platformVisitorIdFromQuery) {
      localStorage.setItem(PLATFORM_VISITOR_ID_STORAGE_KEY, platformVisitorIdFromQuery);
      setPlatformVisitorId(platformVisitorIdFromQuery);
      setLoading(false);
      return;
    }

    const platformVisitorIdFromStorage = localStorage.getItem(PLATFORM_VISITOR_ID_STORAGE_KEY);

    if (platformVisitorIdFromStorage) {
      setPlatformVisitorId(platformVisitorIdFromStorage);
      setLoading(false);
      return;
    }

    const generatedPlatformVisitorId = uuidv4();
    localStorage.setItem(PLATFORM_VISITOR_ID_STORAGE_KEY, generatedPlatformVisitorId);
    setPlatformVisitorId(generatedPlatformVisitorId);
    setLoading(false);
  }, []);

  return { platformVisitorId, loading };
}
