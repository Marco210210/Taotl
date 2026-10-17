import { useLayoutEffect } from "react";
import { usePathname } from "expo-router";
import { useAppSettings } from "@/state/AppSettingsContext";

export function BrowserTheme() {
  const pathname = usePathname();
  const { colors, resolvedTheme, hydrated } = useAppSettings();
  useLayoutEffect(() => {
    if (!hydrated) return;
    const root = document.documentElement;
    const isHome = pathname === "/" && root.dataset.taotlAdmin !== "true";
    const color = String(isHome ? colors.successHero : colors.background);
    root.style.setProperty("--taotl-viewport-background", color);
    root.style.colorScheme = resolvedTheme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", color);
    document.querySelector('meta[name="color-scheme"]')?.setAttribute("content", resolvedTheme);
  }, [colors, resolvedTheme, hydrated, pathname]);
  return null;
}
