"use client";

import React, { useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, X, User } from "lucide-react";
import { cn } from "../utils";
import { Button } from "./button";

export type ResultType = "success" | "warning" | "danger";

export interface FullScreenResultProps {
  isOpen: boolean;
  onClose: () => void;
  type: ResultType;
  title: string;
  subtitle?: string;
  reason?: string;
  memberName?: string;
  memberCode?: string;
  planName?: string;
  details?: { label: string; value: React.ReactNode }[];
  autoCloseSeconds?: number;
  className?: string;
}

export function FullScreenResult({
  isOpen,
  onClose,
  type,
  title,
  subtitle,
  reason,
  memberName,
  memberCode,
  planName,
  details = [],
  autoCloseSeconds = 5,
  className,
}: FullScreenResultProps) {
  useEffect(() => {
    if (!isOpen || autoCloseSeconds <= 0) return;
    const timer = setTimeout(() => {
      onClose();
    }, autoCloseSeconds * 1000);
    return () => clearTimeout(timer);
  }, [isOpen, autoCloseSeconds, onClose]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        onClose();
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const bgStyles = {
    success: "bg-emerald-950/95 border-emerald-500/40 text-emerald-50",
    warning: "bg-amber-950/95 border-amber-500/40 text-amber-50",
    danger: "bg-rose-950/95 border-rose-500/40 text-rose-50",
  };

  const iconStyles = {
    success: "bg-emerald-500/20 text-emerald-400 ring-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-400 ring-amber-500/30",
    danger: "bg-rose-500/20 text-rose-400 ring-rose-500/30",
  };

  const badgeStyles = {
    success: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30",
    warning: "bg-amber-500/20 text-amber-300 border-amber-500/30",
    danger: "bg-rose-500/20 text-rose-300 border-rose-500/30",
  };

  const icons = {
    success: CheckCircle2,
    warning: AlertTriangle,
    danger: XCircle,
  };

  const Icon = icons[type];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-md bg-black/80 animate-in fade-in-0 duration-200">
      <div
        className={cn(
          "relative flex flex-col items-center justify-center w-full max-w-xl rounded-2xl border-2 p-8 text-center shadow-2xl transition-all animate-in zoom-in-95 duration-200",
          bgStyles[type],
          className
        )}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 end-4 rounded-full p-2 text-white/70 hover:text-white hover:bg-white/10 transition-colors"
        >
          <X className="h-6 w-6" />
          <span className="sr-only">إغلاق</span>
        </button>

        {/* Big Icon */}
        <div
          className={cn(
            "flex h-24 w-24 items-center justify-center rounded-full ring-8 mb-4",
            iconStyles[type]
          )}
        >
          <Icon className="h-14 w-14" />
        </div>

        {/* Title & Subtitle */}
        <h2 className="text-3xl font-extrabold tracking-tight mb-1">{title}</h2>
        {subtitle && <p className="text-base text-white/80 font-medium mb-3">{subtitle}</p>}

        {/* Reason Pill */}
        {reason && (
          <div
            className={cn(
              "inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold border mb-6",
              badgeStyles[type]
            )}
          >
            {reason}
          </div>
        )}

        {/* Member Info Card */}
        {(memberName || memberCode) && (
          <div className="w-full bg-black/30 rounded-xl p-4 mb-6 border border-white/10 flex items-center justify-between text-start">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-full bg-white/10 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-white/70" />
              </div>
              <div>
                <h4 className="font-bold text-lg text-white">{memberName}</h4>
                {memberCode && (
                  <p className="text-xs font-mono text-white/70">كود: {memberCode}</p>
                )}
              </div>
            </div>
            {planName && (
              <span className="text-xs font-semibold px-3 py-1 rounded-md bg-white/10 text-white border border-white/20">
                {planName}
              </span>
            )}
          </div>
        )}

        {/* Details Grid */}
        {details.length > 0 && (
          <div className="w-full grid grid-cols-2 gap-3 mb-6 text-start">
            {details.map((d, i) => (
              <div key={i} className="bg-black/20 p-3 rounded-lg border border-white/5">
                <p className="text-xs text-white/60">{d.label}</p>
                <p className="text-sm font-semibold text-white mt-0.5">{d.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <Button
          size="lg"
          variant="outline"
          onClick={onClose}
          className="border-white/30 text-white hover:bg-white/20 px-8 font-bold"
        >
          متابعة ({autoCloseSeconds} ث)
        </Button>
      </div>
    </div>
  );
}
