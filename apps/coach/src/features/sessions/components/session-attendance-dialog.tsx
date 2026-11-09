"use client";

import React, { useState, useEffect } from "react";
import { Dialog, Button, Badge } from "@gym/ui";
import { sessionsApi, type CoachSession, type SessionParticipant } from "../api";
import { CheckCircle2, XCircle, AlertTriangle, Users, Dumbbell } from "lucide-react";

interface SessionAttendanceDialogProps {
  isOpen: boolean;
  onClose: () => void;
  session: CoachSession | null;
  onSuccess: (msg: string) => void;
}

export function SessionAttendanceDialog({
  isOpen,
  onClose,
  session,
  onSuccess,
}: SessionAttendanceDialogProps) {
  const [attendedIds, setAttendedIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize all participants as attended by default
  useEffect(() => {
    if (session) {
      const initial = session.participants.map((p) => p.memberId);
      setAttendedIds(initial);
      setError(null);
    }
  }, [session]);

  if (!session) return null;

  const toggleParticipant = (memberId: string) => {
    setAttendedIds((prev) =>
      prev.includes(memberId) ? prev.filter((id) => id !== memberId) : [...prev, memberId]
    );
  };

  const handleRecordAttendance = async () => {
    if (attendedIds.length === 0) {
      setError("يرجى اختيار متدرب واحد على الأقل، أو تسجيل غياب (No-Show)");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sessionsApi.recordAttendance(session.id, attendedIds);
      onSuccess(`تم تسجيل حضور ${attendedIds.length} متدرب بنجاح وخصم الجلسات من اشتراكاتهم.`);
      onClose();
    } catch (err: any) {
      setError(err.message || "فشل تسجيل الحضور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordNoShow = async () => {
    if (!confirm("هل أنت متأكد من تسجيل غياب الجلسة (No-Show)؟ لن يتم خصم أي رصيد من المتدرب.")) {
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await sessionsApi.recordNoShow(session.id);
      onSuccess("تم تسجيل الجلسة كغياب (No-Show). لم يتم خصم أي رصيد من المتدربين (No-shows are free).");
      onClose();
    } catch (err: any) {
      setError(err.message || "فشل تسجيل الغياب");
    } finally {
      setIsSubmitting(false);
    }
  };

  const countDeductions = attendedIds.length;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل حضور الجلسة التدريبية"
      description={`جلسة ${session.type === "PRIVATE" ? "خاصة (PT)" : "جماعية"} · ${new Date(session.startTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}`}
      footer={
        <div className="flex flex-col sm:flex-row gap-2 justify-between w-full">
          <Button
            variant="outline"
            onClick={handleRecordNoShow}
            disabled={isSubmitting}
            className="text-xs text-amber-700 border-amber-300 hover:bg-amber-50"
          >
            تسجيل غياب (No-Show - مجاني)
          </Button>

          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="text-xs">
              إلغاء
            </Button>
            <Button
              variant="lime"
              onClick={handleRecordAttendance}
              disabled={isSubmitting || attendedIds.length === 0}
              className="text-xs font-bold"
            >
              {isSubmitting ? "جاري الخصم..." : `تأكيد حضور (${countDeductions})`}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3.5 text-xs">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        {/* Clear Deductions Confirmation Banner */}
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">تأكيد الخصم:</p>
            <p className="text-[11px] mt-0.5">
              سيتم خصم <b className="font-black text-black">{countDeductions}</b> جلسة من رصيد الاشتراكات لكل متدرب يتم تحديد حضوره.
              أما في حال عدم حضور المتدربين (No-Show)، فلا يتم خصم أي رصيد.
            </p>
          </div>
        </div>

        {/* Participants Selection Checklist */}
        <div>
          <label className="font-bold text-[#14181F] block mb-2">
            المتدربون المسجلون بالجلسة ({session.participants.length}):
          </label>
          <div className="space-y-2">
            {session.participants.length === 0 ? (
              <p className="text-center py-4 text-[#5B6470] bg-[#F2F4F1] rounded-xl">
                لا يوجد متدربون مسجلون في هذه الجلسة.
              </p>
            ) : (
              session.participants.map((p) => {
                const isChecked = attendedIds.includes(p.memberId);
                return (
                  <div
                    key={p.id}
                    onClick={() => toggleParticipant(p.memberId)}
                    className={`flex items-center justify-between p-2.5 rounded-xl border transition-all cursor-pointer ${
                      isChecked
                        ? "bg-[#C6F24E]/15 border-[#C6F24E]"
                        : "bg-[#F2F4F1] border-[#E1E5DF] opacity-60"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // handled by parent onClick
                        className="rounded accent-[#14181F] w-4 h-4"
                      />
                      <div>
                        <p className="font-bold text-[#14181F]">
                          {p.member?.name || "متدرب"}
                        </p>
                        <p className="text-[10px] text-[#5B6470]">
                          المصدر: {p.source === "PT_LINKED" ? "اشتراك PT" : p.source === "FREE_GRANT" ? "جلسة مجانية" : "حصة جماعية"}
                        </p>
                      </div>
                    </div>

                    <Badge variant={isChecked ? "g" : "default"}>
                      {isChecked ? "حاضر (يُخصم)" : "غائب"}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </Dialog>
  );
}

