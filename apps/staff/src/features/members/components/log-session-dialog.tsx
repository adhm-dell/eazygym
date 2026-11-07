"use client";

import React, { useState } from "react";
import { Dumbbell, AlertCircle, CheckCircle2 } from "lucide-react";
import { membersApi } from "../api";
import type { Subscription, Member } from "@gym/mock-data";

interface LogSessionDialogProps {
  subscription: Subscription;
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: Subscription) => void;
}

export function LogSessionDialog({
  subscription,
  member,
  isOpen,
  onClose,
  onSuccess,
}: LogSessionDialogProps) {
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const totalSessions = subscription.totalSessions ?? 0;
  const usedSessions = subscription.usedSessions ?? 0;
  const sessionsLeft = subscription.sessionsLeft ?? Math.max(0, totalSessions - usedSessions);
  const isExhausted = totalSessions > 0 && sessionsLeft <= 0;

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isExhausted) {
      setError("تم استنفاد جميع جلسات التدريب المتاحة في هذا الاشتراك");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await membersApi.logPtSession(subscription.id, {
        notes: notes.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تسجيل الجلسة");
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
        <div className="p-5 border-b border-indigo-100 bg-indigo-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">تسجيل جلسة تدريب خاص (PT)</h2>
              <p className="text-xs text-gray-500">
                {member.name} · المدرب: {subscription.currentCoach?.name || "المعين"}
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

        <form onSubmit={handleLog} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Session Counter Card */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 block">الجلسات المتبقية في الاشتراك</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-2xl font-black ${sessionsLeft > 0 ? "text-indigo-600" : "text-red-600"}`}>
                  {sessionsLeft}
                </span>
                <span className="text-xs text-gray-400">/ من إجمالي {totalSessions} جلسة</span>
              </div>
            </div>
            <div className="text-left">
              <span className="text-xs text-gray-500 block">الجلسات المنفذة</span>
              <span className="text-lg font-bold text-gray-800">{usedSessions}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              ملاحظات عن الجلسة (اختياري)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="تمارين الظهر والأكتاف، تقييم الأداء..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-600 bg-white"
            />
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
              disabled={isSubmitting || isExhausted}
              className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري التسجيل...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد خصم جلسة 1</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
