import { Platform } from "react-native";

type ErrorContextValue = string | number | boolean | null | undefined;

const recentReports = new Map<string, number>();
const DEDUPLICATION_WINDOW_MS = 30_000;
let globalHandlerInstalled = false;

interface ErrorUtilsLike {
  getGlobalHandler?: () => (error: Error, isFatal?: boolean) => void;
  setGlobalHandler: (handler: (error: Error, isFatal?: boolean) => void) => void;
}

function redact(value: string, maxLength: number): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, "Bearer [redacted]")
    .replace(/(password|token|secret|app[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .slice(0, maxLength);
}

function normalizeError(error: unknown): { message: string; stack: string | null; name: string } {
  if (error instanceof Error) {
    return {
      name: redact(error.name || "Error", 80),
      message: redact(error.message || "Errore senza messaggio", 1_000),
      stack: error.stack ? redact(error.stack, 6_000) : null,
    };
  }
  return { name: "Error", message: redact(String(error), 1_000), stack: null };
}

export function reportError(
  source: string,
  error: unknown,
  context: Record<string, ErrorContextValue> = {},
): void {
  const endpoint = process.env.EXPO_PUBLIC_ERROR_REPORT_URL?.trim();
  const monitorKey = process.env.EXPO_PUBLIC_APP_KEY?.trim();
  if (!endpoint || !monitorKey) return;

  const normalized = normalizeError(error);
  const fingerprint = `${source}|${normalized.name}|${normalized.message}`;
  const now = Date.now();
  const previousReport = recentReports.get(fingerprint) ?? 0;
  if (now - previousReport < DEDUPLICATION_WINDOW_MS) return;
  recentReports.set(fingerprint, now);

  const safeContext = Object.fromEntries(
    Object.entries(context)
      .filter(([, value]) => value !== undefined)
      .slice(0, 20)
      .map(([key, value]) => [redact(key, 80), typeof value === "string" ? redact(value, 1_000) : value]),
  );

  void fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-Monitor-Key": monitorKey,
    },
    body: JSON.stringify({
      version: 1,
      occurredAt: new Date(now).toISOString(),
      source: redact(source, 120),
      platform: Platform.OS,
      error: normalized,
      context: safeContext,
    }),
  }).catch(() => {
    // Il monitor non deve mai generare un secondo errore o bloccare l'app.
  });
}

export function installGlobalErrorReporting(): void {
  if (globalHandlerInstalled) return;
  const errorUtils = (globalThis as typeof globalThis & { ErrorUtils?: ErrorUtilsLike }).ErrorUtils;
  if (!errorUtils?.setGlobalHandler) return;
  const previousHandler = errorUtils.getGlobalHandler?.();
  errorUtils.setGlobalHandler((error, isFatal) => {
    reportError("javascript.global", error, { isFatal: !!isFatal });
    previousHandler?.(error, isFatal);
  });
  globalHandlerInstalled = true;
}
