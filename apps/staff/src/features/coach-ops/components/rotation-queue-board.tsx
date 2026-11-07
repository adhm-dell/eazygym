"use client";

import React, { useState, useEffect } from "react";
import { coachOpsApi, type RotationAssignmentItem } from "../api";
import { Button, Input, useToast } from "@gym/ui";
import { Users, ArrowUpDown, CheckCircle, XCircle, AlertCircle, RefreshCw, UserCheck } from "lucide-react";

export function RotationQueueBoard() {
  const { toast } = useToast();
  const [queue, setQueue] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<RotationAssignmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Manual assign modal state
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
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
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleManualAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileId || !selectedCoachId) {
      toast({ title: "اختر المدرب", variant: "error" });
      return;
    }
    setIsAssigning(true);
    try {
      await coachOpsApi.assignManually(selectedProfileId, {
        coachId: selectedCoachId,
      });
      toast({
        title: "تم تعيين المدرب يدوياً بنجاح",
        description: "تم استبدال الترشيح التلقائي ومنح حصص التدريب المجانية للعضو",
        variant: "success",
      });
      setSelectedProfileId(null);
      setSelectedCoachId("");
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    } finally {
      setIsAssigning(false);
    }
  };

  const pendingAssignments = assignments.filter((a) => a.status === "PENDING");

  return (
    <div className="space-y-6">
      {/* Top Section: Rotation Queue Strip */}
      <div className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF]">
          <div className="flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-[#14181F]" />
            <h3 className="font-bold text-sm text-[#14181F]">
              طابور دور المدربين (Rotation Queue)
            </h3>
          </div>
          <span className="text-xs text-[#5B6470]">
            المدرب في الترتيب الأقل يتم ترشيحه أولاً للعضو الجديد
          </span>
        </div>

        {queue.length === 0 ? (
          <p className="text-xs text-[#5B6470] text-center py-4">
            لا توجد بيانات مسجلة في طابور الدور
          </p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {queue.map((q, idx) => (
              <div
                key={q.id || idx}
                className="flex items-center gap-2 p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]"
              >
                <span className="h-6 w-6 rounded-full bg-[#14181F] text-[#C6F24E] text-xs font-bold flex items-center justify-center">
                  {q.position}
                </span>
                <div>
                  <h4 className="font-bold text-xs text-[#14181F]">
                    {q.coach?.name || q.coachId}
                  </h4>
                  <span className="text-[10px] text-[#5B6470]">
                    {q.coach?.isActive ? "نشط" : "غير نشط"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inbox: New Members Waiting for Coach Assignment */}
      <div className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF]">
          <h3 className="font-bold text-sm text-[#14181F] flex items-center gap-2">
            <Users className="h-5 w-5 text-[#14181F]" />
            <span>صندوق تكليفات الأعضاء الجدد ({assignments.length})</span>
          </h3>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            className="flex items-center gap-1 text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>تحديث</span>
          </Button>
        </div>

        {assignments.length === 0 ? (
          <div className="p-8 text-center text-[#5B6470] space-y-2">
            <UserCheck className="h-8 w-8 mx-auto text-[#C6F24E]" />
            <p className="text-xs font-medium">لا توجد تكليفات أعضاء حالياً</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#E1E5DF] text-[#5B6470]">
                  <th className="py-2.5 px-3 text-start">العضو</th>
                  <th className="py-2.5 px-3 text-start">المدرب المرشح</th>
                  <th className="py-2.5 px-3 text-start">المصدر</th>
                  <th className="py-2.5 px-3 text-start">الحالة</th>
                  <th className="py-2.5 px-3 text-start">التاريخ</th>
                  <th className="py-2.5 px-3 text-end">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E5DF]">
                {assignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-[#14181F]">
                      {a.profile?.member?.name || "عضو"} (
                      {a.profile?.member?.phone || "-"})
                    </td>
                    <td className="py-2.5 px-3 font-bold text-[#14181F]">
                      {a.coach?.name || a.coachId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">
                        {a.source === "ROTATION" ? "تلقائي (الدور)" : "يدوي"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
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
                      {a.rejectionReason && (
                        <span className="text-[10px] text-red-600 block">
                          سبب الرفض: {a.rejectionReason}
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#5B6470]">
                      {new Date(a.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-2.5 px-3 text-end">
                      {a.status === "PENDING" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedProfileId(a.profileId);
                            setSelectedCoachId(a.coachId);
                          }}
                          className="text-xs h-7 font-bold border-[#14181F] text-[#14181F] hover:bg-[#14181F] hover:text-[#C6F24E]"
                        >
                          تعيين يدوي
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Manual Assign Modal */}
      {selectedProfileId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4 text-start">
            <h3 className="font-bold text-sm text-[#14181F]">
              تعيين مدرب يدوياً للعضو
            </h3>
            <p className="text-xs text-[#5B6470]">
              سيؤدي التعيين اليدوي إلى استبدال الترشيح التلقائي الحالي (SUPERSEDED)
              ومنح حصص التدريب المجانية للعضو فوراً.
            </p>
            <form onSubmit={handleManualAssign} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#14181F] block mb-1">
                  اختر المدرب
                </label>
                <select
                  value={selectedCoachId}
                  onChange={(e) => setSelectedCoachId(e.target.value)}
                  className="w-full text-xs p-2.5 border rounded-lg bg-white"
                  required
                >
                  <option value="">اختر المدرب...</option>
                  {queue.map((q) => (
                    <option key={q.coachId} value={q.coachId}>
                      {q.coach?.name || q.coachId}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedProfileId(null)}
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

