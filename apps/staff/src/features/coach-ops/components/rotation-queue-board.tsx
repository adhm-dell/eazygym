"use client";

import React, { useState, useEffect, useMemo } from "react";
import { coachOpsApi, type CoachQueueItem, type RotationAssignmentItem } from "../api";
import { Button, useToast } from "@gym/ui";
import {
  Users,
  ArrowUpDown,
  RefreshCw,
  UserCheck,
  Clock,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from "lucide-react";

type FilterStatus = "ALL" | "PENDING" | "ACCEPTED" | "REJECTED" | "SUPERSEDED";

export function RotationQueueBoard() {
  const { toast } = useToast();
  const [queue, setQueue] = useState<CoachQueueItem[]>([]);
  const [assignments, setAssignments] = useState<RotationAssignmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedFilter, setSelectedFilter] = useState<FilterStatus>("ALL");

  // Manual assign modal state
  const [selectedAssignment, setSelectedAssignment] = useState<RotationAssignmentItem | null>(null);
  const [selectedCoachId, setSelectedCoachId] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [queueData, assignData] = await Promise.all([
        coachOpsApi.getRotationQueue(),
        coachOpsApi.getAssignments(),
      ]);
      setQueue(queueData || []);
      setAssignments(assignData || []);
    } catch (err: any) {
      console.error(err);
      toast({ title: "خطأ في تحميل البيانات", description: err.message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAssignment || !selectedCoachId) {
      toast({ title: "اختر المدرب", variant: "error" });
      return;
    }
    setIsAssigning(true);
    try {
      await coachOpsApi.assignManually(selectedAssignment.profileId, {
        coachId: selectedCoachId,
      });
      toast({
        title: "تم تعيين المدرب يدوياً بنجاح",
        description: "تم استبدال الترشيح التلقائي ومنح حصص التوجيه المجانية للعضو فوراً",
        variant: "success",
      });
      setSelectedAssignment(null);
      setSelectedCoachId("");
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ في التعيين", description: err.message, variant: "error" });
    } finally {
      setIsAssigning(false);
    }
  };

  // Find rejected coaches for the selected profile
  const rejectedCoachIdsForSelected = useMemo(() => {
    if (!selectedAssignment) return new Set<string>();
    return new Set(
      assignments
        .filter((a) => a.profileId === selectedAssignment.profileId && a.status === "REJECTED")
        .map((a) => a.coachId)
    );
  }, [selectedAssignment, assignments]);

  const filteredAssignments = useMemo(() => {
    if (selectedFilter === "ALL") return assignments;
    return assignments.filter((a) => a.status === selectedFilter);
  }, [assignments, selectedFilter]);

  const formatWaitingTime = (createdAt: string, status: string) => {
    const created = new Date(createdAt).getTime();
    const now = Date.now();
    const diffMins = Math.max(0, Math.floor((now - created) / 60000));

    if (diffMins < 60) {
      return { text: `${diffMins} دقيقة`, isOverdue: status === "PENDING" && diffMins >= 30 };
    }
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    return {
      text: `${hours} ساعة ${mins > 0 ? `و ${mins} د` : ""}`,
      isOverdue: status === "PENDING" && diffMins >= 30,
    };
  };

  return (
    <div className="space-y-6">
      {/* Top Section: Rotation Queue Strip */}
      <div className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-3 border-b border-[#E1E5DF]">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-[#14181F]" />
            <h3 className="font-bold text-sm text-[#14181F]">
              طابور دور المدربين (Rotation Queue)
            </h3>
          </div>
          <span className="text-xs text-[#5B6470]">
            المدرب التالي على الوردية وغير المعتذر ينال الدور أولاً، ثم يُنقل لآخر الطابور
          </span>
        </div>

        {queue.length === 0 ? (
          <p className="text-xs text-[#5B6470] text-center py-4">
            لا توجد بيانات مسجلة في طابور الدور حالياً
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {queue.map((q) => {
              const isInactive = !q.coach?.isActive;
              const isOnBreak = q.onBreak;
              const isOnShift = q.onShift;

              return (
                <div
                  key={q.id || q.coachId}
                  className="flex items-center gap-3 p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF] min-w-[200px]"
                >
                  <span className="h-7 w-7 rounded-full bg-[#14181F] text-[#C6F24E] text-xs font-bold flex items-center justify-center shrink-0">
                    {q.position}
                  </span>
                  <div className="space-y-1">
                    <h4 className="font-bold text-xs text-[#14181F]">
                      {q.coach?.name || q.coachId}
                    </h4>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isInactive ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-gray-200 text-gray-700">
                          غير نشط
                        </span>
                      ) : isOnBreak ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          في استراحة
                        </span>
                      ) : isOnShift ? (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                          على الوردية
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-700">
                          خارج الوردية
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Inbox: Member Assignments */}
      <div className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#E1E5DF]">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-[#14181F]" />
            <h3 className="font-bold text-sm text-[#14181F]">
              صندوق تكليفات وترشيحات الأعضاء ({assignments.length})
            </h3>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Buttons */}
            <div className="flex items-center gap-1 bg-[#F2F4F1] p-1 rounded-lg text-xs">
              {(
                [
                  { id: "ALL", label: "الكل" },
                  { id: "PENDING", label: "في الانتظار" },
                  { id: "ACCEPTED", label: "مقبول" },
                  { id: "REJECTED", label: "مرفوض" },
                  { id: "SUPERSEDED", label: "مستبدل" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFilter(f.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                    selectedFilter === f.id
                      ? "bg-[#14181F] text-[#C6F24E]"
                      : "text-[#5B6470] hover:text-[#14181F]"
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              className="flex items-center gap-1 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
              <span>تحديث</span>
            </Button>
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div className="p-8 text-center text-[#5B6470] space-y-2">
            <UserCheck className="h-8 w-8 mx-auto text-[#C6F24E]" />
            <p className="text-xs font-medium">لا توجد تكليفات مطابقة للتصفية المحددة</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#E1E5DF] text-[#5B6470]">
                  <th className="py-2.5 px-3 text-start">العضو</th>
                  <th className="py-2.5 px-3 text-start">الباقة / الخطة</th>
                  <th className="py-2.5 px-3 text-start">المدرب المرشح</th>
                  <th className="py-2.5 px-3 text-start">وقت الانتظار</th>
                  <th className="py-2.5 px-3 text-start">المصدر والحالة</th>
                  <th className="py-2.5 px-3 text-start">التاريخ</th>
                  <th className="py-2.5 px-3 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E5DF]">
                {filteredAssignments.map((a) => {
                  const waiting = formatWaitingTime(a.createdAt, a.status);
                  const planName =
                    a.profile?.member?.subscriptions?.[0]?.plan?.name || "اشتراك جديد";

                  return (
                    <tr key={a.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#14181F]">
                          {a.profile?.member?.name || "عضو جديد"}
                        </div>
                        <div className="text-[11px] text-[#5B6470]">
                          {a.profile?.member?.phone || "-"} · كود: {a.profile?.member?.code || "-"}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="font-semibold text-[#14181F] bg-gray-100 px-2 py-0.5 rounded text-[11px]">
                          {planName}
                        </span>
                      </td>
                      <td className="py-3 px-3 font-bold text-[#14181F]">
                        {a.coach?.name || a.coachId}
                      </td>
                      <td className="py-3 px-3">
                        {waiting.isOverdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700 animate-pulse">
                            <AlertTriangle className="h-3 w-3" />
                            تأخر: {waiting.text}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-[#5B6470]">
                            <Clock className="h-3 w-3" />
                            {waiting.text}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-3 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              a.status === "ACCEPTED"
                                ? "bg-[#C6F24E] text-[#14181F]"
                                : a.status === "REJECTED"
                                ? "bg-red-100 text-red-800"
                                : a.status === "SUPERSEDED"
                                ? "bg-gray-100 text-gray-600 line-through"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {a.status === "ACCEPTED"
                              ? "مقبول"
                              : a.status === "REJECTED"
                              ? "مرفوض"
                              : a.status === "SUPERSEDED"
                              ? "مستبدل"
                              : "في الانتظار"}
                          </span>
                          <span className="px-1.5 py-0.5 rounded text-[9px] bg-slate-100 text-slate-700">
                            {a.source === "ROTATION" ? "تلقائي" : "يدوي"}
                          </span>
                        </div>
                        {a.rejectionReason && (
                          <p className="text-[10px] text-red-600 font-medium">
                            سبب الرفض: {a.rejectionReason}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-[#5B6470] text-[11px]">
                        {new Date(a.createdAt).toLocaleDateString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                          month: "short",
                          day: "numeric",
                        })}
                      </td>
                      <td className="py-3 px-3 text-end">
                        {(a.status === "PENDING" || a.status === "REJECTED") && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedAssignment(a);
                              setSelectedCoachId(a.coachId);
                            }}
                            className="text-xs h-7 font-bold border-[#14181F] text-[#14181F] hover:bg-[#14181F] hover:text-[#C6F24E]"
                          >
                            <RotateCcw className="h-3 w-3 me-1" />
                            تعيين يدوي
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Assign Modal */}
      {selectedAssignment && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-md my-auto max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col text-start">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[#E1E5DF] shrink-0 bg-white">
              <h3 className="font-bold text-sm text-[#14181F] flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" />
                <span>تعيين مدرب يدوياً للعضو</span>
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-[#5B6470]">
                  {selectedAssignment.profile?.member?.name || "عضو"}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedAssignment(null)}
                  className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleManualAssign} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
                <p className="text-xs text-[#5B6470] leading-relaxed">
                  سيؤدي التعيين اليدوي إلى استبدال أي ترشيح سابق (SUPERSEDED) وتكليف المدرب
                  المختار ومنحه حصص التوجيه المجانية مباشرة.
                </p>

                <div>
                  <label className="text-xs font-bold text-[#14181F] block mb-1">
                    اختر المدرب المطلوب
                  </label>
                  <select
                    value={selectedCoachId}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full text-xs p-2.5 border rounded-lg bg-white border-[#E1E5DF] focus:outline-none focus:border-[#14181F]"
                    required
                  >
                    <option value="">اختر المدرب...</option>
                    {queue.map((q) => {
                      const hasRejected = rejectedCoachIdsForSelected.has(q.coachId);
                      return (
                        <option key={q.coachId} value={q.coachId}>
                          {q.coach?.name || q.coachId}
                          {hasRejected ? " ⚠️ (اعتذر عن هذا العضو مسبقاً)" : ""}
                          {q.onShift ? " [على الوردية]" : " [خارج الوردية]"}
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t border-[#E1E5DF] shrink-0 bg-white">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedAssignment(null)}
                  disabled={isAssigning}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="lime"
                  size="sm"
                  isLoading={isAssigning}
                  className="font-bold"
                >
                  تأكيد التعيين
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
