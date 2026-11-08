"use client";

import React, { useState } from "react";
import { XCircle, AlertCircle } from "lucide-react";
import { membersApi } from "../api";
import type { Subscription, Member } from "@gym/contracts";

interface CancelSubscriptionDialogProps {
  subscription: Subscription;
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: Subscription) => void;
}

export function CancelSubscriptionDialog({
  subscription,
  member,
  isOpen,
  onClose,
  onSuccess,
}: CancelSubscriptionDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCancel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("سبب الإلغاء مطلوب إجبارياً للتدقيق والمراجعة");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await membersApi.cancelSubscription(subscription.id, {
        reason: reason.trim(),
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء إلغاء الاشتراك");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="p-5 border-b border-red-100 bg-red-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
              <XCircle className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">إلغاء الاشتراك نهائياً</h2>
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

        <form onSubmit={handleCancel} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <p className="text-sm text-gray-600">
            إلغاء الاشتراك يوقف صلاحية دخول العضو على هذا الاشتراك فوراً، ويقوم بإلغاء أي استحقاقات عمولة متبقية غير مكتسبة للمدرب.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              سبب الإلغاء <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="طلب العضو، ظرف صحي، استرداد نقدي..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-600 bg-white"
              required
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              رجوع
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الإلغاء...</span>
              ) : (
                <>
                  <XCircle className="h-4 w-4" />
                  <span>تأكيد الإلغاء</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
