"use client";

import React, { useState } from "react";
import { RotateCcw } from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { plansApi } from "../api";
import type { Plan } from "@gym/contracts";

interface RestorePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (planId: string) => void;
  plan: Plan | null;
}

export function RestorePlanDialog({
  isOpen,
  onClose,
  onSuccess,
  plan,
}: RestorePlanDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return null;

  const handleRestore = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await plansApi.restorePlan(plan.id);
      onSuccess(plan.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء استعادة الباقة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-emerald-700">
          <RotateCcw className="h-5 w-5 shrink-0" />
          <span>استعادة الباقة: {plan.name}</span>
        </div>
      }
      description="إعادة تفعيل الباقة وإظهارها في شاشة البيع"
      footer={
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            variant="lime"
            onClick={handleRestore}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="font-bold"
          >
            تأكيد الاستعادة
          </Button>
        </div>
      }
    >
      <div className="space-y-3 pt-2 text-start text-xs leading-relaxed text-[#5B6470]" dir="rtl">
        {error && (
          <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-950 space-y-2">
          <p className="font-bold text-sm text-emerald-950">هل تريد إعادة تفعيل هذه الباقة؟</p>
          <p className="text-xs text-emerald-800">
            استعادة الباقة ستجعل حالتها <b>نشطة</b> مجدداً، وستظهر فوراً في شاشة البيع (POS)
            لتمكين الاستقبال من بيعها للمشتركين.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
