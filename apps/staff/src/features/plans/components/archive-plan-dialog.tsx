"use client";

import React, { useState } from "react";
import { Archive } from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { plansApi } from "../api";
import type { Plan } from "@gym/contracts";

interface ArchivePlanDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (planId: string) => void;
  plan: Plan | null;
}

export function ArchivePlanDialog({
  isOpen,
  onClose,
  onSuccess,
  plan,
}: ArchivePlanDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!plan) return null;

  const handleArchive = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      await plansApi.archivePlan(plan.id);
      onSuccess(plan.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء أرشفة الباقة.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-amber-700">
          <Archive className="h-5 w-5 shrink-0" />
          <span>أرشفة الباقة: {plan.name}</span>
        </div>
      }
      description="تأكيد إخفاء الباقة من شاشة البيع"
      footer={
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleArchive}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="font-bold"
          >
            تأكيد الأرشفة
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

        <div className="p-3.5 bg-amber-50/80 border border-amber-200 rounded-xl text-amber-900 space-y-2">
          <p className="font-bold text-sm text-amber-950">هل أنت متأكد من أرشفة هذه الباقة؟</p>
          <ul className="list-disc list-inside space-y-1 text-xs">
            <li>
              <b>لن يتم حذف الباقة:</b> تظل جميع الاشتراكات المباعة مسبقاً تعمل بنفس أسعارها
              وشروطها دون أي تأثير.
            </li>
            <li>
              <b>إخفاء من شاشة البيع:</b> لن تظهر هذه الباقة بعد الآن لموظفي الاستقبال والكاشير
              في شاشة الـ POS.
            </li>
            <li>
              <b>قابلة للاستعادة:</b> يمكنك كمسؤول نظام إعادة تفعيل واستعادة هذه الباقة في أي
              وقت لاحقاً.
            </li>
          </ul>
        </div>
      </div>
    </Dialog>
  );
}
