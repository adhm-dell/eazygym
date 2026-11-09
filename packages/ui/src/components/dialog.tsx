"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../utils";

export interface DialogProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl";
  className?: string;
}

export function Dialog({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  maxWidth = "md",
  className,
}: DialogProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full max-h-[90vh] flex flex-col rounded-2xl border border-border bg-card p-5 sm:p-6 text-card-foreground shadow-modal transition-all animate-in fade-in-0 zoom-in-95 duration-150 text-start overflow-hidden",
          maxWidthStyles[maxWidth],
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 rounded-lg p-1.5 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none z-10"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">إغلاق</span>
        </button>

        {(title || description) && (
          <div className="mb-4 space-y-1.5 pe-8 shrink-0">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        <div className="py-2 flex-1 min-h-0 overflow-y-auto pe-1">{children}</div>

        {footer && (
          <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2.5 pt-3 border-t border-border shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
