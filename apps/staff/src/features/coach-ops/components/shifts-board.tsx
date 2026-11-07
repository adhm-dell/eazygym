"use client";

import React, { useState, useEffect } from "react";
import { coachOpsApi, type CoachShiftItem } from "../api";
import { Button, Input, useToast } from "@gym/ui";
import { Clock, Plus, Trash2, CheckCircle2, UserCheck, AlertCircle } from "lucide-react";

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
  const [isLoading, setIsLoading] = useState(true);

  // New shift modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [coachId, setCoachId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("18:00");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [shiftsData, onShiftData] = await Promise.all([
        coachOpsApi.getShifts(),
        coachOpsApi.getCoachesOnShift(),
      ]);
      setShifts(shiftsData);
      setOnShiftCoaches(onShiftData.onShiftCoachIds || []);
      if (shiftsData.length > 0 && !coachId) {
        setCoachId(shiftsData[0]?.coachId || "");
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

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coachId) {
      toast({ title: "برجاء اختيار المدرب", variant: "error" });
      return;
    }
    setIsSubmitting(true);
    try {
      await coachOpsApi.createShift({
        coachId,
        dayOfWeek,
        startTime,
        endTime,
      });
      toast({
        title: "تم إضافة الوردية بنجاح",
        description: `وردية ${DAYS_OF_WEEK[dayOfWeek]} من ${startTime} إلى ${endTime}`,
        variant: "success",
      });
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      toast({
        title: "تعذر إضافة الوردية",
        description: err.message || "حدث خطأ أثناء إضافة الوردية",
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

  // Unique coaches from shifts
  const uniqueCoaches = Array.from(
    new Map(shifts.map((s) => [s.coach.id, s.coach])).values()
  );

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
            shifts
              .filter((s) => onShiftCoaches.includes(s.coachId))
              .map((s) => s.coach)
              .filter(
                (c, idx, arr) => arr.findIndex((x) => x.id === c.id) === idx
              )
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
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1 font-bold"
          >
            <Plus className="h-4 w-4" />
            <span>إضافة وردية</span>
          </Button>
        </div>
      </div>

      {/* Shifts Weekly Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-[#5B6470]">
          <div className="animate-spin h-7 w-7 border-2 border-[#14181F] border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs">جاري تحميل جدول الورديات...</p>
        </div>
      ) : shifts.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-xl border border-[#E1E5DF] text-[#5B6470] space-y-3">
          <Clock className="h-10 w-10 mx-auto text-[#C6F24E]" />
          <h4 className="font-bold text-sm text-[#14181F]">لا توجد ورديات مسجلة</h4>
          <p className="text-xs">
            اضغط على &quot;إضافة وردية&quot; لتعيين أوقات عمل المدربين الأسبوعية.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {uniqueCoaches.map((coach) => {
            const coachShifts = shifts.filter((s) => s.coachId === coach.id);
            const isOnShiftNow = onShiftCoaches.includes(coach.id);

            return (
              <div
                key={coach.id}
                className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4"
              >
                <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF]">
                  <div>
                    <h4 className="font-bold text-sm text-[#14181F] flex items-center gap-2">
                      <span>{coach.name}</span>
                      {isOnShiftNow && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#C6F24E] text-[#14181F]">
                          على الوردية
                        </span>
                      )}
                    </h4>
                    <p className="text-xs text-[#5B6470]">{coach.email}</p>
                  </div>
                </div>

                {/* Days Table */}
                <div className="space-y-1.5">
                  {DAYS_OF_WEEK.map((dayName, dayIndex) => {
                    const dayShifts = coachShifts.filter(
                      (s) => s.dayOfWeek === dayIndex
                    );

                    return (
                      <div
                        key={dayIndex}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#F2F4F1]/60 text-xs"
                      >
                        <span className="font-bold text-[#14181F] w-16">
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
                                  <span className="text-[#14181F]">
                                    {s.startTime} - {s.endTime}
                                  </span>
                                  {isOvernight && (
                                    <span className="text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded font-sans font-bold">
                                      ليلي (لليوم التالي)
                                    </span>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeactivate(s.id)}
                                    className="text-red-500 hover:text-red-700 cursor-pointer p-0.5"
                                    title="حذف الوردية"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-[#5B6470]/60 italic">إجازة</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Shift Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-xl space-y-5 text-start">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-base text-[#14181F]">
                إضافة وردية عمل لمدرب
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-[#14181F] block mb-1.5">
                  المدرب
                </label>
                <select
                  value={coachId}
                  onChange={(e) => setCoachId(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg bg-white"
                  required
                >
                  <option value="">اختر المدرب...</option>
                  {uniqueCoaches.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.email})
                    </option>
                  ))}
                  {uniqueCoaches.length === 0 && (
                    <option value="staff_coach">كابتن أحمد (staff_coach)</option>
                  )}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-[#14181F] block mb-1.5">
                  يوم الوردية
                </label>
                <select
                  value={dayOfWeek}
                  onChange={(e) => setDayOfWeek(parseInt(e.target.value, 10))}
                  className="w-full text-xs p-2.5 border rounded-lg bg-white"
                >
                  {DAYS_OF_WEEK.map((d, idx) => (
                    <option key={idx} value={idx}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="وقت البداية (HH:MM)"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="10:00"
                  required
                />
                <Input
                  label="وقت النهاية (HH:MM)"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="18:00"
                  required
                />
              </div>
              {startTime > endTime && (
                <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>
                    الوردية ستعبر منتصف الليل وتنتهي في اليوم التالي (وردية ليلية).
                  </span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsModalOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="lime"
                  size="sm"
                  isLoading={isSubmitting}
                  className="font-bold"
                >
                  حفظ الوردية
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

