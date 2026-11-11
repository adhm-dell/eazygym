"use client";

import React, { useState, useEffect } from "react";
import { AlertCircle, Calendar, Sparkles } from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { classesApi, type ClassScheduleItem } from "../../classes/api";
import { subscriptionsApi } from "../../subscriptions/api";

interface ChangeClassSlotDialogProps {
  subscription: any;
  member: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function ChangeClassSlotDialog({
  subscription,
  member,
  isOpen,
  onClose,
  onSuccess,
}: ChangeClassSlotDialogProps) {
  const [schedules, setSchedules] = useState<ClassScheduleItem[]>([]);
  const [selectedSlotId, setSelectedSlotId] = useState<string>("");
  const [reason, setReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);
    classesApi
      .listSchedules()
      .then((data) => {
        setSchedules(data);
        if (data.length > 0 && !selectedSlotId) {
          setSelectedSlotId(data[0]?.id || "");
        }
      })
      .catch((err) => {
        setError(err?.message || "تعذر تحميل جدول الحصص");
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const daysAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotId) {
      setError("يرجى اختيار الحصة المجدولة");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await subscriptionsApi.changeClassSlot(subscription.id, {
        classSlotIds: [selectedSlotId],
        reason: reason.trim() || undefined,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || "تعذر ربط الحصة بالاشتراك");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedSchedule = schedules.find((s) => s.id === selectedSlotId);

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-xl bg-emerald-100 text-emerald-800">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#14181F]">
              ربط / تغيير موعد الحصة للاشتراك
            </h3>
            <p className="text-xs text-[#5B6470]">
              المشترك: {member?.name} · باقة {subscription?.plan?.name || "الحصص"}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            variant="lime"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedSlotId}
            isLoading={isSubmitting}
            className="font-bold"
          >
            تأكيد ربط الحصة
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 text-xs" dir="rtl">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="p-3 bg-[#F9FAF8] border border-[#E1E5DF] rounded-xl space-y-1">
          <div className="flex justify-between">
            <span className="text-[#5B6470]">اسم العضو:</span>
            <span className="font-bold text-[#14181F]">{member?.name} ({member?.code})</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#5B6470]">نوع الباقة:</span>
            <span className="font-bold text-emerald-700">{subscription?.plan?.name}</span>
          </div>
        </div>

        <div>
          <label className="font-bold text-[#14181F] block mb-1.5">
            اختر الحصة المجدولة المطلوبة:
          </label>
          <select
            value={selectedSlotId}
            onChange={(e) => setSelectedSlotId(e.target.value)}
            disabled={isLoading || isSubmitting}
            className="w-full px-3 py-2.5 bg-white border border-[#E1E5DF] rounded-xl text-xs font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
          >
            {schedules.map((cs) => (
              <option key={cs.id} value={cs.id}>
                {cs.name} · {daysAr[cs.dayOfWeek] || ""} ({cs.startTime} - {cs.endTime}) · كابتن {cs.coach?.name || "غير محدد"} (سعة {cs.capacity})
              </option>
            ))}
          </select>
        </div>

        {selectedSchedule && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-emerald-900">
            <div className="flex items-center gap-1 font-bold">
              <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
              <span>تفاصيل الحصة المختارة:</span>
            </div>
            <div className="text-[11px] grid grid-cols-2 gap-2 pt-1">
              <div>الموعد: <strong>{daysAr[selectedSchedule.dayOfWeek]} من {selectedSchedule.startTime} إلى {selectedSchedule.endTime}</strong></div>
              <div>المدرب: <strong>{selectedSchedule.coach?.name || "غير محدد"}</strong></div>
              <div>السعة: <strong>{selectedSchedule.capacity} متدرب</strong></div>
              <div>المسجلين حالياً: <strong>{selectedSchedule.registeredCount || 0}</strong></div>
            </div>
          </div>
        )}

        <div>
          <label className="font-bold text-[#14181F] block mb-1">
            سبب التغيير (اختياري):
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: رغبة المشترك في تغيير الموعد ليوم آخر"
            className="w-full px-3 py-2 bg-white border border-[#E1E5DF] rounded-xl text-xs"
          />
        </div>
      </form>
    </Dialog>
  );
}
