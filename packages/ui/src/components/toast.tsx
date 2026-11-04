"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import { cn } from "../utils";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  title?: string;
  message?: string;
  description?: string;
  type?: ToastType;
  variant?: ToastType;
  duration?: number;
}

export type ToastOptions = Omit<ToastItem, "id">;

interface ToastContextType {
  toasts: ToastItem[];
  toast: (options: ToastOptions) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ title, message, description, type, variant, duration = 4000 }: ToastOptions) => {
      const id = Math.random().toString(36).substring(2, 9);
      const resolvedMessage = message || description || "";
      const resolvedType: ToastType = type || variant || "info";

      setToasts((prev) => [
        ...prev,
        {
          id,
          title,
          message: resolvedMessage,
          description: resolvedMessage,
          type: resolvedType,
          variant: resolvedType,
          duration,
        },
      ]);

      if (duration > 0) {
        setTimeout(() => {
          dismiss(id);
        }, duration);
      }
    },
    [dismiss]
  );

  const success = useCallback((msg: string, title?: string) => toast({ message: msg, title, type: "success" }), [toast]);
  const error = useCallback((msg: string, title?: string) => toast({ message: msg, title, type: "error" }), [toast]);
  const warning = useCallback((msg: string, title?: string) => toast({ message: msg, title, type: "warning" }), [toast]);
  const info = useCallback((msg: string, title?: string) => toast({ message: msg, title, type: "info" }), [toast]);

  return (
    <ToastContext.Provider value={{ toasts, toast, success, error, warning, info, dismiss }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const icons = {
    success: CheckCircle2,
    error: AlertCircle,
    warning: AlertTriangle,
    info: Info,
  };

  const borderStyles = {
    success: "border-success/40 text-success bg-card",
    error: "border-destructive/40 text-destructive bg-card",
    warning: "border-warning/40 text-warning bg-card",
    info: "border-info/40 text-info bg-card",
  };

  return (
    <div className="fixed bottom-4 end-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none p-4">
      {toasts.map((t) => {
        const itemType = t.type || t.variant || "info";
        const Icon = icons[itemType];
        const displayMessage = t.message || t.description;

        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-4 shadow-modal transition-all animate-in slide-in-from-bottom-5 duration-200 text-start",
              borderStyles[itemType]
            )}
          >
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              {t.title && <h5 className="font-semibold text-foreground text-sm">{t.title}</h5>}
              {displayMessage && <p className="text-xs text-muted-foreground mt-0.5">{displayMessage}</p>}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              className="text-muted-foreground hover:text-foreground p-1 shrink-0 -mt-1 -me-1 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
