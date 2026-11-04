"use client";

import React, { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { Dialog } from "./dialog";
import { Button } from "./button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  title: string;
  description: string;
  reasonLabel?: string;
  reasonPlaceholder?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "destructive" | "default";
  minReasonLength?: number;
  isLoading?: boolean;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  reasonLabel = "سبب الإجراء (مطلوب للتدقيق والرقابة)",
  reasonPlaceholder = "اكتب سبب هذا الإجراء هنا...",
  confirmText = "تأكيد الإجراء",
  cancelText = "إلغاء",
  variant = "destructive",
  minReasonLength = 3,
  isLoading = false,
}: ConfirmDialogProps) {
  const [reason, setReason] = useState("");
  const isReasonValid = reason.trim().length >= minReasonLength;

  const handleConfirm = () => {
    if (!isReasonValid) return;
    onConfirm(reason.trim());
    setReason("");
  };

  const handleClose = () => {
    setReason("");
    onClose();
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={handleClose}
      title={
        <div className="flex items-center gap-2 text-destructive">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <span>{title}</span>
        </div>
      }
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={handleClose} disabled={isLoading}>
            {cancelText}
          </Button>
          <Button
            variant={variant}
            onClick={handleConfirm}
            disabled={!isReasonValid || isLoading}
            isLoading={isLoading}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="space-y-2 pt-2 text-start">
        <label className="block text-xs font-semibold text-foreground">
          {reasonLabel} <span className="text-destructive">*</span>
        </label>
        <textarea
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={reasonPlaceholder}
          className="w-full rounded-md border border-input bg-background p-2.5 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring text-start transition-colors"
        />
        {reason.length > 0 && !isReasonValid && (
          <p className="text-xs text-destructive">
            يجب كتابة سبب واضح لا يقل عن {minReasonLength} أحرف.
          </p>
        )}
      </div>
    </Dialog>
  );
}
