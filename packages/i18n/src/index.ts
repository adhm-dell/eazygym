import ar from "../ar.json";
import en from "../en.json";

export { ar, en };
export type TranslationDict = typeof ar;
export type Locale = "ar" | "en";

export function getDictionary(locale: Locale): TranslationDict {
  return locale === "en" ? en : ar;
}

