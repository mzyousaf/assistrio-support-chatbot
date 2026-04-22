import { useEffect, useState } from "react";

function readPreferredScheme(): "light" | "dark" {
  if (typeof window === "undefined" || !window.matchMedia) return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Returns the user's preferred color scheme from system preference.
 * Initial state matches `matchMedia` immediately so embed/preview first paint matches `backgroundStyle: "auto"`.
 */
export function usePreferredColorScheme(): "light" | "dark" {
  const [preferred, setPreferred] = useState<"light" | "dark">(readPreferredScheme);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) {
      setPreferred("light");
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
