import { useSearchParams } from "react-router-dom";

/**
 * Keeps the active tab in the page address so a refresh, a re-render or coming
 * back to the browser tab lands on the same screen instead of the default one.
 */
export function useTabParam(tabs: readonly string[], fallback?: string, key = "tab") {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = raw && tabs.includes(raw) ? raw : (fallback ?? tabs[0]);

  const setValue = (next: string) => {
    const search = new URLSearchParams(params);
    search.set(key, next);
    setParams(search, { replace: true });
  };

  return [value, setValue] as const;
}
