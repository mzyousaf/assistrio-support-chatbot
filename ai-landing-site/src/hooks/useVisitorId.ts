"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export function useVisitorId() {
  const [platformVisitorId, setPlatformVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const key = "platform_visitor_id";
      let id = localStorage.getItem(key);
      if (!id) {
        id = uuidv4();
        localStorage.setItem(key, id);
      }
      setPlatformVisitorId(id);
    } catch (err) {
      console.error("Failed to initialize platformVisitorId", err);
      setPlatformVisitorId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { platformVisitorId, loading };
}
