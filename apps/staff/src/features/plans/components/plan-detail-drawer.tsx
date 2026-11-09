"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Layers,
  Users,
  ExternalLink,
  Info,
} from "lucide-react";
import { Sheet } from "@gym/ui";
import { formatMoney } from "../../../lib/money";
import { plansApi } from "../api";
import type { Plan, Subscription } from "@gym/contracts";

interface PlanDetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  plan: Plan | null;
}

export function PlanDetailDrawer({ isOpen, onClose, plan }: PlanDetailDrawerProps) {
  const [subscribers, setSubscribers] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && plan) {
      setLoading(true);
      plansApi
        .getSubscribersByPlan(plan.id)
        .then((subs) => {
          // Filter subscriptions active, frozen, or pending payment
          const matching = (subs || []).filter(
            (s: any) =>
              s.status === "ACTIVE" || s.status === "FROZEN" || s.status === "PENDING_PAYMENT"
          );
          setSubscribers(matching);
        })
        .finally(() => setLoading(false));
    } else {
      setSubscribers([]);
    }
  }, [isOpen, plan]);

  if (!plan) return null;

  const freezeSummary =
    plan.freezeMaxCount > 0 && plan.freezeMaxTotalDays > 0
      ? `${plan.freezeMaxTotalDays} يوم على ${plan.freezeMaxCount} مرات`
      : "التجميد غير متاح";

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      side="end"
      size="lg"
      title={
        <div className="flex items-center gap-2.5 text-[#14181F]">
          <Layers className="h-6 w-6 text-[#14181F]" />
          <span>{plan.name}</span>
        </div>
      }
      description={`تفاصيل الباقة وقائمة المشتركين الحاليين (${plan.kind})`}
    >
      <div className="space-y-6 pt-2 text-[#14181F]" dir="rtl">
        {/* Immutability Notice as required */}
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2.5">
          <Info className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="leading-relaxed font-medium">
            <b>ملاحظة هامة:</b> تعديل بيانات هذه الباقة مستقبلاً <u>لا يغير</u> الاشتراكات الحالية
            للمشتركين؛ حيث يحتفظ كل اشتراك بنسخته المستقلة (Snapshot) من الأسعار والشروط وقت إتمام
            البيع.
          </div>
        </div>

        {/* Plan Overview Card */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#5B6470]">الحالة</span>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                plan.isActive ? "bg-emerald-100 text-emerald-800" : "bg-gray-200 text-gray-700"
              }`}
            >
              {plan.isActive ? "نشطة (متاحة للبيع)" : "مؤرشفة"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-[#F2F4F1]">
              <span className="text-[#5B6470] block mb-1">السعر</span>
              <b className="text-base font-black text-[#14181F] font-mono">
                {formatMoney(plan.price)}
              </b>
            </div>

            <div className="p-3 rounded-xl bg-[#F2F4F1]">
              <span className="text-[#5B6470] block mb-1">المدة</span>
              <b className="text-base font-black text-[#14181F] font-mono">
                {plan.durationDays} يوم
              </b>
            </div>

            <div className="p-3 rounded-xl bg-[#F2F4F1]">
              <span className="text-[#5B6470] block mb-1">الجلسات / الحصص</span>
              <b className="text-sm font-bold text-[#14181F]">
                {plan.totalSessions ? `${plan.totalSessions} جلسة` : "غير محدود"}
                {plan.sessionsPerWeek ? ` (${plan.sessionsPerWeek}/أسبوع)` : ""}
              </b>
            </div>

            <div className="p-3 rounded-xl bg-[#F2F4F1]">
              <span className="text-[#5B6470] block mb-1">سياسة التجميد</span>
              <b className="text-sm font-bold text-[#14181F]">{freezeSummary}</b>
            </div>
          </div>

          <div className="pt-2 border-t border-[#E1E5DF] space-y-1.5 text-xs text-[#5B6470]">
            <div className="flex justify-between">
              <span>دخول صالة الجيم العامة:</span>
              <b className="text-[#14181F]">
                {plan.grantsFloorAccess ? "نعم (مسموح)" : "لا (جلسات خاصة فقط)"}
              </b>
            </div>
            <div className="flex justify-between">
              <span>الحد الأدنى للدفعة الأولى:</span>
              <b className="text-[#14181F]">
                {plan.minUpfrontPercent !== null ? `${plan.minUpfrontPercent}%` : "افتراضي الجيم"}
              </b>
            </div>
            {plan.kind === "PT" && (
              <div className="flex justify-between">
                <span>دفعات عمولة المدرب:</span>
                <b className="text-[#14181F] font-mono">{plan.commissionMilestones} دفعات</b>
              </div>
            )}
            <div className="flex justify-between">
              <span>دعوات الزوار المجانية:</span>
              <b className="text-[#14181F] font-mono">{plan.maxInvitations || 0} دعوة</b>
            </div>
            <div className="flex justify-between">
              <span>جلسات PT المضمنة:</span>
              <b className="text-[#14181F] font-mono">{plan.freePtSessions || 0} جلسة</b>
            </div>
          </div>
        </div>

        {/* Current Subscribers Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#14181F] flex items-center gap-2">
              <Users className="h-4 w-4 text-[#14181F]" />
              <span>المشتركون الحاليون ({subscribers.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-8 text-center text-xs text-[#5B6470]">جاري تحميل قائمة المشتركين...</div>
          ) : subscribers.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#5B6470] bg-white rounded-2xl border border-[#E1E5DF]">
              لا يوجد مشتركون نشطون حالياً في هذه الباقة.
            </div>
          ) : (
            <div className="space-y-2">
              {subscribers.map((sub: any) => {
                const member = sub.member;
                return (
                  <div
                    key={sub.id}
                    className="p-3 bg-white rounded-xl border border-[#E1E5DF] flex items-center justify-between hover:border-[#14181F] transition-all"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#14181F]">
                          {member?.name || "عضو غير معروف"}
                        </span>
                        {member?.code && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 bg-[#F2F4F1] rounded text-[#5B6470]">
                            {member.code}
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            sub.status === "ACTIVE"
                              ? "bg-emerald-100 text-emerald-800"
                              : sub.status === "FROZEN"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {sub.status === "ACTIVE" ? "نشط" : sub.status === "FROZEN" ? "مجمد" : "معلق"}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#5B6470] mt-1 flex items-center gap-3">
                        <span>من: {sub.startDate?.slice(0, 10)}</span>
                        <span>إلى: {sub.endDate?.slice(0, 10)}</span>
                      </div>
                    </div>

                    {member?.id && (
                      <Link
                        href={`/members/${member.id}`}
                        className="text-xs font-bold text-[#14181F] hover:text-[#C6F24E] flex items-center gap-1 transition-colors p-1.5 rounded-lg hover:bg-[#14181F]"
                      >
                        <span>فتح الملف</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Sheet>
  );
}
