"use client";

import React, { useState, useMemo } from "react";
import { Play, AlertCircle, CheckCircle2 } from "lucide-react";
import { settleFreeze, endDateAfterFreeze } from "@gym/domain";
import { membersApi } from "../api";
import type { Subscription, Member } from "@gym/contracts";

interface UnfreezeDialogProps {
  subscription: Subscription;
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: Subscription) => void;
}

export function UnfreezeDialog({ subscription, member, isOpen, onClose, onSuccess }: UnfreezeDialogProps) {
  const [endedAt, setEndedAt] = useState<string>(new Date().toISOString().slice(0, 10));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeFreeze = useMemo(() => {
    return (subscription.freezes || []).find((f) => !f.endedAt);
  }, [subscription.freezes]);

  const startedAtDate = useMemo(() => {
    return activeFreeze ? new Date(activeFreeze.startedAt) : new Date(subscription.startDate);
  }, [activeFreeze, subscription.startDate]);

  const endedAtDate = useMemo(() => {
    return endedAt ? new Date(endedAt) : new Date();
  }, [endedAt]);

  const maxTotalDays = subscription.freezeMaxTotalDays ?? 15;
  const usedDays = subscription.freezeUsedDays ?? 0;
  const remainingAllowanceDays = Math.max(0, maxTotalDays - usedDays);

  const settlement = useMemo(() => {
    return settleFreeze({
      startedAt: startedAtDate,
      endedAt: endedAtDate,
      remainingDays: remainingAllowanceDays,
    });
  }, [startedAtDate, endedAtDate, remainingAllowanceDays]);

  const newEndDate = useMemo(() => {
    return endDateAfterFreeze(new Date(subscription.endDate), settlement.days);
  }, [subscription.endDate, settlement.days]);

  if (!isOpen) return null;

  const handleUnfreeze = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await membersApi.unfreezeSubscription(subscription.id, {
        endedAt: endedAt ? new Date(endedAt).toISOString() : undefined,
      });

      onSuccess(res.subscription);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء إلغاء التجميد");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="p-5 border-b border-emerald-100 bg-emerald-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
              <Play className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">إلغاء تجميد الاشتراك وتفعيله</h2>
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

        <form onSubmit={handleUnfreeze} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between text-xs text-gray-600 pb-2 border-b border-gray-200">
              <span>تاريخ بدء التجميد:</span>
              <span className="font-bold text-gray-900">{startedAtDate.toLocaleDateString("ar-EG")}</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                تاريخ إنهاء التجميد وعودة العضو
              </label>
              <input
                type="date"
                value={endedAt}
                onChange={(e) => setEndedAt(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-600 bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 text-center">
                <span className="text-[11px] text-emerald-800 block">الأيام المضافة للاشتراك</span>
                <span className="text-2xl font-black text-emerald-700">+{settlement.days} يوم</span>
              </div>

              <div className="p-3 rounded-lg bg-amber-50 border border-amber-100 text-center">
                <span className="text-[11px] text-amber-800 block">أيام التجاوز (مفقودة)</span>
                <span className="text-2xl font-black text-amber-700">{settlement.overflowDays} يوم</span>
              </div>
            </div>

            <div className="pt-2 text-xs text-gray-600 space-y-1">
              <div className="flex justify-between">
                <span>تاريخ الانتهاء السابق:</span>
                <span className="line-through text-gray-400">
                  {new Date(subscription.endDate).toLocaleDateString("ar-EG")}
                </span>
              </div>
              <div className="flex justify-between font-bold text-gray-900">
                <span>تاريخ الانتهاء الجديد المعتمد:</span>
                <span className="text-emerald-700 font-black">
                  {newEndDate.toLocaleDateString("ar-EG")}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
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
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري التنفيذ...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد إلغاء التجميد وتمديد الاشتراك</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
