"use client";

import React, { useState } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "../utils";

export interface DateRangeValue {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
}

export interface DateRangeProps {
  label?: string;
  value?: DateRangeValue;
  onChange?: (val: DateRangeValue) => void;
  className?: string;
}

export function DateRange({
  label,
  value = {
    from: new Date().toISOString().split("T")[0]!,
    to: new Date().toISOString().split("T")[0]!,
  },
  onChange,
  className,
}: DateRangeProps) {
  const [internalValue, setInternalValue] = useState<DateRangeValue>(value);

  const handleFromChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...internalValue, from: e.target.value };
    setInternalValue(next);
    onChange?.(next);
  };

  const handleToChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...internalValue, to: e.target.value };
    setInternalValue(next);
    onChange?.(next);
  };

  const setPreset = (days: number) => {
    const now = new Date();
    const to = now.toISOString().split("T")[0]!;
    const past = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const from = past.toISOString().split("T")[0]!;
    const next = { from, to };
    setInternalValue(next);
    onChange?.(next);
  };

  return (
    <div className={cn("space-y-1.5 text-start", className)}>
      {label && <label className="block text-sm font-medium text-foreground">{label}</label>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex items-center">
          <CalendarIcon className="absolute inset-y-0 start-0 my-auto ms-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={internalValue.from}
            onChange={handleFromChange}
            className="flex h-10 rounded-md border border-input bg-background ps-9 pe-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-start tabular-nums"
          />
        </div>
        <span className="text-muted-foreground text-sm font-medium">إلى</span>
        <div className="relative flex items-center">
          <CalendarIcon className="absolute inset-y-0 start-0 my-auto ms-3 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="date"
            value={internalValue.to}
            onChange={handleToChange}
            className="flex h-10 rounded-md border border-input bg-background ps-9 pe-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-start tabular-nums"
          />
        </div>

        {/* Quick Presets */}
        <div className="flex items-center gap-1 ms-1">
          <button
            type="button"
            onClick={() => setPreset(0)}
            className="px-2 py-1 text-xs rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            اليوم
          </button>
          <button
            type="button"
            onClick={() => setPreset(7)}
            className="px-2 py-1 text-xs rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            7 أيام
          </button>
          <button
            type="button"
            onClick={() => setPreset(30)}
            className="px-2 py-1 text-xs rounded border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            30 يوماً
          </button>
        </div>
      </div>
    </div>
  );
}
