"use client";

import React, { useState, useEffect } from "react";
import { Dialog, Button } from "@gym/ui";
import { useShift } from "../../../lib/shift-context";
import { shiftApi } from "../api";
import { formatMoney } from "../../../lib/money";
import { toMinor, shiftVariance } from "@gym/domain";
import {
  AlertTriangle,
  CheckCircle,
  Coins,
  Info,
} from "lucide-react";
import type { Shift, ShiftReport } from "@gym/contracts";

interface CloseShiftDialogProps {
  isOpen: boolean;
  onClose: () => void;
  shiftId?: string;
  onSuccess?: (closedShift: Shift, report: ShiftReport) => void;
}

export function CloseShiftDialog({
  isOpen,
  onClose,
  shiftId,
  onSuccess,
}: CloseShiftDialogProps) {
  const { shift: currentShift, refreshShift, currentUser } = useShift();
  const targetShiftId = shiftId || currentShift?.id;

  const [isLoadingReport, setIsLoadingReport] = useState(false);
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [countedInput, setCountedInput] = useState("");
  const [note, setNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Load shift report whenever dialog opens
  useEffect(() => {
    if (!isOpen || !targetShiftId) return;

    let mounted = true;
    setIsLoadingReport(true);
    setErrorMsg(null);

    shiftApi
      .getShiftReport(targetShiftId)
      .then((rep) => {
        if (mounted) {
          setReport(rep);
          // Prefill counted with expected for quick audit
          const inEgp = (rep.expectedCash / 100).toFixed(2);
          setCountedInput(inEgp);
        }
      })
      .catch((err) => {
        if (mounted) setErrorMsg(err.message || "تعذر جلب تقرير الوردية");
      })
      .finally(() => {
        if (mounted) setIsLoadingReport(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, targetShiftId]);

  if (!isOpen) return null;

  const expectedMinor = report?.expectedCash ?? 0;
  const countedMinor = toMinor(parseFloat(countedInput) || 0);
  const varianceMinor = shiftVariance(expectedMinor, countedMinor);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetShiftId) return;

    const countedVal = parseFloat(countedInput);
    if (isNaN(countedVal) || countedVal < 0) {
      setErrorMsg("يرجى إدخال مبلغ صحيح للنقدية الفعلية");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const closed = await shiftApi.closeShift(
        targetShiftId,
        countedMinor,
        note.trim() || undefined,
        currentUser?.id,
        currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN"
      );

      await refreshShift();
      if (report && onSuccess) {
        onSuccess(closed, report);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "فشل إقفال الوردية");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="إقفال الوردية وجرد النقدية بالدرج"
      maxWidth="md"
    >
      {isLoadingReport ? (
        <div className="py-12 text-center text-[#5B6470] font-bold text-[14px]">
          جاري حساب مبيعات ومصروفات الوردية...
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Expected Cash KPI summary */}
          <div className="p-4 rounded-2xl bg-[#F2F4F1] border border-[#E1E5DF] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[13px] font-bold text-[#5B6470]">
                الكاش المتوقع بالدرج (العهدة + المبيعات - المصروفات):
              </span>
              <span className="text-[18px] font-mono font-black text-[#14181F]">
                {formatMoney(expectedMinor)}
              </span>
            </div>

            <div className="text-[11px] text-[#5B6470] grid grid-cols-2 gap-1.5 pt-1 border-t border-[#E1E5DF]">
              <div>العهدة الافتتاحية: {formatMoney(report?.openingCash || 0)}</div>
              <div>المبيعات النقدية: +{formatMoney(report?.cashPayments || 0)}</div>
              <div>سندات قبض: +{formatMoney(report?.cashReceiptVouchers || 0)}</div>
              <div>مصروفات الخزينة: -{formatMoney(report?.expensesFromDrawer || 0)}</div>
              <div>سندات صرف: -{formatMoney(report?.cashDisbursementVouchers || 0)}</div>
            </div>
          </div>

          {/* Electronic non-drawer note */}
          {(report?.instapayPayments || 0) + (report?.cardPayments || 0) > 0 && (
            <div className="p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-[11px] flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>مبيعات إلكترونية (إنستاباي وفيزا):</span>
              </span>
              <span className="font-mono font-bold">
                {formatMoney(
                  (report?.instapayPayments || 0) + (report?.cardPayments || 0)
                )}
                {" · "}
                <span className="opacity-75 font-normal">لا تدخل الدرج</span>
              </span>
            </div>
          )}

          {/* Counted Cash Input */}
          <div>
            <label className="text-[12px] font-bold text-[#14181F] block mb-1">
              النقدية الفعلية بعد الجرد (بالجنيه):
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.5"
                min="0"
                value={countedInput}
                onChange={(e) => setCountedInput(e.target.value)}
                placeholder="0.00"
                className="w-full px-3.5 py-2.5 bg-white border border-[#E1E5DF] rounded-xl text-[16px] font-mono font-bold text-[#14181F] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
                required
                autoFocus
              />
            </div>
            <p className="text-[11px] text-[#5B6470] mt-1">
              قم بعد النقود الموجودة في الدرج فعلياً وسجل الإجمالي هنا
            </p>
          </div>

          {/* Real-time Variance Badge */}
          <div
            className={`p-3.5 rounded-xl text-[13px] font-bold flex items-center justify-between transition-colors ${
              varianceMinor < 0
                ? "bg-red-100 text-red-900 border border-red-300"
                : varianceMinor > 0
                ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                : "bg-emerald-50 text-emerald-800 border border-emerald-200"
            }`}
          >
            <div className="flex items-center gap-2">
              {varianceMinor < 0 ? (
                <AlertTriangle className="h-4 w-4 text-red-600" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-600" />
              )}
              <span>
                {varianceMinor < 0
                  ? "عجز بالخزينة (Shortage):"
                  : varianceMinor > 0
                  ? "زيادة بالخزينة (Surplus):"
                  : "مطابقة تامة للخزينة:"}
              </span>
            </div>
            <span className="font-mono text-[15px]">
              {varianceMinor > 0 && "+"}
              {formatMoney(varianceMinor)}
            </span>
          </div>

          {/* Handover Note */}
          <div>
            <label className="text-[12px] font-bold text-[#14181F] block mb-1">
              ملاحظات الإقفال والتسليم:
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="مثال: تم تسليم الكاش للوردية المسائية / تم توريد العهدة للمدير..."
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            />
          </div>

          {/* Dialog Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E5DF]">
            <Button type="button" variant="outline" onClick={onClose}>
              إلغاء
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] font-bold"
            >
              <Coins className="h-4 w-4 me-1.5" />
              تأكيد إقفال الوردية وتجميد الأرصدة
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  );
}
