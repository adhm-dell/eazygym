"use client";

import React, { useState, useEffect } from "react";
import { UserCheck, UserPlus, AlertCircle, CheckCircle2, Search } from "lucide-react";
import { membersApi } from "../api";
import type { Subscription, Member, Visitor } from "@gym/contracts";

interface VisitorCheckinDialogProps {
  member: Member;
  subscription?: Subscription;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function VisitorCheckinDialog({
  member,
  subscription,
  isOpen,
  onClose,
  onSuccess,
}: VisitorCheckinDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [visitors, setVisitors] = useState<Visitor[]>([]);
  const [selectedVisitorId, setSelectedVisitorId] = useState<string>("");
  const [isCreatingNew, setIsCreatingNew] = useState(false);

  // New visitor fields
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Allowance stats
  const maxInvitations = subscription?.maxInvitations ?? 3;
  const usedInvitations = subscription?.usedInvitations ?? 0;
  const isUsable = subscription?.status === "ACTIVE";
  const hasRemaining = usedInvitations < maxInvitations;

  useEffect(() => {
    if (!isOpen) return;
    membersApi.listVisitors(searchQuery).then((res) => {
      setVisitors(res);
      if (res[0] && !selectedVisitorId) {
        setSelectedVisitorId(res[0].id);
      }
    });
  }, [isOpen, searchQuery, selectedVisitorId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      let visitorIdToUse = selectedVisitorId;

      if (isCreatingNew) {
        if (!newName.trim() || !newPhone.trim()) {
          setError("اسم ورقم هاتف الزائر مطلوبين");
          setIsSubmitting(false);
          return;
        }

        const createdVisitor = await membersApi.createVisitor({
          name: newName.trim(),
          phone: newPhone.trim(),
          notes: newNotes.trim() || undefined,
        });
        visitorIdToUse = createdVisitor.id;
      }

      if (!visitorIdToUse) {
        setError("يرجى اختيار زائر أو تسجيل زائر جديد");
        setIsSubmitting(false);
        return;
      }

      await membersApi.checkInVisitor({
        visitorId: visitorIdToUse,
        invitedByMemberId: member.id,
        subscriptionId: subscription?.id,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err?.code === "SUBSCRIPTION_NOT_USABLE") {
        setError("اشتراك العضو غير متاح للدعوات (مجمد، متأخر عن السداد، أو غير نشط)");
      } else if (err?.code === "NO_INVITATIONS_LEFT") {
        setError("تم استنفاد جميع دعوات الزوار المتاحة لهذا الاشتراك");
      } else {
        setError(err?.message || "حدث خطأ أثناء تسجيل دخول الزائر");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        <div className="p-5 border-b border-teal-100 bg-teal-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-teal-600 text-white flex items-center justify-center font-bold">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">تسجيل زائر بدعوة عضو</h2>
              <p className="text-xs text-gray-500">
                العضو الداعي: {member.name} ({member.code})
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Quota KPI Card */}
          <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 block">رصيد دعوات الزوار للاشتراك</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className={`text-2xl font-black ${hasRemaining ? "text-teal-600" : "text-red-600"}`}>
                  {usedInvitations}
                </span>
                <span className="text-xs text-gray-400">/ من إجمالي {maxInvitations} دعوة</span>
              </div>
            </div>

            <div className="text-left">
              <span className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                isUsable && hasRemaining
                  ? "bg-teal-100 text-teal-800"
                  : "bg-red-100 text-red-800"
              }`}>
                {!isUsable ? "الاشتراك غير متاح للدعوات" : hasRemaining ? "متاح للدعوة" : "استنفدت الدعوات"}
              </span>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Toggle between select existing vs inline create */}
          <div className="flex rounded-xl bg-gray-100 p-1">
            <button
              type="button"
              onClick={() => setIsCreatingNew(false)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                !isCreatingNew ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              اختيار زائر مسجل سابقاً
            </button>
            <button
              type="button"
              onClick={() => setIsCreatingNew(true)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 ${
                isCreatingNew ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>تسجيل زائر جديد الآن</span>
            </button>
          </div>

          {!isCreatingNew ? (
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute right-3.5 top-3 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث بالاسم أو رقم الهاتف..."
                  className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-600 bg-white"
                />
              </div>

              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {visitors.map((v) => (
                  <label
                    key={v.id}
                    className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-colors ${
                      selectedVisitorId === v.id
                        ? "border-teal-500 bg-teal-50/40 text-teal-900 font-semibold"
                        : "border-gray-200 hover:bg-gray-50 text-gray-700"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="visitor_select"
                        checked={selectedVisitorId === v.id}
                        onChange={() => setSelectedVisitorId(v.id)}
                        className="text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <span className="block text-sm">{v.name}</span>
                        <span className="text-xs text-gray-400">{v.phone}</span>
                      </div>
                    </div>
                    {v.notes && <span className="text-[11px] text-gray-400">{v.notes}</span>}
                  </label>
                ))}
                {visitors.length === 0 && (
                  <p className="text-center py-6 text-xs text-gray-400">
                    لا يوجد زوار مطابقين للبحث. يمكنك الضغط على تسجيل زائر جديد.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-3 p-4 bg-gray-50/70 rounded-xl border border-gray-200">
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  اسم الزائر <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="كريم يوسف منصور"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-600 bg-white"
                  required={isCreatingNew}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  رقم موبايل الزائر <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="01099887766"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-600 bg-white"
                  required={isCreatingNew}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">ملاحظات عن الزائر</label>
                <input
                  type="text"
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="صديق العضو، مهتم بالاشتراك..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-600 bg-white"
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
              disabled={isSubmitting || !isUsable || !hasRemaining}
              className="px-6 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري التسجيل...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>تأكيد تسجيل دخول الزائر</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
