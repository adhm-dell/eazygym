"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cn } from "../utils";

export interface ComboboxOption {
  label: string;
  value: string;
  description?: string;
  disabled?: boolean;
}

export interface ComboboxProps {
  label?: string;
  helperText?: string;
  error?: string;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  options: ComboboxOption[];
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}

export function Combobox({
  label,
  helperText,
  error,
  placeholder = "اختر...",
  searchPlaceholder = "بحث...",
  emptyMessage = "لا توجد نتائج",
  options,
  value,
  onChange,
  disabled,
  className,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  const filteredOptions = query.trim()
    ? options.filter(
        (opt) =>
          opt.label.toLowerCase().includes(query.toLowerCase()) ||
          opt.description?.toLowerCase().includes(query.toLowerCase())
      )
    : options;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={cn("w-full space-y-1.5 text-start relative", className)}>
      {label && <label className="block text-sm font-medium text-foreground">{label}</label>}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 transition-colors text-start",
          error && "border-destructive focus-visible:ring-destructive",
          !selectedOption && "text-muted-foreground"
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50 ms-2" />
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-border bg-popover text-popover-foreground shadow-modal p-1 focus:outline-none">
          <div className="flex items-center border-b border-border px-2 pb-1.5 pt-1">
            <Search className="h-4 w-4 shrink-0 opacity-50 me-2" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={searchPlaceholder}
              className="flex h-8 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="text-muted-foreground hover:text-foreground p-0.5"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="pt-1 space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">{emptyMessage}</div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={opt.disabled}
                    onClick={() => {
                      onChange?.(opt.value);
                      setIsOpen(false);
                      setQuery("");
                    }}
                    className={cn(
                      "relative flex w-full cursor-pointer select-none items-center rounded-sm px-2.5 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground text-start disabled:pointer-events-none disabled:opacity-50",
                      isSelected && "bg-accent/70 font-medium text-accent-foreground"
                    )}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="truncate">{opt.label}</div>
                      {opt.description && (
                        <div className="text-xs text-muted-foreground truncate">{opt.description}</div>
                      )}
                    </div>
                    {isSelected && <Check className="h-4 w-4 shrink-0 ms-2 text-primary" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {error ? (
        <p className="text-xs text-destructive font-medium">{error}</p>
      ) : helperText ? (
        <p className="text-xs text-muted-foreground">{helperText}</p>
      ) : null}
    </div>
  );
}
