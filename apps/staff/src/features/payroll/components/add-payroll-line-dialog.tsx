"use client";

import React, { useState } from "react";
import {
  Dialog,
  Button,
  useToast,
} from "@gym/ui";
import { PlusCircle } from "lucide-react";
import { addPayrollLine } from "../api";

interface AddPayrollLineDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  runId: string;
  staffList: Array<{ staffId: string; staff: { name: string; role: string } }>;
  onAdded?: () => void;
}

export function AddPayrollLineDialog({
  open,
  onOpenChange,
  runId,
  staffList,
  onAdded,
}: AddPayrollLineDialogProps) {
  const { toast } = useToast();
  const [selectedStaffId, setSelectedStaffId] = useState<string>(staffList[0]?.staffId || "");
  const [kind, setKind] = useState<"BONUS" | "DEDUCTION">("BONUS");
  const [amount, setAmount] = useState<number>(200);
  const [description, setDescription] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      toast({ title: "تنبيه", description: "يرجى اختيار الموظف", variant: "error" });
      return;
    }
    if (amount <= 0) {
      toast({ title: "تنبيه", description: "المبلغ يجب أن يكون أكبر من 0", variant: "error" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "تنبيه", description: "يرجى كتابة سبب المكافأة أو الخصم", variant: "error" });
      return;
    }

    setSubmitting(true);
    try {
      await addPayrollLine(runId, {
        staffId: selectedStaffId,
        kind,
        amount,
        description: description.trim(),
      });
      toast({
        title: "تمت الإضافة",
        description: `تمت إضافة ${kind === "BONUS" ? "المكافأة" : "الخصم"} بنجاح إلى مسودة الكشف`,
      });
      onAdded?.();
      onOpenChange(false);
      setDescription("");
      setAmount(200);
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      maxWidth="md"
      className="bg-white text-[#14181F] rounded-2xl p-6"
      title={
        <div className="flex items-center gap-2 text-lg font-bold">
          <PlusCircle className="h-5 w-5 text-[#14181F]" />
          <span>إضافة بند يدوي (مكافأة / خصم)</span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 py-3" dir="rtl">
        <div>
          <label className="text-xs font-bold text-[#5B6470] mb-1.5 block">الموظف:</label>
          <select
            value={selectedStaffId}
            onChange={(e) => setSelectedStaffId(e.target.value)}
            className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-2 text-sm font-semibold text-[#14181F] focus:outline-none"
          >
            {staffList.map((s) => (
              <option key={s.staffId} value={s.staffId}>
                {s.staff.name} ({s.staff.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold text-[#5B6470] mb-1.5 block">نوع البند:</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setKind("BONUS")}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                kind === "BONUS"
                  ? "bg-[#C6F24E] border-[#C6F24E] text-[#14181F]"
                  : "bg-[#F2F4F1] border-[#E1E5DF] text-[#5B6470]"
              }`}
            >
              مكافأة (+ BONUS)
            </button>
            <button
              type="button"
              onClick={() => setKind("DEDUCTION")}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer border ${
                kind === "DEDUCTION"
                  ? "bg-[#FDF2F2] border-[#F8B4B4] text-[#B3261E]"
                  : "bg-[#F2F4F1] border-[#E1E5DF] text-[#5B6470]"
              }`}
            >
              خصم (- DEDUCTION)
            </button>
          </div>
        </div>

        <div>
          <label className="text-xs font-bold text-[#5B6470] mb-1.5 block">المبلغ (ج.م):</label>
          <input
            type="number"
            min={1}
            step={10}
            value={amount}
            onChange={(e) => setAmount(Math.max(1, parseFloat(e.target.value) || 0))}
            className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-2 text-sm font-bold text-[#14181F]"
            required
          />
        </div>

        <div>
          <label className="text-xs font-bold text-[#5B6470] mb-1.5 block">الوصف والسبب:</label>
          <input
            type="text"
            placeholder="مثال: حافز تميز في المبيعات / تأخير عن موعد الوردية"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-2 text-sm text-[#14181F]"
            required
          />
        </div>

        <div className="flex items-center justify-between gap-3 pt-3 border-t border-[#E1E5DF]">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-xl font-bold border-[#E1E5DF]"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="lime"
            disabled={submitting}
            className="rounded-xl font-bold"
          >
            {submitting ? "جاري الإضافة..." : "إضافة البند"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
