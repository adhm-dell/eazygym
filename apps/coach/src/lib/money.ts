import { fromMinor, type Minor } from "@gym/domain";

export function formatMoney(amountPiasters: Minor, locale: "ar" | "en" = "ar"): string {
  const egp = fromMinor(amountPiasters);
  const parts = Math.abs(egp).toFixed(2).split(".");
  const integerPart = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const formatted = `${integerPart}.${parts[1]}`;
  const prefix = egp < 0 ? "-" : "";
  const currency = locale === "ar" ? "ج.م" : "EGP";
  return `${prefix}${formatted} ${currency}`;
}

