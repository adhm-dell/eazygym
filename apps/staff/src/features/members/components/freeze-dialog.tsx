"use client";

import React, { useState, useMemo } from "react";
import { Snowflake, AlertCircle, CheckCircle2 } from "lucide-react";
import { canFreeze, type FreezeState, type FreezeDenial } from "@gym/domain";
import { membersApi } from "../api";
import type { Subscription, Member } from "@gym/contracts";

interface FreezeDialogProps {
  subscription: Subscription;
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: Subscription) => void;
}

const DENIAL_MESSAGES: Record<FreezeDenial, string> = {
  FREEZE_NOT_ALLOWED: "التجميد غير متاح لهذه الباقة وفقاً للائحة النادي",
  ALREADY_FROZEN: "هذا الاشتراك مجمد بالفعل حالياً",
  PAYMENT_OVERDUE: "لا يمكن تجميد الاشتراك: توجد مديونية متأخرة على العضو يجب سدادها أولاً",
  NOT_ACTIVE: "لا يمكن تجميد اشتراك غير نشط",
  COUNT_EXHAUSTED: "تم استنفاد جميع مرات التجميد المسموح بها لهذا الاشتراك",
  DAYS_EXHAUSTED: "تم استنفاد إجمالي عدد أيام التجميد المسموح بها",
  REQUEST_EXCEEDS_REMAINING: "عدد الأيام المطلوبة يتجاوز رصيد أيام التجميد المتبقي",
};

export function FreezeDialog({ subscription, member, isOpen, onClose, onSuccess }: FreezeDialogProps) {
  const [daysInput, setDaysInput] = useState<string>("");
  const [startsAt, setStartsAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const maxCount = subscription.freezeMaxCount ?? 2;
  const maxTotalDays = subscription.freezeMaxTotalDays ?? 15;
  const usedCount = subscription.freezeUsedCount ?? 0;
  const usedDays = subscription.freezeUsedDays ?? 0;

  const freezeState: FreezeState = useMemo(() => ({
    isFrozen: subscription.status === "FROZEN",
    isActive: subscription.status === "ACTIVE",
    overdue: subscription.status === "SUSPENDED_UNPAID" || (subscription.isOverdue ?? false),
    maxCount,
    maxTotalDays,
    usedCount,
    usedDays,
  }), [subscription, maxCount, maxTotalDays, usedCount, usedDays]);

  const requestedDays = daysInput.trim() ? parseInt(daysInput, 10) : undefined;
  const decision = useMemo(() => {
    return canFreeze(freezeState, isNaN(requestedDays as number) ? undefined : requestedDays);
  }, [freezeState, requestedDays]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!decision.ok) {
      setSubmitError(DENIAL_MESSAGES[decision.reason!] || "التجميد غير مسموح");
      return;
    }

    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const res = await membersApi.freezeSubscription(subscription.id, {
        days: requestedDays,
        startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
        reason: reason.trim() || undefined,
      });

      onSuccess(res.subscription);
      onClose();
    } catch (err: any) {
      setSubmitError(err?.message || "حدث خطأ أثناء تجميد الاشتراك");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-lg my-auto max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        dir="rtl"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-blue-100 bg-blue-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold">
              <Snowflake className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">تجميد الاشتراك</h2>
              <p className="text-xs text-gray-500">
                {subscription.plan?.name || subscription.kind} · {member.name}
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

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
            {/* Live Freeze Allowance Badge */}
            <div className="grid grid-cols-2 gap-3 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
              <div>
                <span className="text-xs text-gray-500 block">مرات التجميد المتاحة</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-gray-900">{decision.remainingCount}</span>
                  <span className="text-xs text-gray-400">/ متبقي من {maxCount}</span>
                </div>
                <span className="text-[11px] text-gray-500 block mt-0.5">مستهلك: {usedCount} مرة</span>
              </div>

              <div>
                <span className="text-xs text-gray-500 block">رصيد الأيام المتبقي</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-xl font-black text-blue-600">{decision.remainingDays}</span>
                  <span className="text-xs text-gray-400">/ متبقي من {maxTotalDays} يوم</span>
                </div>
                <span className="text-[11px] text-gray-500 block mt-0.5">مستهلك: {usedDays} يوم</span>
              </div>
            </div>

            {/* Validation Denial Alert */}
            {!decision.ok && decision.reason && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-start gap-2.5 animate-in fade-in">
                <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                <div>
                  <p className="font-bold">{DENIAL_MESSAGES[decision.reason]}</p>
                  {decision.reason === "REQUEST_EXCEEDS_REMAINING" && (
                    <p className="text-xs mt-1 text-red-600">
                      يمكنك طلب {decision.remainingDays} يوماً كحد أقصى أو تركه مفتوحاً لإنهائه يدوياً.
                    </p>
                  )}
                  {decision.reason === "PAYMENT_OVERDUE" && (
                    <p className="text-xs mt-1 text-red-600">
                      وفقاً للائحة النظام، لا يُسمح بتجميد الاشتراك للمشتركين المتأخرين عن السداد.
                    </p>
                  )}
                </div>
              </div>
            )}

            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  تاريخ بدء التجميد <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  عدد أيام التجميد (اختياري)
                </label>
                <input
                  type="number"
                  min="1"
                  max={decision.remainingDays}
                  value={daysInput}
                  onChange={(e) => setDaysInput(e.target.value)}
                  placeholder={`الحد الأقصى ${decision.remainingDays} يوم`}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
                />
                <p className="text-[11px] text-gray-400 mt-1">اتركه فارغاً للتجميد المفتوح حتى عودة العضو</p>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">سبب التجميد</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="سفر، ظروف عمل، إجازة دراسية، تقرير طبي..."
                rows={2}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-600"
              />
            </div>

            <div className="p-3 bg-blue-50/70 border border-blue-100 rounded-xl text-xs text-blue-900 leading-relaxed">
              <span className="font-bold block mb-0.5">معلومة هامة:</span>
              عند إلغاء التجميد، تُحسب الأيام الفعلية المنقضية وتُضاف تلقائياً إلى تاريخ انتهاء الاشتراك، ولا يُحسب أي يوم إضافي بعد استنفاد الرصيد.
            </div>
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
              disabled={isSubmitting || !decision.ok}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد التجميد الآن</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
