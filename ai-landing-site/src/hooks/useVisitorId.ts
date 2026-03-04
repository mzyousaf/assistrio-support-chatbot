"use client";

import { useEffect, useState } from "react";
import { v4 as uuidv4 } from "uuid";

export function useVisitorId() {
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const key = "visitor_id";
      let id = localStorage.getItem(key);
      if (!id) {
        id = uuidv4();
        localStorage.setItem(key, id);
      }
      setVisitorId(id);
    } catch (err) {
      console.error("Failed to initialize visitorId", err);
      setVisitorId(null);
    } finally {
      setLoading(false);
    }
  }, []);

  return { visitorId, loading };
}
