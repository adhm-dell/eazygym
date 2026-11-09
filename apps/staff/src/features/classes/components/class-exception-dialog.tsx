"use client";

import React, { useEffect, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Clock,
  User,
  XCircle,
  CalendarDays,
  ShieldAlert,
  Sparkles,
} from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import { classesApi } from "../api";
import type { Staff, CreateClassExceptionDto } from "@gym/contracts";

interface ClassExceptionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  schedule: {
    id: string;
    name: string;
    coach?: { id?: string; name?: string };
    startTime: string;
    endTime: string;
  } | null;
  defaultDate?: string;
}

export function ClassExceptionDialog({
  isOpen,
  onClose,
  onSuccess,
  schedule,
  defaultDate,
}: ClassExceptionDialogProps) {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";

  const todayStr = defaultDate || new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(todayStr);
  const [actionType, setActionType] = useState<"CANCEL" | "RESCHEDULE" | "SUBSTITUTE">("CANCEL");
  const [newStartTime, setNewStartTime] = useState(schedule?.startTime || "18:00");
  const [newEndTime, setNewEndTime] = useState(schedule?.endTime || "19:00");
  const [substituteCoachId, setSubstituteCoachId] = useState("");
  const [coaches, setCoaches] = useState<Staff[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      classesApi.listCoaches().then((data) => {
        setCoaches(data);
        if (data.length > 0 && !substituteCoachId) {
          // default to first other coach
          const other = data.find((c) => c.id !== schedule?.coach?.id);
          setSubstituteCoachId(other?.id || data[0]?.id || "");
        }
      });
      if (schedule) {
        setNewStartTime(schedule.startTime);
        setNewEndTime(schedule.endTime);
      }
      setDate(defaultDate || new Date().toISOString().slice(0, 10));
      setActionType("CANCEL");
      setError(null);
    }
  }, [isOpen, schedule, defaultDate]);

  if (!isOpen || !schedule) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const dto: CreateClassExceptionDto = {
      date,
      isCancelled: actionType === "CANCEL",
      newStartTime: actionType === "RESCHEDULE" ? newStartTime : null,
      newEndTime: actionType === "RESCHEDULE" ? newEndTime : null,
      substituteCoachId: actionType === "SUBSTITUTE" ? substituteCoachId : null,
    };

    if (actionType === "RESCHEDULE" && newStartTime >= newEndTime) {
      setError(isRtl ? "وقت الانتهاء يجب أن يكون بعد وقت البدء" : "End time must be after start time");
      return;
    }

    if (actionType === "SUBSTITUTE" && !substituteCoachId) {
      setError(isRtl ? "يرجى اختيار المدرب البديل" : "Please select substitute coach");
      return;
    }

    setIsSubmitting(true);
    try {
      await classesApi.addException(schedule.id, dto);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          (isRtl ? "حدث خطأ أثناء تسجيل الاستثناء" : "An error occurred creating exception")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center gap-3 pb-2 border-b border-[#E1E5DF]">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#14181F]">
              {t("classesTimetable.exceptionTitle") || "إدارة استثناء وتعديل موعد اليوم"}
            </h3>
            <p className="text-xs text-[#5B6470] mt-0.5">
              {schedule.name} • {schedule.coach?.name || "المدرب"} ({schedule.startTime} - {schedule.endTime})
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border-[#E1E5DF] font-medium px-4 h-10"
          >
            {t("classesTimetable.cancel") || "إلغاء"}
          </Button>
          <Button
            type="submit"
            form="class-exception-form"
            disabled={isSubmitting}
            className={`rounded-xl font-bold px-5 h-10 shadow-sm ${
              actionType === "CANCEL"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F]"
            }`}
          >
            {isSubmitting
              ? (isRtl ? "جاري التطبيق..." : "Applying...")
              : actionType === "CANCEL"
              ? (isRtl ? "تأكيد إلغاء الحصة اليوم" : "Confirm Cancel Today")
              : (t("classesTimetable.save") || "حفظ الاستثناء")}
          </Button>
        </div>
      }
    >
      <form id="class-exception-form" onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Date Selector */}
        <div className="space-y-1">
          <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
            <Calendar className="h-3.5 w-3.5 text-[#5B6470]" />
            <span>{isRtl ? "تاريخ الاستثناء" : "Exception Date"}</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
            required
          />
        </div>

        {/* Action Type Selector */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-[#14181F]">
            {isRtl ? "نوع الاستثناء المطلوب" : "Exception Action Type"}
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => setActionType("CANCEL")}
              className={`p-3 rounded-xl text-xs font-bold border transition-all text-start flex flex-col gap-1 ${
                actionType === "CANCEL"
                  ? "bg-red-50 text-red-800 border-red-300 ring-2 ring-red-200"
                  : "bg-white text-[#5B6470] border-[#E1E5DF] hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <XCircle className="h-4 w-4 text-red-600" />
                <span>{t("classesTimetable.cancelOccurrence") || "إلغاء الحصة لهذا التاريخ"}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-normal">
                {isRtl ? "تمنع البوابة دخول المشتركين" : "Turnstile denies access"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActionType("RESCHEDULE")}
              className={`p-3 rounded-xl text-xs font-bold border transition-all text-start flex flex-col gap-1 ${
                actionType === "RESCHEDULE"
                  ? "bg-amber-50 text-amber-900 border-amber-300 ring-2 ring-amber-200"
                  : "bg-white text-[#5B6470] border-[#E1E5DF] hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <Clock className="h-4 w-4 text-amber-600" />
                <span>{t("classesTimetable.rescheduleTime") || "تعديل التوقيت لهذا اليوم"}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-normal">
                {isRtl ? "تغيير مواعيد البدء والانتهاء" : "Adjust start/end times"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActionType("SUBSTITUTE")}
              className={`p-3 rounded-xl text-xs font-bold border transition-all text-start flex flex-col gap-1 ${
                actionType === "SUBSTITUTE"
                  ? "bg-sky-50 text-sky-900 border-sky-300 ring-2 ring-sky-200"
                  : "bg-white text-[#5B6470] border-[#E1E5DF] hover:bg-gray-50"
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold">
                <User className="h-4 w-4 text-sky-600" />
                <span>{t("classesTimetable.substituteCoachOption") || "تعيين كابتن بديل"}</span>
              </div>
              <span className="text-[10px] text-gray-500 font-normal">
                {isRtl ? "مدرب مؤقت لهذا اليوم" : "Temporary coach for today"}
              </span>
            </button>
          </div>
        </div>

        {/* Conditional Fields based on actionType */}
        {actionType === "RESCHEDULE" && (
          <div className="grid grid-cols-2 gap-3 p-3 bg-amber-50/50 rounded-xl border border-amber-200">
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#14181F]">
                {t("classesTimetable.startTime") || "وقت البدء الجديد"}
              </label>
              <input
                type="time"
                value={newStartTime}
                onChange={(e) => setNewStartTime(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-[#14181F]">
                {t("classesTimetable.endTime") || "وقت الانتهاء الجديد"}
              </label>
              <input
                type="time"
                value={newEndTime}
                onChange={(e) => setNewEndTime(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm"
                required
              />
            </div>
          </div>
        )}

        {actionType === "SUBSTITUTE" && (
          <div className="space-y-1 p-3 bg-sky-50/50 rounded-xl border border-sky-200">
            <label className="text-xs font-bold text-[#14181F]">
              {t("classesTimetable.substituteCoach") || "الكابتن البديل المسؤول عن حصة اليوم"}
            </label>
            <select
              value={substituteCoachId}
              onChange={(e) => setSubstituteCoachId(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm"
              required
            >
              <option value="">{t("classesTimetable.selectSubstituteCoach") || "اختر الكابتن البديل..."}</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.id === schedule.coach?.id ? "(المدرب الأساسي)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Prominent Notification Banner */}
        <div className="p-3.5 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF] text-xs text-[#262D38] leading-relaxed flex items-start gap-2.5">
          <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block text-amber-900 mb-0.5">
              {isRtl ? "إشعار الأعضاء وقواعد الدخول التلقائية:" : "Automatic Member Notification & Access Rule:"}
            </span>
            <p className="text-[11px] text-[#5B6470]">
              {t("classesTimetable.exceptionBanner") ||
                "تنبيه: سيتم إشعار جميع المشتركين المسجلين في هذا الموعد تلقائياً بالتغيير. في حالة الإلغاء، ستمنع البوابة دخولهم ويعطي النظام تنبيهاً للموظف بأن الحصة ملغاة (CLASS_CANCELLED)."}
            </p>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
