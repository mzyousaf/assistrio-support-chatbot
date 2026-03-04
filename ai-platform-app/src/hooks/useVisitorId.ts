"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

const VISITOR_ID_STORAGE_KEY = "visitor_id";

export function useVisitorId() {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const visitorIdFromQuery = searchParams.get("visitorId");

    if (visitorIdFromQuery) {
      localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorIdFromQuery);
      setVisitorId(visitorIdFromQuery);
      setLoading(false);
      return;
    }

    const visitorIdFromStorage = localStorage.getItem(VISITOR_ID_STORAGE_KEY);

    if (visitorIdFromStorage) {
      setVisitorId(visitorIdFromStorage);
      setLoading(false);
      return;
    }

    const generatedVisitorId = uuidv4();
    localStorage.setItem(VISITOR_ID_STORAGE_KEY, generatedVisitorId);
    setVisitorId(generatedVisitorId);
    setLoading(false);
  }, []);

  return { visitorId, loading };
}
