"use client";

import React, { useState, useEffect } from "react";
import { coachOpsApi, type CoachBreakItem } from "../api";
import { Button, Input, useToast } from "@gym/ui";
import { Coffee, AlertTriangle, Check, X, Bell, Play, Timer, UserCheck } from "lucide-react";

const ARABIC_DENIAL_MESSAGES: Record<string, string> = {
  ANOTHER_COACH_ON_BREAK: "يوجد مدرب آخر في استراحة حالياً. الحد الأقصى مدرب واحد في نفس الوقت.",
  NOT_ON_SHIFT: "المدرب ليس على الوردية حالياً.",
  DAILY_LIMIT_REACHED: "وصل المدرب للحد الأقصى من الاستراحات اليومية (استراحتان في اليوم).",
  COACH_ALREADY_ON_BREAK: "المدرب لديه استراحة نشطة بالفعل.",
  COACH_CAN_ONLY_REQUEST_FOR_SELF: "يمكن للمدرب طلب استراحة لنفسه فقط.",
  NOT_PENDING: "الطلب لم يعد معلقاً.",
  NOT_ACTIVE: "الاستراحة ليست نشطة.",
};

export function BreaksBoard() {
  const { toast } = useToast();
  const [breaks, setBreaks] = useState<CoachBreakItem[]>([]);
  const [activeBreak, setActiveBreak] = useState<CoachBreakItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Reject modal state
  const [rejectingBreakId, setRejectingBreakId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Start break modal state
  const [isStartModalOpen, setIsStartModalOpen] = useState(false);
  const [targetCoachId, setTargetCoachId] = useState("");
  const [startReason, setStartReason] = useState("غداء");
  const [isStarting, setIsStarting] = useState(false);

  // Live timer for active break
  const [elapsedMinutes, setElapsedMinutes] = useState(0);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await coachOpsApi.getBreaks();
      setBreaks(data.breaks || []);
      setActiveBreak(data.activeBreak || null);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Poll every 15s
    return () => clearInterval(interval);
  }, []);

  // Update timer every 10s if active break
  useEffect(() => {
    if (!activeBreak?.startedAt) {
      setElapsedMinutes(0);
      return;
    }
    const updateElapsed = () => {
      const started = new Date(activeBreak.startedAt!).getTime();
      const diff = Math.floor((Date.now() - started) / 60000);
      setElapsedMinutes(diff);
    };
    updateElapsed();
    const timer = setInterval(updateElapsed, 5000);
    return () => clearInterval(timer);
  }, [activeBreak]);

  const handleStartBreak = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCoachId) {
      toast({ title: "اختر المدرب أولاً", variant: "error" });
      return;
    }
    setIsStarting(true);
    try {
      await coachOpsApi.requestBreak({
        coachId: targetCoachId,
        reason: startReason,
      });
      toast({
        title: "تم بدء الاستراحة بنجاح",
        description: "أصبح المدرب في استراحة نشطة الآن",
        variant: "success",
      });
      setIsStartModalOpen(false);
      loadData();
    } catch (err: any) {
      const msg = ARABIC_DENIAL_MESSAGES[err.message] || err.message;
      toast({
        title: "تعذر بدء الاستراحة",
        description: msg,
        variant: "error",
      });
    } finally {
      setIsStarting(false);
    }
  };

  const handleApprove = async (breakId: string) => {
    try {
      await coachOpsApi.approveBreak(breakId);
      toast({ title: "تمت الموافقة وبدء الاستراحة", variant: "success" });
      loadData();
    } catch (err: any) {
      const msg = ARABIC_DENIAL_MESSAGES[err.message] || err.message;
      toast({ title: "خطأ", description: msg, variant: "error" });
    }
  };

  const handleReject = async () => {
    if (!rejectingBreakId || !rejectReason.trim()) {
      toast({ title: "سبب الرفض إلزامي", variant: "error" });
      return;
    }
    setIsRejecting(true);
    try {
      await coachOpsApi.rejectBreak(rejectingBreakId, { reason: rejectReason.trim() });
      toast({ title: "تم رفض طلب الاستراحة", variant: "info" });
      setRejectingBreakId(null);
      setRejectReason("");
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    } finally {
      setIsRejecting(false);
    }
  };

  const handleEndBreak = async (breakId: string) => {
    try {
      await coachOpsApi.endBreak(breakId);
      toast({ title: "تم إنهاء الاستراحة وعودة المدرب", variant: "success" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    }
  };

  const handleNotifyReturn = async (coachId: string) => {
    try {
      await coachOpsApi.notifyReturn(coachId);
      toast({
        title: "تم إرسال إشعار العودة للمدرب بنجاح",
        description: "تم تنبيه المدرب بقطع الاستراحة والعودة للاستقبال",
        variant: "info",
      });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    }
  };

  const pendingBreaks = breaks.filter((b) => b.status === "PENDING");
  const isOverdue = elapsedMinutes > 30;

  return (
    <div className="space-y-6">
      {/* Active Break Live Banner */}
      {activeBreak ? (
        <div
          className={`p-5 rounded-2xl border transition-all ${
            isOverdue
              ? "bg-red-50 border-red-300 text-red-950"
              : "bg-[#14181F] text-white border-[#14181F]"
          } shadow-sm flex flex-col md:flex-row items-center justify-between gap-4`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`h-12 w-12 rounded-xl flex items-center justify-center font-bold ${
                isOverdue
                  ? "bg-red-600 text-white animate-pulse"
                  : "bg-[#C6F24E] text-[#14181F]"
              }`}
            >
              <Coffee className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-base">
                  مدرب في استراحة: {activeBreak.coach?.name || activeBreak.coachId}
                </span>
                {isOverdue && (
                  <span className="px-2 py-0.5 rounded text-xs font-bold bg-red-600 text-white">
                    تجاوز الوقت المسموح!
                  </span>
                )}
              </div>
              <p className={`text-xs ${isOverdue ? "text-red-700" : "text-[#C9CFD6]"}`}>
                السبب: {activeBreak.reason || "استراحة عامة"} · مدة الاستراحة المحددة: 30 دقيقة
              </p>
            </div>
          </div>

          {/* Live Timer & Action buttons */}
          <div className="flex items-center gap-3">
            <div
              className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono font-bold text-sm ${
                isOverdue
                  ? "bg-red-100 border-red-300 text-red-900"
                  : "bg-[#262D38] border-white/10 text-[#C6F24E]"
              }`}
            >
              <Timer className="h-4 w-4" />
              <span>{elapsedMinutes} دقيقة مستهلكة</span>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleNotifyReturn(activeBreak.coachId)}
              className="flex items-center gap-1.5 border-amber-400 text-amber-700 hover:bg-amber-50 font-bold"
            >
              <Bell className="h-4 w-4" />
              <span>تنبيه بالعودة</span>
            </Button>

            <Button
              variant="lime"
              size="sm"
              onClick={() => handleEndBreak(activeBreak.id)}
              className="font-bold"
            >
              إنهاء الاستراحة
            </Button>
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-white border border-[#E1E5DF] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold">
              <Check className="h-5 w-5" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-[#14181F]">
                لا توجد استراحات نشطة حالياً
              </h4>
              <p className="text-xs text-[#5B6470]">
                جميع المدربين متاحون، ويمكن بدء استراحة لمدرب واحد في كل مرة.
              </p>
            </div>
          </div>

          <Button
            variant="lime"
            size="sm"
            onClick={() => setIsStartModalOpen(true)}
            className="flex items-center gap-1.5 font-bold"
          >
            <Play className="h-4 w-4" />
            <span>بدء استراحة لمدرب</span>
          </Button>
        </div>
      )}

      {/* Pending Requests List */}
      <div className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF]">
          <h3 className="font-bold text-sm text-[#14181F] flex items-center gap-2">
            <span>طلبات الاستراحة المعلقة</span>
            {pendingBreaks.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-white">
                {pendingBreaks.length}
              </span>
            )}
          </h3>
        </div>

        {pendingBreaks.length === 0 ? (
          <p className="text-xs text-[#5B6470] py-4 text-center">
            لا توجد طلبات استراحة معلقة في انتظار الموافقة.
          </p>
        ) : (
          <div className="space-y-2">
            {pendingBreaks.map((b) => (
              <div
                key={b.id}
                className="flex items-center justify-between p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]"
              >
                <div>
                  <h4 className="font-bold text-xs text-[#14181F]">
                    {b.coach?.name || b.coachId}
                  </h4>
                  <p className="text-[11px] text-[#5B6470]">
                    السبب: {b.reason || "بدون سبب"} · تم الطلب:{" "}
                    {new Date(b.requestedAt).toLocaleTimeString("ar-EG", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="lime"
                    size="sm"
                    onClick={() => handleApprove(b.id)}
                    className="flex items-center gap-1 font-bold text-xs h-8"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>موافقة</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setRejectingBreakId(b.id)}
                    className="flex items-center gap-1 font-bold text-xs h-8 text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    <span>رفض</span>
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Breaks History Table */}
      <div className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4">
        <h3 className="font-bold text-sm text-[#14181F]">سجل الاستراحات اليومية</h3>
        {breaks.length === 0 ? (
          <p className="text-xs text-[#5B6470] text-center py-4">لا يوجد سجل استراحات</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-[#E1E5DF] text-[#5B6470]">
                  <th className="py-2 px-3 text-start">المدرب</th>
                  <th className="py-2 px-3 text-start">الحالة</th>
                  <th className="py-2 px-3 text-start">السبب</th>
                  <th className="py-2 px-3 text-start">وقت البدء</th>
                  <th className="py-2 px-3 text-start">وقت الانتهاء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E5DF]">
                {breaks.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-[#14181F]">
                      {b.coach?.name || b.coachId}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          b.status === "ACTIVE"
                            ? "bg-[#C6F24E] text-[#14181F]"
                            : b.status === "COMPLETED"
                            ? "bg-slate-200 text-slate-800"
                            : b.status === "REJECTED"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {b.status === "ACTIVE"
                          ? "نشطة"
                          : b.status === "COMPLETED"
                          ? "مكتملة"
                          : b.status === "REJECTED"
                          ? "مرفوضة"
                          : "معلقة"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-[#5B6470]">
                      {b.reason || "-"}
                      {b.rejectionReason && (
                        <span className="text-red-600 block text-[10px]">
                          (الرفض: {b.rejectionReason})
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-[#5B6470]">
                      {b.startedAt
                        ? new Date(b.startedAt).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-[#5B6470]">
                      {b.endedAt
                        ? new Date(b.endedAt).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectingBreakId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4 text-start">
            <h3 className="font-bold text-sm text-[#14181F]">سبب رفض الاستراحة</h3>
            <p className="text-xs text-[#5B6470]">
              يرجى إدخال سبب الرفض؛ وسيتم إخطار المدرب فوراً (لن تحتسب الاستراحة المرفوضة من الحد اليومي).
            </p>
            <Input
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="مثال: ضغط عمل أو وقت ذروة"
              required
            />
            <div className="flex justify-end gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setRejectingBreakId(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleReject}
                isLoading={isRejecting}
              >
                تأكيد الرفض
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Start Break Direct Modal */}
      {isStartModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white rounded-2xl p-6 shadow-xl space-y-4 text-start">
            <h3 className="font-bold text-sm text-[#14181F]">بدء استراحة مباشرة لمدرب</h3>
            <p className="text-xs text-[#5B6470]">
              سيتم بدء الاستراحة مباشرة بدون انتظار الموافقة.
            </p>
            <form onSubmit={handleStartBreak} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-[#14181F] block mb-1">
                  معرّف المدرب (Staff ID)
                </label>
                <Input
                  value={targetCoachId}
                  onChange={(e) => setTargetCoachId(e.target.value)}
                  placeholder="staff_coach"
                  required
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#14181F] block mb-1">
                  السبب
                </label>
                <Input
                  value={startReason}
                  onChange={(e) => setStartReason(e.target.value)}
                  placeholder="غداء أو صلاة"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsStartModalOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="lime"
                  size="sm"
                  isLoading={isStarting}
                  className="font-bold"
                >
                  بدء الاستراحة الآن
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
