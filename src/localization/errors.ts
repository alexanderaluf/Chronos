import { i18n } from "./i18n";

/**
 * A readable, translated message for any error. Data-layer errors carry a
 * stable `code` (e.g. "shift/overlap") that maps to `errors.<code>`.
 */
export function errorMessage(error: unknown): string {
  if (error && typeof error === "object" && "code" in error && typeof error.code === "string") {
    const key = `errors.${error.code}`;
    if (i18n.exists(key)) return i18n.t(key as never);
  }
  if (error instanceof Error) return error.message;
  return String(error);
}
