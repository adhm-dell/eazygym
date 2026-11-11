"use client";

import React, { useState, useEffect } from "react";
import { coachOpsApi, type CoachShiftItem } from "../api";
import { sellApi } from "../../sell/api";
import { Button, Input, Badge, useToast } from "@gym/ui";
import {
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  UserCheck,
  AlertCircle,
  Calendar,
  Sparkles,
  Edit2,
  Check,
  RotateCcw,
} from "lucide-react";
import type { Staff } from "@gym/contracts";

const DAYS_OF_WEEK = [
  "الأحد",
  "الاثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export function ShiftsBoard() {
  const { toast } = useToast();
  const [shifts, setShifts] = useState<CoachShiftItem[]>([]);
  const [onShiftCoaches, setOnShiftCoaches] = useState<string[]>([]);
  const [allCoaches, setAllCoaches] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // New shift modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [coachId, setCoachId] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 1, 2, 3, 4, 6]); // All days except Friday (5)
  const [replaceExisting, setReplaceExisting] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shiftsData, onShiftData, coachesList] = await Promise.all([
        coachOpsApi.getShifts(),
        coachOpsApi.getCoachesOnShift(),
        sellApi.listCoaches().catch(() => []),
      ]);
      setShifts(shiftsData);
      setOnShiftCoaches(onShiftData.onShiftCoachIds || []);
      setAllCoaches(coachesList);

      if (coachesList.length > 0 && !coachId) {
        setCoachId(coachesList[0]?.id || "");
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Quick Preset Handlers
  const handleApplyShiftPreset = (start: string, end: string) => {
    setStartTime(start);
    setEndTime(end);
  };

  const handleApplyDaysPreset = (days: number[]) => {
    setSelectedDays(days);
  };

  const handleSetDayOff = (dayOffIndex: number) => {
    // Select all days except dayOffIndex
    const allDays = [0, 1, 2, 3, 4, 5, 6];
    setSelectedDays(allDays.filter((d) => d !== dayOffIndex));
  };

  const toggleDay = (dayIndex: number) => {
    if (selectedDays.includes(dayIndex)) {
      if (selectedDays.length === 1) {
        toast({ title: "يجب اختيار يوم عمل واحد على الأقل", variant: "warning" });
        return;
      }
      setSelectedDays(selectedDays.filter((d) => d !== dayIndex));
    } else {
      setSelectedDays([...selectedDays, dayIndex].sort());
    }
  };

  const handleOpenModalForCoach = (targetCoachId?: string) => {
    if (targetCoachId) {
      setCoachId(targetCoachId);
    } else if (allCoaches.length > 0 && !coachId) {
      setCoachId(allCoaches[0]?.id || "");
    }
    setIsModalOpen(true);
  };

  const handleCreateWeeklySchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachId) {
      toast({ title: "برجاء اختيار المدرب", variant: "error" });
      return;
    }
    if (selectedDays.length === 0) {
      toast({ title: "برجاء اختيار أيام العمل", variant: "error" });
      return;
    }

    setIsSubmitting(true);
    try {
      await coachOpsApi.createWeeklySchedule({
        coachId,
        daysOfWeek: selectedDays,
        startTime,
        endTime,
        replaceExisting,
      });

      const selectedCoachObj = allCoaches.find((c) => c.id === coachId);
      toast({
        title: "تم تطبيق الوردية الأسبوعية بنجاح!",
        description: `تم تعيين وردية ${selectedDays.length} أيام للكابتن ${selectedCoachObj?.name || ""} من ${startTime} إلى ${endTime}`,
        variant: "success",
      });

      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "تعذر تطبيق الوردية",
        description: err.message || "حدث خطأ أثناء حفظ جدول الوردية",
        variant: "error",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivate = async (shiftId: string) => {
    if (!confirm("هل أنت متأكد من حذف هذه الوردية؟")) return;
    try {
      await coachOpsApi.deactivateShift(shiftId);
      toast({ title: "تم إلغاء الوردية", variant: "info" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    }
  };

  // Combine coaches from allCoaches and shifts to ensure no one is missed
  const coachesToDisplay = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; email?: string }>();
    for (const c of allCoaches) {
      map.set(c.id, { id: c.id, name: c.name, email: c.email });
    }
    for (const s of shifts) {
      if (!map.has(s.coach.id)) {
        map.set(s.coach.id, s.coach);
      }
    }
    return Array.from(map.values());
  }, [allCoaches, shifts]);

  return (
    <div className="space-y-6">
      {/* Top Bar: On-shift coaches summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-xl bg-white border border-[#E1E5DF] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-bold">
            <UserCheck className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-[#14181F]">
              المدربون على الوردية الآن ({onShiftCoaches.length})
            </h3>
            <p className="text-xs text-[#5B6470]">
              يتم التحديث المباشر وفق التوقيت الحالي لفرع الجيم
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {onShiftCoaches.length === 0 ? (
            <span className="text-xs text-[#5B6470] bg-[#F2F4F1] px-3 py-1.5 rounded-lg border border-[#E1E5DF]">
              لا يوجد مدربون على الوردية حالياً
            </span>
          ) : (
            coachesToDisplay
              .filter((c) => onShiftCoaches.includes(c.id))
              .map((c) => (
                <span
                  key={c.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#C6F24E]/20 text-[#14181F] border border-[#C6F24E]"
                >
                  <span className="h-2 w-2 rounded-full bg-[#14181F] animate-pulse" />
                  {c.name}
                </span>
              ))
          )}

          <Button
            variant="lime"
            size="sm"
            onClick={() => handleOpenModalForCoach()}
            className="flex items-center gap-1 font-bold"
          >
            <Plus className="h-4 w-4" />
            <span>+ تعيين وردية أسبوعية (Stamp)</span>
          </Button>
        </div>
      </div>

      {/* Shifts Weekly Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-[#5B6470]">
          <div className="animate-spin h-7 w-7 border-2 border-[#14181F] border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs">جاري تحميل جدول الورديات...</p>
        </div>
      ) : coachesToDisplay.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E1E5DF] text-[#5B6470] space-y-3">
          <Clock className="h-10 w-10 mx-auto text-[#C6F24E]" />
          <h4 className="font-bold text-sm text-[#14181F]">لا يوجد مدربون مسجلون بالجيم</h4>
          <p className="text-xs">
            يرجى إضافة مدربين أولاً من شاشة إدارة الموظفين لتحديد مواعيد عملهم.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {coachesToDisplay.map((coach) => {
            const coachShifts = shifts.filter((s) => s.coachId === coach.id);
            const isOnShiftNow = onShiftCoaches.includes(coach.id);

            return (
              <div
                key={coach.id}
                className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-sm space-y-4 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF]">
                    <div className="flex items-center gap-2.5">
                      <div className="h-9 w-9 rounded-full bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-bold text-xs shrink-0">
                        {coach.name.charAt(0)}
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-[#14181F] flex items-center gap-2">
                          <span>{coach.name}</span>
                          {isOnShiftNow && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C6F24E] text-[#14181F]">
                              على الوردية
                            </span>
                          )}
                        </h4>
                        <p className="text-xs text-[#5B6470]">{coach.email || "كابتن معتمد"}</p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenModalForCoach(coach.id)}
                      className="p-1.5 hover:bg-[#F2F4F1] text-[#5B6470] hover:text-[#14181F] rounded-lg transition-colors"
                      title="تعيين أو تعديل الوردية الأسبوعية"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Days Table */}
                  <div className="space-y-1.5 mt-3">
                    {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                      const dayShifts = coachShifts.filter(
                        (s) => s.dayOfWeek === dayIndex
                      );

                      return (
                        <div
                          key={dayIndex}
                          className={`flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                            dayShifts.length > 0 ? "bg-[#F2F4F1]/70" : "bg-transparent text-[#5B6470]/60"
                          }`}
                        >
                          <span className={`font-bold w-16 ${dayShifts.length > 0 ? "text-[#14181F]" : "text-[#5B6470]"}`}>
                            {dayName}
                          </span>

                          {dayShifts.length > 0 ? (
                            <div className="flex flex-col gap-1 items-end">
                              {dayShifts.map((s) => {
                                const isOvernight = s.startTime > s.endTime;
                                return (
                                  <div
                                    key={s.id}
                                    className="flex items-center gap-2 font-mono font-medium"
                                  >
                                    <span className="text-[#14181F] font-bold">
                                      {s.startTime} - {s.endTime}
                                    </span>
                                    {isOvernight && (
                                      <span className="text-[10px] bg-indigo-50 text-indigo-700 px-1 py-0.5 rounded">
                                        ليلي
                                      </span>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() => handleDeactivate(s.id)}
                                      className="text-red-500 hover:text-red-700 cursor-pointer p-0.5 transition-colors"
                                      title="حذف الوردية"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-[11px] font-semibold text-[#5B6470]/70 italic">إجازة</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleOpenModalForCoach(coach.id)}
                  className="w-full text-xs font-bold text-[#14181F] hover:bg-[#F2F4F1]"
                >
                  <Clock className="h-3.5 w-3.5 me-1" />
                  <span>تعديل وردية الأسبوع</span>
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Stamp Weekly Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl space-y-5 text-start animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#E1E5DF] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-bold">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-[#14181F]">
                    قالب الوردية الأسبوعية السريع (Weekly Shift Stamp)
                  </h3>
                  <p className="text-[11px] text-[#5B6470]">
                    حدد أوقات العمل وأيام الأسبوع ليتم تطبيقها دفعة واحدة للمدرب
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateWeeklySchedule} className="space-y-4">
              {/* Coach Select */}
              <div>
                <label className="text-xs font-bold text-[#14181F] block mb-1.5">
                  اختر المدرب:
                </label>
                <select
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                  className="w-full text-xs font-bold p-2.5 border border-[#14181F] rounded-xl bg-[#F2F4F1] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
                  required
                >
                  <option value="">-- اختر المدرب من القائمة --</option>
                  {coachesToDisplay.map((c) => (
                    <option key={c.id} value={c.id}>
                      كابتن {c.name} {c.email ? `(${c.email})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Working Hours & Presets */}
              <div className="space-y-2 bg-[#F2F4F1] p-3.5 rounded-2xl border border-[#E1E5DF]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#14181F] flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-[#5B6470]" />
                    <span>ساعات العمل اليومية:</span>
                  </span>
                  <span className="text-[11px] text-[#5B6470]">قوالب أوقات جاهزة</span>
                </div>

                {/* Hour Presets */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "صباحي (09:00 - 17:00)", start: "09:00", end: "17:00" },
                    { label: "مسائي (14:00 - 22:00)", start: "14:00", end: "22:00" },
                    { label: "ليلي (18:00 - 02:00)", start: "18:00", end: "02:00" },
                    { label: "يوم كامل (10:00 - 20:00)", start: "10:00", end: "20:00" },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => handleApplyShiftPreset(preset.start, preset.end)}
                      className={`text-[11px] px-2.5 py-1 rounded-lg border font-bold transition-colors cursor-pointer ${
                        startTime === preset.start && endTime === preset.end
                          ? "bg-[#14181F] text-[#C6F24E] border-[#14181F]"
                          : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-[#E1E5DF]"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <Input
                    label="وقت البداية (من)"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    placeholder="10:00"
                    required
                    className="font-mono font-bold"
                  />
                  <Input
                    label="وقت النهاية (إلى)"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    placeholder="18:00"
                    required
                    className="font-mono font-bold"
                  />
                </div>

                {startTime > endTime && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>وردية ليلية تعبر منتصف الليل وتنتهي في اليوم التالي.</span>
                  </div>
                )}
              </div>

              {/* Working Days & Stamps */}
              <div className="space-y-2.5 bg-[#F2F4F1] p-3.5 rounded-2xl border border-[#E1E5DF]">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#14181F] flex items-center gap-1.5">
                    <Calendar className="h-4 w-4 text-[#5B6470]" />
                    <span>أيام العمل الأسبوعية:</span>
                  </span>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    {selectedDays.length} أيام عمل مختارة
                  </span>
                </div>

                {/* Quick Days Stamps */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleApplyDaysPreset([0, 1, 2, 3, 4, 6])}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E1E5DF] bg-white hover:bg-[#14181F] hover:text-white font-bold transition-colors cursor-pointer"
                  >
                    طوال الأسبوع (إجازة الجمعة)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDaysPreset([0, 1, 2, 3, 4, 5])}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E1E5DF] bg-white hover:bg-[#14181F] hover:text-white font-bold transition-colors cursor-pointer"
                  >
                    طوال الأسبوع (إجازة السبت)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyDaysPreset([0, 1, 2, 3, 4, 5, 6])}
                    className="text-[11px] px-2.5 py-1 rounded-lg border border-[#E1E5DF] bg-white hover:bg-[#14181F] hover:text-white font-bold transition-colors cursor-pointer"
                  >
                    كل الأيام (7 أيام)
                  </button>
                </div>

                {/* Dropdown to easily pick day off */}
                <div className="flex items-center gap-2 pt-1 text-xs">
                  <span className="text-[#5B6470] font-bold shrink-0">أو حدد يوم الإجازة:</span>
                  <select
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      if (!isNaN(val)) handleSetDayOff(val);
                    }}
                    className="w-full text-xs font-bold p-1.5 bg-white border border-[#E1E5DF] rounded-lg"
                  >
                    <option value="">اختر يوم الإجازة لاستثناءه...</option>
                    {DAYS_OF_WEEK.map((d, idx) => (
                      <option key={idx} value={idx}>
                        يوم {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Day Buttons Grid */}
                <div className="grid grid-cols-7 gap-1 pt-1">
                  {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                    const isSelected = selectedDays.includes(dayIndex);
                    return (
                      <button
                        key={dayIndex}
                        type="button"
                        onClick={() => toggleDay(dayIndex)}
                        className={`py-2 rounded-xl text-center text-xs font-bold border transition-all cursor-pointer ${
                          isSelected
                            ? "bg-[#14181F] text-[#C6F24E] border-[#14181F] shadow-sm"
                            : "bg-white text-[#5B6470] border-[#E1E5DF] hover:bg-gray-100"
                        }`}
                      >
                        <span className="block text-[11px]">{dayName}</span>
                        <span className="block text-[9px] mt-0.5">
                          {isSelected ? "عمل" : "إجازة"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Replace Existing Checkbox */}
              <label className="flex items-center gap-2 text-xs font-bold text-[#14181F] cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={replaceExisting}
                  onChange={(e) => setReplaceExisting(e.target.checked)}
                  className="rounded border-[#E1E5DF]"
                />
                <span>تحديث واستبدال أي ورديات سابقة مسجلة لنفس المدرب في هذه الأيام</span>
              </label>

              {/* Actions */}
              <div className="flex justify-end gap-2.5 pt-3 border-t border-[#E1E5DF]">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="lime"
                  size="sm"
                  isLoading={isSubmitting}
                  className="font-bold px-5"
                >
                  <Check className="h-4 w-4 me-1 stroke-[3]" />
                  <span>تطبيق الوردية على الأسبوع بالكامل</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
