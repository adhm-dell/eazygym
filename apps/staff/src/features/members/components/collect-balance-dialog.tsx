"use client";

import React, { useState } from "react";
import { DollarSign, AlertCircle, CheckCircle2, Banknote, Smartphone, CreditCard } from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { membersApi } from "../api";
import { useShift } from "../../../lib/shift-context";
import type { InvoiceDetail, Member } from "@gym/contracts";

interface CollectBalanceDialogProps {
  invoice: InvoiceDetail;
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CollectBalanceDialog({
  invoice,
  member,
  isOpen,
  onClose,
  onSuccess,
}: CollectBalanceDialogProps) {
  const { shift: currentShift, openShiftModal } = useShift();
  const [method, setMethod] = useState<"CASH" | "INSTAPAY" | "CARD">("CASH");
  const [amountEgp, setAmountEgp] = useState<string>((invoice.remainingAmount / 100).toString());
  const [reference, setReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCollect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentShift || currentShift.status !== "OPEN") {
      setError("لا يمكن التحصيل: لا توجد وردية مفتوحة حالياً للكاشير. يجب فتح وردية أولاً لتسجيل أي متحصلات نقدية وربطها بالمستلم والوردية.");
      return;
    }

    const piasters = Math.round(parseFloat(amountEgp || "0") * 100);
    if (isNaN(piasters) || piasters <= 0) {
      setError("المبلغ غير صالح");
      return;
    }
    if (piasters > invoice.remainingAmount) {
      setError(`المبلغ يتجاوز المتبقي المستحق (${formatMoney(invoice.remainingAmount)})`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await membersApi.collectPayment(invoice.id, {
        payments: [
          {
            method,
            amount: piasters,
            reference: reference.trim() || null,
          },
        ],
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تحصيل المتبقي");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md my-auto max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="p-4 sm:p-5 border-b border-emerald-100 bg-emerald-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <DollarSign className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">تحصيل مديونية / دفعة متبقية</h2>
              <p className="text-xs text-gray-500">
                فاتورة رقم #{invoice.number} · {member.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleCollect} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {(!currentShift || currentShift.status !== "OPEN") && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>تنبيه: لا توجد وردية مفتوحة للكاشير.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openShiftModal();
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold"
                >
                  فتح وردية الآن
                </button>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
              <span className="text-xs text-gray-600">المتبقي الإجمالي على الفاتورة:</span>
              <span className="text-lg font-black text-red-600">{formatMoney(invoice.remainingAmount)}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1.5">طريقة الدفع</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod("CASH")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    method === "CASH"
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-800 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Banknote className="h-4 w-4" />
                  <span>نقداً (درج)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("INSTAPAY")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    method === "INSTAPAY"
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-800 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <Smartphone className="h-4 w-4" />
                  <span>إنستاباي</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMethod("CARD")}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 ${
                    method === "CARD"
                      ? "border-emerald-500 bg-emerald-50/50 text-emerald-800 shadow-sm"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <span>فيزا / كارت</span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                المبلغ المحصل (ج.م) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={amountEgp}
                onChange={(e) => setAmountEgp(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 bg-white"
                required
              />
            </div>

            {method !== "CASH" && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  رقم العملية / مرجع التحويل (اختياري)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="رقم مرجع التحويل في إنستاباي أو إيصال الفيزا..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 bg-white"
                />
              </div>
            )}
          </div>

          <div className="p-4 sm:p-5 border-t border-gray-100 flex items-center justify-end gap-3 bg-white shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !currentShift || currentShift.status !== "OPEN"}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد التحصيل الآن</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
