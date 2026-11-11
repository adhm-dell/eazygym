"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  Calendar,
  Sparkles,
  User,
  Clock,
} from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { useShift } from "../../../lib/shift-context";
import { subscriptionsApi, type SubscriptionItem } from "../api";
import type { Staff } from "@gym/contracts";

interface QuickRenewDialogProps {
  subscription: SubscriptionItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function QuickRenewDialog({
  subscription,
  isOpen,
  onClose,
  onSuccess,
}: QuickRenewDialogProps) {
  const { shift: currentShift, openShiftModal } = useShift();

  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "INSTAPAY" | "WALLET">("CASH");
  const [amountEgp, setAmountEgp] = useState<string>("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [coaches, setCoaches] = useState<Staff[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize form when subscription changes or modal opens
  useEffect(() => {
    if (subscription && isOpen) {
      setAmountEgp((subscription.price / 100).toString());
      setPaymentMethod("CASH");
      setReference("");
      setNotes("");
      setError(null);
      setSelectedCoachId(subscription.currentCoach?.id || subscription.activeCoach?.id || "");

      if (subscription.kind === "PT") {
        subscriptionsApi.listCoaches().then((list) => {
          setCoaches(list);
          if (!selectedCoachId && list[0]) {
            setSelectedCoachId(list[0].id);
          }
        }).catch(() => null);
      }
    }
  }, [subscription, isOpen]);

  // Chaining date logic
  const { isFutureChain, chainStartDateStr } = useMemo(() => {
    if (!subscription) return { isFutureChain: false, chainStartDateStr: "" };
    const end = new Date(subscription.endDate);
    const now = new Date();
    const isFuture = end > now;
    const targetDate = isFuture ? end : now;
    return {
      isFutureChain: isFuture,
      chainStartDateStr: targetDate.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }),
    };
  }, [subscription]);

