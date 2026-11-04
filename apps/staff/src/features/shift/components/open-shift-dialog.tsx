"use client";

import React, { useState } from "react";
import { Dialog, Button, Input } from "@gym/ui";
import { useShift } from "../../../lib/shift-context";
import { Lock, DollarSign } from "lucide-react";

export function OpenShiftDialog() {
  const { isShiftModalOpen, closeShiftModal, openShift } = useShift();
  const [openingCashInput, setOpeningCashInput] = useState("500.00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(openingCashInput);
    if (isNaN(val) || val < 0) return;
    setIsSubmitting(true);
    try {
      const piasters = Math.round(val * 100);
      await openShift(piasters);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isShiftModalOpen}
      onClose={closeShiftModal}
      title="فتح وردية استقبال جديدة"
      description="يرجى إدخال مبلغ العهدة النقدية الافتتاحية في درج الكاش لبدء الوردية"
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2">
        <div className="p-3.5 rounded-xl bg-[#FFF1D6] text-[#8A5A00] text-xs font-semibold flex items-center gap-2">
          <Lock className="h-4 w-4 shrink-0" />
          <span>لا يمكن إجراء عمليات بيع أو تحصيل نقدي بدون فتح الوردية وتوثيق العهدة</span>
        </div>

        <Input
          label="الكاش الافتتاحي (عهدة الخزينة بالجنيه)"
          type="number"
          step="0.5"
          min="0"
          value={openingCashInput}
          onChange={(e) => setOpeningCashInput(e.target.value)}
          startIcon={<DollarSign className="h-4 w-4 text-[#5B6470]" />}
          helperText="المبلغ النقدي الفعلي الموجود في الدرج قبل بدء الاستقبال"
          required
          autoFocus
        />

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E5DF]">
          <Button type="button" variant="outline" onClick={closeShiftModal}>
            إلغاء
          </Button>
          <Button type="submit" variant="lime" isLoading={isSubmitting}>
            فتح الوردية وتأكيد العهدة
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

