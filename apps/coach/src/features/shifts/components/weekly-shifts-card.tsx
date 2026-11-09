"use client";

import React, { useMemo } from "react";
import type { CoachShift } from "../api";
import { Calendar, Clock, CheckCircle2, ShieldAlert } from "lucide-react";
import { Badge } from "@gym/ui";

interface WeeklyShiftsCardProps {
  shifts: CoachShift[];
  isLoading?: boolean;
}

const DAY_NAMES = [
  "الأحد",
  "الإثنين",
  "الثلاثاء",
  "الأربعاء",
  "الخميس",
  "الجمعة",
  "السبت",
];

export function WeeklyShiftsCard({ shifts, isLoading }: WeeklyShiftsCardProps) {
  const todayDay = new Date().getDay();

  // Group shifts by dayOfWeek (0 to 6)
  const shiftsByDay = useMemo(() => {
    const map: Record<number, CoachShift[]> = {};
    for (let i = 0; i < 7; i++) map[i] = [];
    shifts.forEach((s) => {
      if (s.isActive) {
        map[s.dayOfWeek]?.push(s);
      }
    });
    return map;
  }, [shifts]);

  const totalWeeklyHours = useMemo(() => {
    let totalMinutes = 0;
    shifts.forEach((s) => {
      if (!s.isActive) return;
      const startParts = s.startTime.split(":").map(Number);
      const endParts = s.endTime.split(":").map(Number);
      const startH = startParts[0] ?? 0;
      const startM = startParts[1] ?? 0;
      const endH = endParts[0] ?? 0;
      const endM = endParts[1] ?? 0;
      let diff = (endH * 60 + endM) - (startH * 60 + startM);
      if (diff < 0) diff += 24 * 60; // overnight shift
      totalMinutes += diff;
    });
    return (totalMinutes / 60).toFixed(1);
  }, [shifts]);

  const hasShiftToday = (shiftsByDay[todayDay]?.length ?? 0) > 0;

  return (
    <div className="bg-white border border-[#E1E5DF] rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#14181F]">
          <Calendar className="w-4 h-4 text-[#D97706]" />
          <span>جدول المناوبات الأسبوعية (Shift Timetable)</span>
        </div>
        <span className="text-[11px] font-mono text-[#5B6470]">
          إجمالي: <b className="text-[#14181F]">{totalWeeklyHours}</b> ساعة/أسبوع
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-xs text-[#5B6470]">جاري تحميل جدول المناوبات...</div>
      ) : shifts.length === 0 ? (
        <div className="text-center py-4 text-xs text-[#5B6470] bg-[#F2F4F1] rounded-xl">
          لم يتم تعيين أي مناوبات عمل أسبوعية لك بعد.
        </div>
      ) : (
        <div className="space-y-1.5">
          {DAY_NAMES.map((name, dayIndex) => {
            const dayShifts = shiftsByDay[dayIndex] || [];
            const isToday = dayIndex === todayDay;

            return (
              <div
                key={dayIndex}
                className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-all ${
                  isToday
                    ? "bg-[#C6F24E]/15 border-[#C6F24E] font-bold"
                    : dayShifts.length > 0
                    ? "bg-[#F9FAF8] border-[#E1E5DF]"
                    : "bg-[#F2F4F1]/60 border-transparent opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-14 text-[12px] ${isToday ? "text-[#14181F]" : "text-[#5B6470]"}`}>
                    {name}
                  </span>
                  {isToday && (
                    <Badge variant="lime" className="text-[10px] px-1.5 py-0">
                      اليوم
                    </Badge>
                  )}
                </div>

                <div>
                  {dayShifts.length === 0 ? (
                    <span className="text-[11px] text-[#5B6470]/70">إجازة أسبوعية</span>
                  ) : (
                    <div className="flex flex-col gap-1 items-end">
                      {dayShifts.map((s) => (
                        <span
                          key={s.id}
                          className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-[#E1E5DF] text-[#14181F]"
                        >
                          {s.startTime} - {s.endTime}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
