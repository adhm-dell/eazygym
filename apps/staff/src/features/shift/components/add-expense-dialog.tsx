"use client";

import React, { useState } from "react";
import { Dialog, Button } from "@gym/ui";
import { shiftApi } from "../api";
import { useShift } from "../../../lib/shift-context";
import { toMinor } from "@gym/domain";
import { DollarSign, AlertTriangle, ShieldAlert } from "lucide-react";
import type { Expense } from "@gym/mock-data";

interface AddExpenseDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (newExpense: Expense) => void;
}

const CATEGORIES = [
  "نظافة وضيافة",
  "صيانة وإصلاحات",
  "مطبوعات وأدوات مكتبية",
  "مياه ومشروبات",
  "أخرى",
];

export function AddExpenseDialog({
  isOpen,
  onClose,
  onSuccess,
}: AddExpenseDialogProps) {
  const { isOpen: isShiftOpen, refreshShift, currentUser } = useShift();
  const [category, setCategory] = useState<string>("نظافة وضيافة");
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [paidFromDrawer, setPaidFromDrawer] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(amountStr);
    if (isNaN(val) || val <= 0) {
      setErrorMsg("يرجى إدخال مبلغ صحيح أكبر من الصفر");
      return;
    }

    if (!isShiftOpen) {
      setErrorMsg("لا توجد وردية مفتوحة حالياً، لا يمكن تسجيل مصروف");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const minorAmount = toMinor(val);
      const created = await shiftApi.createExpense(
        {
          category,
          amount: minorAmount,
          description: description.trim() || null,
          paidFromDrawer,
        },
        currentUser?.id
      );

      await refreshShift();
      if (onSuccess) onSuccess(created);
      onClose();
      setAmountStr("");
      setDescription("");
    } catch (err: any) {
      setErrorMsg(err.message || "حدث خطأ أثناء تسجيل المصروف");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل مصروف تشغيلي جديد"
      description="إضافة بند مصروف تشغيلي وربطه بالوردية الحالية"
      maxWidth="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        {!isShiftOpen && (
          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>تنبيه: يتطلب تسجيل المصروفات وجود وردية مفتوحة</span>
          </div>
        )}

        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div>
          <label className="text-[12px] font-bold text-[#14181F] block mb-1">
            تصنيف المصروف:
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-bold focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[12px] font-bold text-[#14181F] block mb-1">
            المبلغ (بالجنيه):
          </label>
          <input
            type="number"
            step="0.5"
            min="0"
            value={amountStr}
            onChange={(e) => setAmountStr(e.target.value)}
            placeholder="0.00"
            className="w-full px-3.5 py-2 bg-white border border-[#E1E5DF] rounded-xl text-[15px] font-mono font-bold text-[#14181F] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            required
            autoFocus
          />
        </div>

        <div>
          <label className="text-[12px] font-bold text-[#14181F] block mb-1">
            البيان والتفاصيل:
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="مثال: شراء صابون ومستلزمات نظافة للمغاسل..."
            className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
          />
        </div>

        <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
          <label className="flex items-center gap-2.5 cursor-pointer text-[13px] font-bold text-[#14181F]">
            <input
              type="checkbox"
              checked={paidFromDrawer}
              onChange={(e) => setPaidFromDrawer(e.target.checked)}
              className="rounded border-[#E1E5DF] text-[#14181F] focus:ring-[#C6F24E]"
            />
            <span>خصم من نقدية الخزينة (درج الوردية)</span>
          </label>
          <p className="text-[11px] text-[#5B6470] mt-1 ms-6">
            عند تفعيله، سيتم خصم هذا المبلغ من الكاش المتوقع تسليمه في نهاية الوردية
          </p>
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E5DF]">
          <Button type="button" variant="outline" onClick={onClose}>
            إلغاء
          </Button>
          <Button
            type="submit"
            isLoading={isSubmitting}
            disabled={!isShiftOpen}
            className="bg-[#14181F] text-white hover:bg-[#262D38] font-bold"
          >
            <DollarSign className="h-4 w-4 me-1.5" />
            تسجيل المصروف
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
