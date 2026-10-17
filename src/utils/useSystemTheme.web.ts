import { useSyncExternalStore } from "react";

function subscribe(changed: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  if (query.addEventListener) {
    query.addEventListener("change", changed);
    return () => query.removeEventListener("change", changed);
  }
  query.addListener(changed);
  return () => query.removeListener(changed);
}
function snapshot(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}
export function useSystemTheme() {
  return useSyncExternalStore(subscribe, snapshot, () => "light" as const);
}
