"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, CheckCircle2, ArrowRightLeft } from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { membersApi } from "../api";
import type { Subscription, Member, Staff } from "@gym/contracts";

interface ChangeCoachDialogProps {
  subscription: Subscription;
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedSub: Subscription) => void;
}

export function ChangeCoachDialog({
  subscription,
  member,
  isOpen,
  onClose,
  onSuccess,
}: ChangeCoachDialogProps) {
  const [coaches, setCoaches] = useState<Staff[]>([]);
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentCoach = subscription.currentCoach;

  // Load coaches
  useEffect(() => {
    if (!isOpen) return;
    membersApi.listStaff().then((staffList) => {
      const activeCoaches = staffList.filter(
        (s) => s.role === "COACH" && s.isActive && s.id !== currentCoach?.id
      );
      setCoaches(activeCoaches);
      if (activeCoaches[0]) {
        setSelectedCoachId(activeCoaches[0].id);
      }
    });
  }, [isOpen, currentCoach]);

  // Load preview when coach or effective date changes
  useEffect(() => {
    if (!selectedCoachId || !isOpen) return;
    setIsLoadingPreview(true);
    setError(null);

    membersApi
      .previewCoachTransfer(
        subscription.id,
        selectedCoachId,
        effectiveDate ? new Date(effectiveDate).toISOString() : undefined
      )
      .then((res) => {
        setPreviewData(res.milestones);
      })
      .catch((err) => {
        setError(err?.message || "تعذر حساب نسب تقسيم العمولات");
        setPreviewData(null);
      })
      .finally(() => {
        setIsLoadingPreview(false);
      });
  }, [subscription.id, selectedCoachId, effectiveDate, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCoachId) {
      setError("يرجى اختيار المدرب الجديد");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await membersApi.changeCoach(subscription.id, {
        newCoachId: selectedCoachId,
        effectiveAt: effectiveDate ? new Date(effectiveDate).toISOString() : undefined,
        reason: reason.trim() || undefined,
      });

      onSuccess(res.subscription);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تحويل المدرب");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl my-auto max-h-[90vh] bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className="p-4 sm:p-5 border-b border-purple-100 bg-purple-50/50 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-purple-600 text-white flex items-center justify-center font-bold">
              <ArrowRightLeft className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">تحويل مدرب التدريب الخاص (PT)</h2>
              <p className="text-xs text-gray-500">
                {member.name} · المدرب الحالي: {currentCoach?.name || "غير محدد"}
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
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  المدرب الجديد المختار <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-600 bg-white"
                  required
                >
                  {coaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  تاريخ سريان التحويل <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-600 bg-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">سبب التحويل</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="رغبة العضو، تغيير الجدول الأسبوعي، إجازة المدرب..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-600 bg-white"
              />
            </div>

            {/* Real-time Milestone Split Visualization */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-gray-800">
                  تقسيم استحقاقات العمولات حسب الأيام المنقضية (توزيع 100%)
                </span>
                {isLoadingPreview && (
                  <span className="text-xs text-purple-600 animate-pulse">جاري الحساب...</span>
                )}
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-start text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                    <tr>
                      <th className="p-3">الشهر / المرحلة</th>
                      <th className="p-3">الفترة الزمنية</th>
                      <th className="p-3">قيمة الشريحة</th>
                      <th className="p-3 text-purple-700">حصة المدرب السابق ({currentCoach?.name?.split(" ")[1] || "السابق"})</th>
                      <th className="p-3 text-emerald-700">حصة المدرب الجديد</th>
                      <th className="p-3 text-center">المجموع</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {previewData?.map((m) => (
                      <tr key={m.index} className="hover:bg-purple-50/30 transition-colors">
                        <td className="p-3 font-bold text-gray-800">المرحلة {m.index}</td>
                        <td className="p-3 text-gray-500">
                          {new Date(m.periodStart).toLocaleDateString("ar-EG")} ←{" "}
                          {new Date(m.dueDate).toLocaleDateString("ar-EG")}
                        </td>
                        <td className="p-3 font-semibold text-gray-900">{formatMoney(m.base)}</td>
                        <td className="p-3 font-bold text-purple-700">
                          {m.oldCoachPercent}%{" "}
                          <span className="text-[10px] text-gray-400 font-normal">({m.oldCoachShareBps} bps)</span>
                        </td>
                        <td className="p-3 font-bold text-emerald-700">
                          {m.newCoachPercent}%{" "}
                          <span className="text-[10px] text-gray-400 font-normal">({m.newCoachShareBps} bps)</span>
                        </td>
                        <td className="p-3 text-center font-black text-gray-900 bg-gray-50/50">
                          {m.oldCoachPercent + m.newCoachPercent}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-gray-400 mt-2">
                وفقاً لقواعد النظام: يحتفظ المدرب السابق بحصته عن الأيام المنقضية، ويبدأ استحقاق المدرب الجديد من تاريخ التحويل بدقة 100%.
              </p>
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
              disabled={isSubmitting || !selectedCoachId}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري التحويل...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد تحويل المدرب</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
