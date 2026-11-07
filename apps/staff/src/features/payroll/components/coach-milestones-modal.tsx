"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  Badge,
  Chip,
  Button,
} from "@gym/ui";
import { Dumbbell, Calendar } from "lucide-react";
import { fetchCoachCommission } from "../api";

interface CoachMilestonesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coach: { id: string; name: string } | null;
  monthStr: string; // "2026-01"
}

export function CoachMilestonesModal({
  open,
  onOpenChange,
  coach,
  monthStr,
}: CoachMilestonesModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !coach) return;
    setLoading(true);
    fetchCoachCommission(coach.id, monthStr)
      .then((res) => setData(res))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [open, coach, monthStr]);

  if (!coach) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge variant="g">مدفوع ومقفل (PAID)</Badge>;
      case "EARNED":
        return <Badge variant="g">مستحق (EARNED)</Badge>;
      case "PENDING":
        return <Badge variant="w">معلق (PENDING)</Badge>;
      case "VOID":
        return <Badge variant="r">ملغي (VOID)</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <Dialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      maxWidth="2xl"
      className="bg-white text-[#14181F] rounded-2xl p-6"
      title={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 text-xl font-bold">
            <Dumbbell className="h-5 w-5 text-[#14181F]" />
            <span>تفاصيل محطات عمولة الكابتن: {coach.name}</span>
          </div>
          <Chip>
            <Calendar className="h-3.5 w-3.5 me-1 text-[#5B6470]" />
            <span>شهر {monthStr}</span>
          </Chip>
        </div>
      }
      footer={
        <div className="flex justify-end w-full">
          <Button variant="default" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">
            إغلاق
          </Button>
        </div>
      }
    >
      <div className="py-2" dir="rtl">
        {loading ? (
          <div className="py-12 text-center text-sm text-[#5B6470]">جاري تحميل محطات الكابتن...</div>
        ) : !data ? (
          <div className="py-12 text-center text-sm text-[#B3261E]">تعذر تحميل البيانات</div>
        ) : (
          <div className="space-y-4">
            {/* Summary KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
                <span className="text-[11px] text-[#5B6470] block font-medium">الراتب الأساسي</span>
                <span className="text-base font-bold text-[#14181F] tabular-nums">
                  {data.coach?.baseSalary?.toLocaleString() || 0} ج.م
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
                <span className="text-[11px] text-[#5B6470] block font-medium">المحصل الفعلي (PT)</span>
                <span className="text-base font-bold text-[#14181F] tabular-nums">
                  {data.collectedRevenue?.toLocaleString() || 0} ج.م
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
                <span className="text-[11px] text-[#5B6470] block font-medium">الشريحة الحالية</span>
                <span className="text-base font-bold text-[#14181F] tabular-nums">
                  {data.currentTier?.percent || 0}%
                </span>
              </div>

              <div className="p-3 rounded-xl bg-[#C6F24E]/20 border border-[#C6F24E] text-[#14181F]">
                <span className="text-[11px] font-bold block opacity-80">إجمالي العمولة</span>
                <span className="text-base font-black tabular-nums">
                  {data.commissionAmount?.toLocaleString() || 0} ج.م
                </span>
              </div>
            </div>

            {/* Next Tier Progress */}
            {data.nextTier && (
              <div className="p-3 rounded-xl bg-[#F9FAF9] border border-[#E1E5DF] text-xs">
                <div className="flex justify-between font-bold mb-1">
                  <span>الشريحة التالية: {data.nextTier.percent}% (عند {data.nextTier.minRevenue?.toLocaleString()} ج.م)</span>
                  <span className="text-[#5B6470]">متبقي {data.nextTier.neededRevenue?.toLocaleString()} ج.م محصل</span>
                </div>
                <div className="h-2 rounded-full bg-[#E1E5DF] overflow-hidden">
                  <div
                    className="h-full bg-[#14181F] rounded-full"
                    style={{
                      width: `${Math.min(100, Math.round((data.collectedRevenue / data.nextTier.minRevenue) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Milestones Schedule Table */}
            <div>
              <h4 className="text-sm font-bold text-[#14181F] mb-2">جدول المحطات للاشتراكات الشخصية (PT)</h4>

              {data.entries?.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5B6470] bg-[#F2F4F1] rounded-xl">
                  لا توجد محطات مستحقة للكابتن في هذا الشهر
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#E1E5DF] rounded-xl">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead className="bg-[#F2F4F1] border-b border-[#E1E5DF] text-[#5B6470] font-semibold">
                      <tr>
                        <th className="py-2 px-3 text-start">المشترك</th>
                        <th className="py-2 px-3 text-start">الباقة</th>
                        <th className="py-2 px-3 text-center">المحطة</th>
                        <th className="py-2 px-3 text-end">القيمة</th>
                        <th className="py-2 px-3 text-end">المحصل (Base)</th>
                        <th className="py-2 px-3 text-center">الحصة</th>
                        <th className="py-2 px-3 text-start">تاريخ الاستحقاق</th>
                        <th className="py-2 px-3 text-center">الحالة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E5DF]">
                      {data.entries?.map((entry: any) => (
                        <tr key={entry.id} className="hover:bg-[#F9FAF9]">
                          <td className="py-2 px-3 font-bold text-[#14181F]">
                            {entry.member?.name || "مشترك"}
                            <span className="block text-[10px] text-[#5B6470] font-normal">
                              كود: {entry.member?.code || "—"}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#5B6470]">{entry.plan?.name || "PT"}</td>
                          <td className="py-2 px-3 text-center font-bold text-[#14181F]">
                            #{entry.milestoneIndex}
                          </td>
                          <td className="py-2 px-3 text-end font-medium tabular-nums">
                            {entry.baseAmount?.toLocaleString()} ج.م
                          </td>
                          <td className="py-2 px-3 text-end font-bold text-[#14181F] tabular-nums">
                            {entry.allocatedBase?.toLocaleString()} ج.م
                          </td>
                          <td className="py-2 px-3 text-center font-semibold text-[#5B6470]">
                            {Math.round(entry.shareBps / 100)}%
                          </td>
                          <td className="py-2 px-3 text-start text-[#5B6470] tabular-nums">
                            {new Date(entry.dueDate).toLocaleDateString("ar-EG")}
                          </td>
                          <td className="py-2 px-3 text-center">{getStatusBadge(entry.status)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
