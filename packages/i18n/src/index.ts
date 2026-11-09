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

export function useTranslation(locale: Locale = "ar") {
  const dict = getDictionary(locale);
  const t = (key: string): string => {
    const parts = key.split(".");
    let current: any = dict;
    for (const part of parts) {
      if (current && typeof current === "object" && part in current) {
        current = current[part];
      } else {
        return key;
      }
    }
    return typeof current === "string" ? current : key;
  };
  return { t, locale, dict };
}


