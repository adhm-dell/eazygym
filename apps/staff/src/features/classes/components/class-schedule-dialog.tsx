"use client";

import React, { useEffect, useState } from "react";
import { CalendarDays, Clock, User, Users, Sparkles } from "lucide-react";
import { Dialog, Button, Switch } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import { classesApi, type ClassScheduleItem } from "../api";
import type { Staff, CreateClassScheduleDto, UpdateClassScheduleDto } from "@gym/contracts";

interface ClassScheduleDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  scheduleToEdit?: ClassScheduleItem | null;
  defaultDayOfWeek?: number;
}

export function ClassScheduleDialog({
  isOpen,
  onClose,
  onSuccess,
  scheduleToEdit,
  defaultDayOfWeek = 0,
}: ClassScheduleDialogProps) {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const isEditing = Boolean(scheduleToEdit);

  const [coaches, setCoaches] = useState<Staff[]>([]);
  const [name, setName] = useState("");
  const [coachId, setCoachId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(defaultDayOfWeek);
  const [startTime, setStartTime] = useState("18:00");
  const [endTime, setEndTime] = useState("19:00");
  const [capacity, setCapacity] = useState("20");
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load active coaches
  useEffect(() => {
    if (isOpen) {
      classesApi.listCoaches().then((data) => {
        setCoaches(data);
        if (!scheduleToEdit && data.length > 0 && !coachId) {
          setCoachId(data[0]?.id || "");
        }
      });
    }
  }, [isOpen, scheduleToEdit]);

  // Sync form on open / edit
  useEffect(() => {
    if (scheduleToEdit) {
      setName(scheduleToEdit.name);
      setCoachId(scheduleToEdit.coachId);
      setDayOfWeek(scheduleToEdit.dayOfWeek);
      setStartTime(scheduleToEdit.startTime);
      setEndTime(scheduleToEdit.endTime);
      setCapacity(scheduleToEdit.capacity.toString());
      setIsActive(scheduleToEdit.isActive);
    } else {
      setName("");
      setDayOfWeek(defaultDayOfWeek);
      setStartTime("18:00");
      setEndTime("19:00");
      setCapacity("20");
      setIsActive(true);
    }
    setError(null);
  }, [scheduleToEdit, defaultDayOfWeek, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(isRtl ? "اسم الحصة مطلوب" : "Class name is required");
      return;
    }

    if (!coachId) {
      setError(isRtl ? "يرجى اختيار المدرب المسؤول" : "Please select an assigned coach");
      return;
    }

    const capNum = parseInt(capacity, 10);
    if (isNaN(capNum) || capNum <= 0) {
      setError(isRtl ? "يرجى إدخال سعة صحيحة أكبر من 0" : "Please enter a valid capacity > 0");
      return;
    }

    if (startTime >= endTime) {
      setError(isRtl ? "وقت الانتهاء يجب أن يكون بعد وقت البدء" : "End time must be after start time");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && scheduleToEdit) {
        const dto: UpdateClassScheduleDto = {
          name: trimmedName,
          coachId,
          dayOfWeek,
          startTime,
          endTime,
          capacity: capNum,
          isActive,
        };
        await classesApi.updateSchedule(scheduleToEdit.id, dto);
      } else {
        const dto: CreateClassScheduleDto = {
          name: trimmedName,
          coachId,
          dayOfWeek,
          startTime,
          endTime,
          capacity: capNum,
        };
        await classesApi.createSchedule(dto);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          (isRtl ? "حدث خطأ أثناء حفظ موعد الحصة" : "An error occurred saving schedule")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysList = [
    { value: 0, label: t("classesTimetable.days.0") || "الأحد" },
    { value: 1, label: t("classesTimetable.days.1") || "الإثنين" },
    { value: 2, label: t("classesTimetable.days.2") || "الثلاثاء" },
    { value: 3, label: t("classesTimetable.days.3") || "الأربعاء" },
    { value: 4, label: t("classesTimetable.days.4") || "الخميس" },
    { value: 5, label: t("classesTimetable.days.5") || "الجمعة" },
    { value: 6, label: t("classesTimetable.days.6") || "السبت" },
  ];

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="lg"
      title={
        <div className="flex items-center justify-between pb-2 border-b border-[#E1E5DF] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C6F24E] text-[#14181F] flex items-center justify-center font-bold">
              <CalendarDays className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[#14181F]">
                {isEditing
                  ? (t("classesTimetable.editSchedule") || "تعديل موعد الحصة")
                  : (t("classesTimetable.createSchedule") || "إضافة موعد حصة جديد")}
              </h3>
              <p className="text-xs text-[#5B6470] mt-0.5">
                {isRtl ? "تحديد تفاصيل الحصة، المدرب، وتوقيت الجدول الأسبوعي" : "Define class details, coach, and weekly timetable slot"}
              </p>
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 bg-[#F2F4F1] px-3 py-1.5 rounded-xl border border-[#E1E5DF]">
              <span className="text-xs font-semibold text-[#14181F]">
                {isActive
                  ? (t("classesTimetable.active") || "نشطة")
                  : (t("classesTimetable.inactive") || "معطلة")}
              </span>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          )}
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
            form="class-schedule-form"
            disabled={isSubmitting}
            className="rounded-xl font-bold bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F] px-5 h-10 shadow-sm"
          >
            {isSubmitting
              ? (isRtl ? "جاري الحفظ..." : "Saving...")
              : isEditing
              ? (t("classesTimetable.save") || "حفظ التعديلات")
              : (t("classesTimetable.create") || "إضافة الموعد")}
          </Button>
        </div>
      }
    >
      <form id="class-schedule-form" onSubmit={handleSubmit} className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
            {error}
          </div>
        )}

        {/* Class Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
            <Sparkles className="h-3.5 w-3.5 text-[#5B6470]" />
            <span>{t("classesTimetable.className") || "اسم الحصة"}</span>
            <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={
              t("classesTimetable.classNamePlaceholder") || "مثلاً: كروس فيت الصباحي، كيك بوكسينغ، يوجا..."
            }
            className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E] focus:ring-2 focus:ring-[#C6F24E]/20"
            required
          />
        </div>

        {/* Coach Select */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
            <User className="h-3.5 w-3.5 text-[#5B6470]" />
            <span>{t("classesTimetable.coach") || "المدرب المسؤول"}</span>
            <span className="text-red-500">*</span>
          </label>
          <select
            value={coachId}
            onChange={(e) => setCoachId(e.target.value)}
            className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
            required
          >
            <option value="">{t("classesTimetable.selectCoach") || "اختر المدرب..."}</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Day of Week */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
            <CalendarDays className="h-3.5 w-3.5 text-[#5B6470]" />
            <span>{t("classesTimetable.dayOfWeek") || "يوم الحصة في الأسبوع"}</span>
            <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-4 sm:grid-cols-7 gap-1.5">
            {daysList.map((d) => (
              <button
                key={d.value}
                type="button"
                onClick={() => setDayOfWeek(d.value)}
                className={`py-2 px-1 text-xs rounded-xl font-bold border transition-all ${
                  dayOfWeek === d.value
                    ? "bg-[#14181F] text-[#C6F24E] border-[#14181F] shadow-sm"
                    : "bg-[#F2F4F1] text-[#5B6470] border-[#E1E5DF] hover:bg-white"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Start / End Times & Capacity */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#5B6470]" />
              <span>{t("classesTimetable.startTime") || "وقت البدء"}</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-[#5B6470]" />
              <span>{t("classesTimetable.endTime") || "وقت الانتهاء"}</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
              <Users className="h-3.5 w-3.5 text-[#5B6470]" />
              <span>{t("classesTimetable.capacity") || "السعة (أقصى عدد)"}</span>
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              max="200"
              value={capacity}
              onChange={(e) => setCapacity(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
              required
            />
          </div>
        </div>
      </form>
    </Dialog>
  );
}
