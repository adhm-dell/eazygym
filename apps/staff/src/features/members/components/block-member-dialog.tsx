"use client";

import React, { useState } from "react";
import { ShieldAlert, ShieldCheck, AlertCircle } from "lucide-react";
import { membersApi } from "../api";
import type { Member } from "@gym/contracts";

interface BlockMemberDialogProps {
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Member) => void;
}

export function BlockMemberDialog({ member, isOpen, onClose, onSuccess }: BlockMemberDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isBlocked = member.isBlocked;

  const handleAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isBlocked && !reason.trim()) {
      setError("سبب الحظر مطلوب إجبارياً لتسجيله في السجل الإداري");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      let result: Member;
      if (isBlocked) {
        result = await membersApi.unblockMember(member.id);
      } else {
        result = await membersApi.blockMember(member.id, { reason: reason.trim() });
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تنفيذ الإجراء");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col"
        dir="rtl"
      >
        <div className={`p-5 border-b flex items-center justify-between ${
          isBlocked ? "bg-emerald-50 border-emerald-100" : "bg-red-50 border-red-100"
        }`}>
          <div className="flex items-center gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-bold ${
              isBlocked ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
            }`}>
              {isBlocked ? <ShieldCheck className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">
                {isBlocked ? "فك حظر العضو" : "حظر العضو إدارياً"}
              </h2>
              <p className="text-xs text-gray-500">
                {member.name} ({member.code})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleAction} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {isBlocked ? (
            <div className="space-y-3">
              <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-200 text-sm">
                <span className="font-bold text-gray-800 block mb-1">سبب الحظر الحالي:</span>
                <p className="text-gray-600">{member.blockedReason || "غير محدد"}</p>
              </div>
              <p className="text-xs text-gray-500">
                عند فك الحظر، سيتمكن العضو من تسجيل الدخول والمصادقة على أجهزة الباركود تلقائياً حسب سريان اشتراكه.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                حظر العضو يمنعه فوراً من مسح الدخول عند الأبواب والريسبشن ويظهر تنبيه باللون الأحمر للموظفين.
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  سبب الحظر <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="اكتب سبب الحظر الإداري بالتفصيل..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-600"
                  required
                />
              </div>
            </div>
          )}

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`px-6 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors text-white ${
                isBlocked
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-red-600 hover:bg-red-700"
              }`}
            >
              {isSubmitting
                ? "جاري المعالجة..."
                : isBlocked
                ? "تأكيد فك الحظر"
                : "تأكيد حظر العضو"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