  if (!isOpen || !subscription) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentShift || currentShift.status !== "OPEN") {
      setError("لا يمكن التجديد: لا توجد وردية مفتوحة حالياً للكاشير. يجب فتح وردية أولاً لتسجيل دفعة التجديد في الدرج والرقابة المالية.");
      return;
    }

    const val = parseFloat(amountEgp || "0");
    if (isNaN(val) || val <= 0) {
      setError("المبلغ المدفوع غير صالح");
      return;
    }

    const piasters = Math.round(val * 100);

    setIsSubmitting(true);
    setError(null);

    try {
      await subscriptionsApi.renewSubscription(subscription.id, {
        coachId: selectedCoachId || undefined,
        payments: [
          {
            method: paymentMethod,
            amount: piasters,
            reference: reference.trim() || null,
          },
        ],
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تجديد الاشتراك");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg my-auto max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-[#E1E5DF] overflow-hidden flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#E1E5DF] bg-[#F2F4F1] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-bold">
              <RotateCcw className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-[#14181F]">
                تجديد الاشتراك السريع
              </h2>
              <p className="text-xs text-[#5B6470]">
                {subscription.plan.name} · {subscription.member.name} (#{subscription.member.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-700 text-lg font-bold p-1 rounded-lg transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Form Container */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Shift Guard Warning */}
            {(!currentShift || currentShift.status !== "OPEN") && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>تنبيه: لا توجد وردية مفتوحة حالياً للكاشير.</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    openShiftModal();
                  }}
                  className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors"
                >
                  فتح وردية الآن
                </button>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Chaining Explanation Banner */}
            <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-800">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  {isFutureChain
                    ? `تجديد مبكر متسلسل يبدأ في ${chainStartDateStr}`
                    : `تجديد فوري يبدأ من اليوم (${chainStartDateStr})`}
                </span>
              </div>
              <p className="text-[11px] text-emerald-700 leading-relaxed">
                {isFutureChain
                  ? "سيبدأ هذا الاشتراك الجديد تلقائياً فور انتهاء الاشتراك الحالي، مما يحافظ على أيام العضو المتبقية كاملة دون أي تداخل أو إهدار."
                  : "سيبدأ الاشتراك الجديد فوراً اليوم ويتم تفعيل صلاحية الدخول."}
              </p>
            </div>

            {/* Member & Plan Details Summary */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-[#F2F4F1] rounded-2xl border border-[#E1E5DF] text-xs">
              <div>
                <span className="text-[#5B6470] block">العضو:</span>
                <span className="font-bold text-[#14181F] block mt-0.5">{subscription.member.name}</span>
                <span className="text-[11px] text-[#5B6470]">{subscription.member.phone}</span>
              </div>
              <div>
                <span className="text-[#5B6470] block">سعر الباقة المقررة:</span>
                <span className="font-black text-sm text-[#14181F] block mt-0.5">
                  {formatMoney(subscription.price)}
                </span>
                <span className="text-[11px] text-emerald-700 font-bold">{subscription.plan.name}</span>
              </div>
            </div>

            {/* Coach selection for PT subscriptions */}
            {subscription.kind === "PT" && coaches.length > 0 && (
              <div>
                <label className="block text-xs font-bold text-[#14181F] mb-1.5">
                  المدرب المعين للتدريب الخاص:
                </label>
                <select
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 border border-[#14181F] rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
                >
                  <option value="">-- احتفظ بنفس المدرب أو اختر مدرباً --</option>
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      كابتن {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Payment Method Selector */}
            <div>
              <label className="block text-xs font-bold text-[#14181F] mb-1.5">طريقة الدفع:</label>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { id: "CASH", label: "نقداً", icon: Banknote },
                  { id: "CARD", label: "فيزا/كارت", icon: CreditCard },
                  { id: "INSTAPAY", label: "إنستاباي", icon: Smartphone },
                  { id: "WALLET", label: "محفظة", icon: Wallet },
                ].map((item) => {
                  const Icon = item.icon;
                  const isSelected = paymentMethod === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPaymentMethod(item.id as any)}
                      className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all flex flex-col items-center gap-1 cursor-pointer ${
                        isSelected
                          ? "border-[#14181F] bg-[#14181F] text-[#C6F24E] shadow-sm"
                          : "border-[#E1E5DF] text-[#5B6470] bg-white hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px]">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Paid Amount */}
            <div>
              <label className="block text-xs font-bold text-[#14181F] mb-1">
                المبلغ المدفوع الآن (ج.م) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.5"
                min="1"
                value={amountEgp}
                onChange={(e) => setAmountEgp(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#14181F] text-sm font-black focus:outline-none focus:ring-2 focus:ring-[#C6F24E] bg-white"
                required
              />
              <p className="text-[11px] text-[#5B6470] mt-1">
                يمكن تحصيل المبلغ بالكامل أو تسجيل دفعة جزئية (وتسجيل الباقي كمديونية تلقائية على العضو).
              </p>
            </div>

            {/* Reference if non-cash */}
            {paymentMethod !== "CASH" && (
              <div>
                <label className="block text-xs font-bold text-[#14181F] mb-1">
                  رقم المرجع / العملية (اختياري)
                </label>
                <input
                  type="text"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="رقم مرجع التحويل أو إيصال الفيزا..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E5DF] text-xs focus:outline-none focus:ring-2 focus:ring-[#C6F24E] bg-white"
                />
              </div>
            )}

            {/* Notes */}
            <div>
              <label className="block text-xs font-bold text-[#14181F] mb-1">
                ملاحظات التجديد (اختياري)
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي ملاحظات خاصة بالتجديد أو العرض..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E1E5DF] text-xs focus:outline-none focus:ring-2 focus:ring-[#C6F24E] bg-white"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 sm:p-5 border-t border-[#E1E5DF] flex items-center justify-end gap-3 bg-white shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-[#E1E5DF] text-xs font-bold text-[#5B6470] hover:bg-gray-50 transition-colors"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !currentShift || currentShift.status !== "OPEN"}
              className="px-6 py-2.5 rounded-xl bg-[#C6F24E] hover:bg-[#b5e03f] disabled:opacity-50 disabled:cursor-not-allowed text-[#14181F] text-xs font-black shadow-sm transition-all flex items-center gap-2 cursor-pointer"
            >
              {isSubmitting ? (
                <span>جاري حفظ التجديد...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 stroke-[2.5]" />
                  <span>تأكيد التجديد وإصدار الفاتورة</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
