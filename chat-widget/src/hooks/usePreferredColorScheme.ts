import { useEffect, useState } from "react";

/**
 * Returns the user's preferred color scheme from system preference.
 */
export function usePreferredColorScheme(): "light" | "dark" {
  const [preferred, setPreferred] = useState<"light" | "dark">("dark");

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      setPreferred("dark");
      return;
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setPreferred(mq.matches ? "dark" : "light");
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return preferred;
}
