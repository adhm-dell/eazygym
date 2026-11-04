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
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
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
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Modal Dialog Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative w-full rounded-lg border border-border bg-card p-6 text-card-foreground shadow-modal transition-all animate-in fade-in-0 zoom-in-95 duration-150 text-start",
          maxWidthStyles[maxWidth],
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 rounded-sm p-1 text-muted-foreground opacity-70 transition-opacity hover:opacity-100 hover:bg-muted focus:outline-none"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">إغلاق</span>
        </button>

        {(title || description) && (
          <div className="mb-4 space-y-1.5 pe-6">
            {title && <h2 className="text-lg font-semibold tracking-tight">{title}</h2>}
            {description && (
              <p className="text-sm text-muted-foreground">{description}</p>
            )}
          </div>
        )}

        <div className="py-2">{children}</div>

        {footer && (
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-2 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
