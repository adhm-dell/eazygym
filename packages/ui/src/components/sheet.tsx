"use client";

import React, { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../utils";

export interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  side?: "start" | "end";
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Sheet({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  side = "end",
  size = "md",
  className,
}: SheetProps) {
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

  const sizeStyles = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
  };

  const sideStyles = {
    start: "start-0 border-e",
    end: "end-0 border-s",
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Sheet Content */}
      <div
        className={cn(
          "fixed inset-y-0 z-50 flex h-full w-full flex-col bg-card p-6 text-card-foreground shadow-modal border-border transition-all duration-300 text-start overflow-y-auto",
          sideStyles[side],
          sizeStyles[size],
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

        <div className="flex-1 py-2">{children}</div>

        {footer && (
          <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end sm:gap-2 pt-4 border-t border-border">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
