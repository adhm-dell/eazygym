import ar from "../ar.json";
import en from "../en.json";

export { ar, en };
export type TranslationDict = typeof ar;
export type Locale = "ar" | "en";

export function getDictionary(locale: Locale): TranslationDict {
  return locale === "en" ? en : ar;
}

export function translateErrorCode(code: string, locale: Locale = "ar"): string {
  const dict = getDictionary(locale);
  const errors = (dict as any).errors || {};
  return errors[code] || (locale === "ar" ? "حدث خطأ غير متوقع" : "An unexpected error occurred");
}

