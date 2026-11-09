"use client";

import React, { useState } from "react";
import { Dialog, Button } from "@gym/ui";
import { assignmentsApi, type FitnessAssignment } from "../api";
import { AlertCircle } from "lucide-react";

interface RejectAssignmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: FitnessAssignment | null;
  onSuccess: (msg: string) => void;
}

export function RejectAssignmentDialog({
  isOpen,
  onClose,
  assignment,
  onSuccess,
}: RejectAssignmentDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!assignment) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("سبب الاعتذار مطلوب إجباري لإعادة المتدرب إلى قائمة الانتظار");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await assignmentsApi.rejectAssignment(assignment.id, reason.trim());
      onSuccess("تم الاعتذار عن تدريب العضو وإعادته إلى قائمة الانتظار العامة بنجاح.");
      setReason("");
      onClose();
    } catch (err: any) {
      setError(err.message || "فشل رفض طلب التدريب");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="الاعتذار عن تدريب العضو"
      description={`الاعتذار عن قبول العضو: ${assignment.member?.name || "عضو"} (${assignment.member?.phone || "-"})`}
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="text-xs">
            إلغاء
          </Button>
          <Button
            variant="destructive"
            onClick={handleSubmit}
            disabled={isSubmitting || !reason.trim()}
            className="text-xs font-bold"
          >
            {isSubmitting ? "جاري الإرسال..." : "تأكيد الاعتذار"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-[11px]">
          تنبيه: سيتم نقل العضو تلقائياً للمدرب التالي في قائمة الانتظار (Rotation Queue). يلزم تقديم سبب وجيه.
        </div>

        <div>
          <label className="font-bold text-[#14181F] block mb-1">
            سبب الاعتذار * (مطلوب)
          </label>
          <textarea
            required
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: الجدول ممتلئ في هذه الأوقات، أو تخصص غير مناسب..."
            className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
          />
        </div>
      </form>
    </Dialog>
  );
}

