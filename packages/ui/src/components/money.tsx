"use client";

import React from "react";
import { cn } from "../utils";
import { toMinor, fromMinor, type Minor } from "@gym/domain";

export interface MoneyProps {
  /** Amount in integer piasters (minor units) */
  amount: Minor;
  currency?: "EGP" | "ج.م";
  locale?: "ar" | "en";
  className?: string;
  showSign?: boolean;
}

export function formatMoney(
  amount: Minor,
  locale: "ar" | "en" = "ar",
  currencySymbol?: string
): string {
  const pounds = fromMinor(amount);
  const formattedNumber = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(pounds));

  const symbol = currencySymbol || (locale === "ar" ? "ج.م" : "EGP");
  const sign = amount < 0 ? "-" : "";

  return locale === "ar"
    ? `${sign}${formattedNumber} ${symbol}`
    : `${sign}${symbol} ${formattedNumber}`;
}

export function Money({
  amount,
  currency = "ج.م",
  locale = "ar",
  className,
  showSign = false,
}: MoneyProps) {
  const isPositive = amount > 0;
  const isNegative = amount < 0;
  const signPrefix = showSign && isPositive ? "+" : "";

  const formatted = formatMoney(amount, locale, currency);

  return (
    <span
      dir="ltr"
      className={cn(
        "font-semibold tabular-nums inline-flex items-baseline gap-1 select-none",
        isNegative && "text-destructive",
        showSign && isPositive && "text-success",
        className
      )}
    >
      {signPrefix}
      {formatted}
    </span>
  );
}

export interface MoneyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> {
  /** Value in integer piasters (minor units) */
  value?: Minor;
  /** Callback returns new amount in integer piasters */
  onChange?: (value: Minor) => void;
  label?: string;
  helperText?: string;
  error?: string;
  currency?: string;
}

export const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ value = 0, onChange, label, helperText, error, currency = "ج.م", className, disabled, ...props }, ref) => {
    const [inputValue, setInputValue] = React.useState<string>(() => {
      if (value === 0) return "";
      return (value / 100).toString();
    });

    React.useEffect(() => {
      const currentPiasters = Math.round(Number(inputValue || 0) * 100);
      if (value !== currentPiasters) {
        setInputValue(value === 0 ? "" : (value / 100).toString());
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      // Allow only numbers and optional single decimal point
      if (raw !== "" && !/^\d*\.?\d{0,2}$/.test(raw)) {
        return;
      }
      setInputValue(raw);
      const parsedPiasters = toMinor(raw || 0);
      onChange?.(parsedPiasters);
    };

    return (
      <div className="w-full space-y-1.5 text-start">
        {label && <label className="block text-sm font-medium text-foreground">{label}</label>}
        <div className="relative flex items-center">
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            disabled={disabled}
            value={inputValue}
            onChange={handleChange}
            placeholder="0.00"
            dir="ltr"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background ps-3 pe-14 py-2 text-sm tabular-nums ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors",
              error && "border-destructive focus-visible:ring-destructive",
              className
            )}
            {...props}
          />
          <div className="absolute inset-y-0 end-0 flex items-center pe-3 pointer-events-none text-xs font-semibold text-muted-foreground select-none">
            {currency}
          </div>
        </div>
        {error ? (
          <p className="text-xs text-destructive font-medium">{error}</p>
        ) : helperText ? (
          <p className="text-xs text-muted-foreground">{helperText}</p>
        ) : null}
      </div>
    );
  }
);
MoneyInput.displayName = "MoneyInput";
