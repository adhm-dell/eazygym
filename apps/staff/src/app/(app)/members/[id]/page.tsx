"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowRight,
  Phone,
  Mail,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
  Edit3,
  ShoppingCart,
} from "lucide-react";
import { formatMoney } from "../../../../lib/money";
import { membersApi } from "../../../../features/members/api";
import { EditMemberDialog } from "../../../../features/members/components/edit-member-dialog";
import { BlockMemberDialog } from "../../../../features/members/components/block-member-dialog";
import { FreezeDialog } from "../../../../features/members/components/freeze-dialog";
import { UnfreezeDialog } from "../../../../features/members/components/unfreeze-dialog";
import { ChangeCoachDialog } from "../../../../features/members/components/change-coach-dialog";
import { CancelSubscriptionDialog } from "../../../../features/members/components/cancel-subscription-dialog";
import { LogSessionDialog } from "../../../../features/members/components/log-session-dialog";
import { VisitorCheckinDialog } from "../../../../features/members/components/visitor-checkin-dialog";
import { CollectBalanceDialog } from "../../../../features/members/components/collect-balance-dialog";
import { MemberFitnessTab } from "../../../../features/members/components/member-fitness-tab";
import type { MemberProfileDetail, Subscription, InvoiceDetail } from "@gym/mock-data";

export default function MemberProfilePage() {
  const params = useParams();
  const memberId = params?.id as string;

  const [profile, setProfile] = useState<MemberProfileDetail | null>(null);
  const [activeTab, setActiveTab] = useState<
    "overview" | "subscriptions" | "invoices" | "wallet" | "attendance" | "freeze" | "notes" | "fitness"
  >("overview");
  const [isLoading, setIsLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [isAddingNote, setIsAddingNote] = useState(false);

  // Modals state
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);
  const [isVisitorOpen, setIsVisitorOpen] = useState(false);
  const [selectedSubForFreeze, setSelectedSubForFreeze] = useState<Subscription | null>(null);
  const [selectedSubForUnfreeze, setSelectedSubForUnfreeze] = useState<Subscription | null>(null);
  const [selectedSubForChangeCoach, setSelectedSubForChangeCoach] = useState<Subscription | null>(null);
  const [selectedSubForCancel, setSelectedSubForCancel] = useState<Subscription | null>(null);
  const [selectedSubForLogSession, setSelectedSubForLogSession] = useState<Subscription | null>(null);
  const [selectedInvoiceForCollect, setSelectedInvoiceForCollect] = useState<InvoiceDetail | null>(null);

  const fetchProfile = async () => {
    if (!memberId) return;
    setIsLoading(true);
    try {
      const res = await membersApi.getMemberProfile(memberId);
      setProfile(res);
    } catch (err) {
      console.error("Error fetching profile:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [memberId]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim() || !profile) return;
    setIsAddingNote(true);
    try {
      await membersApi.addMemberNote(profile.id, newNote.trim());
      setNewNote("");
      fetchProfile();
    } catch (err) {
      console.error(err);
    } finally {
      setIsAddingNote(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-12 text-center text-gray-500" dir="rtl">
        <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#14181F] rounded-full mx-auto mb-3" />
        <p className="text-sm">جاري تحميل ملف العضو...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-12 text-center text-gray-500" dir="rtl">
        <h2 className="text-lg font-bold text-gray-800">العضو غير موجود</h2>
        <Link href="/members" className="text-xs text-blue-600 hover:underline mt-2 inline-block">
          العودة لقائمة الأعضاء
        </Link>
      </div>
    );
  }

  const isBlocked = profile.isBlocked;
  const activeGymSub = profile.activeSubscriptions.find((s) => s.kind === "GYM");

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Back button and Profile Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <Link
            href="/members"
            className="p-2.5 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors"
            title="الرجوع لقائمة المشتركين"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="flex items-center gap-3.5">
            <div className="h-14 w-14 rounded-2xl bg-gray-900 text-[#C6F24E] font-black text-xl flex items-center justify-center border border-gray-300 shadow-sm shrink-0">
              {profile.name.slice(0, 2)}
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-black text-gray-900">{profile.name}</h1>
                <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 font-bold border border-gray-200">
                  #{profile.code}
                </span>
                {isBlocked && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-800 border border-red-200">
                    محظور إدارياً
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-1">
                <span className="flex items-center gap-1 font-mono">
                  <Phone className="h-3.5 w-3.5" />
                  {profile.phone}
                </span>
                {profile.email && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {profile.email}
                    </span>
                  </>
                )}
                <span>·</span>
                <span>تاريخ التسجيل: {new Date(profile.createdAt).toLocaleDateString("ar-EG")}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsVisitorOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 text-xs font-bold border border-teal-200 transition-colors flex items-center gap-1.5"
          >
            <UserCheck className="h-3.5 w-3.5" />
            <span>دعوة زائر</span>
          </button>

          <Link
            href={`/pos?memberId=${profile.id}`}
            className="px-4 py-2 rounded-xl bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F] text-xs font-bold shadow-sm transition-colors flex items-center gap-1.5"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>بيع اشتراك / POS</span>
          </Link>

          <button
            onClick={() => setIsEditOpen(true)}
            className="p-2 rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-100 transition-colors"
            title="تعديل البيانات"
          >
            <Edit3 className="h-4 w-4" />
          </button>

          <button
            onClick={() => setIsBlockOpen(true)}
            className={`p-2 rounded-xl border transition-colors ${
              isBlocked
                ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                : "border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50"
            }`}
            title={isBlocked ? "فك الحظر" : "حظر العضو"}
          >
            {isBlocked ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Blocked Alert Banner if blocked */}
      {isBlocked && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-red-900 block text-sm">العضو محظور حالياً من دخول الصالة</span>
            <p className="text-xs text-red-700 mt-0.5">سبب الحظر: {profile.blockedReason || "غير محدد"}</p>
          </div>
        </div>
      )}

      {/* 4 Quick KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 font-medium block">رصيد المحفظة الداخلي</span>
          <span className="text-2xl font-black text-gray-900 mt-1 block">
            {formatMoney(profile.walletBalance)}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 font-medium block">الاشتراكات النشطة</span>
          <span className="text-2xl font-black text-emerald-600 mt-1 block">
            {profile.activeSubscriptions.length} باقة
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">المديونية المستحقة</span>
            {profile.totalRemainingDebt > 0 && (
              <span className="text-[10px] bg-red-100 text-red-800 font-bold px-1.5 py-0.5 rounded">
                متأخر
              </span>
            )}
          </div>
          <span className={`text-2xl font-black mt-1 block ${profile.totalRemainingDebt > 0 ? "text-red-600" : "text-gray-900"}`}>
            {formatMoney(profile.totalRemainingDebt)}
          </span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-gray-200 shadow-sm">
          <span className="text-xs text-gray-500 font-medium block">إجمالي مرات الدخول</span>
          <span className="text-2xl font-black text-gray-900 mt-1 block">
            {profile.totalVisits} زيارة
          </span>
        </div>
      </div>

      {/* 7 Tabs Navigation */}
      <div className="border-b border-gray-200 overflow-x-auto">
        <nav className="flex space-s-2 min-w-max pb-1">
          {[
            { id: "overview", label: "نظرة عامة" },
            { id: "subscriptions", label: `الاشتراكات (${profile.allSubscriptions.length})` },
            { id: "invoices", label: `الفواتير والمدفوعات (${profile.invoices.length})` },
            { id: "wallet", label: "المحفظة" },
            { id: "attendance", label: `سجل الحضور (${profile.attendance.length})` },
            { id: "freeze", label: `سجل التجميد (${profile.freezeHistory.length})` },
            { id: "fitness", label: "الملف البدني و InBody" },
            { id: "notes", label: "الملاحظات" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 text-sm font-bold rounded-xl transition-colors ${
                activeTab === tab.id
                  ? "bg-[#14181F] text-white shadow-sm"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === "overview" && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
            {/* Active Subscriptions Summary */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-gray-900">الاشتراكات السارية</h3>
                <Link
                  href={`/pos?memberId=${profile.id}`}
                  className="text-xs text-blue-600 hover:underline font-bold"
                >
                  + اشتراك جديد
                </Link>
              </div>

              {profile.activeSubscriptions.length === 0 ? (
                <div className="p-8 text-center text-gray-400 bg-gray-50 rounded-xl">
                  لا توجد باقات سارية حالياً لهذا العضو.
                </div>
              ) : (
                <div className="space-y-3">
                  {profile.activeSubscriptions.map((sub) => (
                    <div
                      key={sub.id}
                      className="p-4 rounded-xl border border-gray-200 bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-gray-900 text-sm">
                            {sub.plan?.name || sub.kind}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {sub.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                          من {new Date(sub.startDate).toLocaleDateString("ar-EG")} حتى{" "}
                          {new Date(sub.endDate).toLocaleDateString("ar-EG")}{" "}
                          <span className="font-bold text-gray-800">({sub.daysLeft} يوم متبقي)</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {sub.kind === "PT" && (
                          <button
                            onClick={() => setSelectedSubForLogSession(sub)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold border border-indigo-200 transition-colors"
                          >
                            تسجيل جلسة ({sub.sessionsLeft} متبقي)
                          </button>
                        )}
                        <button
                          onClick={() => {
                            if (sub.status === "FROZEN") {
                              setSelectedSubForUnfreeze(sub);
                            } else {
                              setSelectedSubForFreeze(sub);
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors flex items-center gap-1"
                        >
                          <Snowflake className="h-3.5 w-3.5" />
                          <span>{sub.status === "FROZEN" ? "إلغاء التجميد" : "تجميد"}</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recent Attendance */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3">
              <h3 className="text-base font-bold text-gray-900">آخر عمليات مسح الدخول</h3>
              <div className="space-y-2">
                {profile.attendance.slice(0, 5).map((log) => (
                  <div
                    key={log.id}
                    className="p-3 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`h-2.5 w-2.5 rounded-full ${log.allowed ? "bg-emerald-500" : "bg-red-500"}`} />
                      <span className="font-bold text-gray-800">
                        {log.allowed ? "دخول ناجح" : `مرفوض (${log.reason})`}
                      </span>
                      {log.planName && <span className="text-gray-500">· {log.planName}</span>}
                    </div>
                    <span className="text-gray-400 font-mono">
                      {new Date(log.scannedAt).toLocaleString("ar-EG")}
                    </span>
                  </div>
                ))}
                {profile.attendance.length === 0 && (
                  <p className="text-xs text-gray-400 py-4 text-center">لا يوجد سجل حضور مسجل بعد</p>
                )}
              </div>
            </div>
          </div>

          {/* Member Details Sidebar */}
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-3 text-xs">
              <h3 className="text-sm font-bold text-gray-900 pb-2 border-b border-gray-100">
                البيانات الشخصية
              </h3>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">النوع / الجنس</span>
                <span className="font-bold text-gray-800">{profile.gender === "FEMALE" ? "أنثى" : "ذكر"}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">تاريخ الميلاد</span>
                <span className="font-bold text-gray-800">
                  {profile.birthDate ? new Date(profile.birthDate).toLocaleDateString("ar-EG") : "غير مسجل"}
                </span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-100">
                <span className="text-gray-500">إجمالي المصروفات</span>
                <span className="font-bold text-gray-900">{formatMoney(profile.totalSpent)}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">دعوات الزوار المستخدمة</span>
                <span className="font-bold text-teal-700">{profile.visitorAttendances.length} دعوة</span>
              </div>
            </div>

            {/* Quick Notes preview */}
            <div className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-2">
              <h3 className="text-sm font-bold text-gray-900">ملاحظات العضو</h3>
              <p className="text-xs text-gray-600 bg-gray-50 p-3 rounded-xl whitespace-pre-wrap">
                {profile.notes || "لا توجد ملاحظات مسجلة."}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Subscriptions */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-gray-900">جميع اشتراكات العضو (الحالية والسابقة)</h3>
            <Link
              href={`/pos?memberId=${profile.id}`}
              className="px-4 py-2 rounded-xl bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F] text-xs font-bold transition-colors"
            >
              + إضافة اشتراك جديد
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {profile.allSubscriptions.map((sub) => {
              const isOverdue = sub.isOverdue || sub.status === "SUSPENDED_UNPAID";
              return (
                <div
                  key={sub.id}
                  className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-base text-gray-900">
                        {sub.plan?.name || sub.kind}
                      </span>
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                          sub.status === "ACTIVE"
                            ? "bg-emerald-100 text-emerald-800"
                            : sub.status === "FROZEN"
                            ? "bg-blue-100 text-blue-800"
                            : isOverdue
                            ? "bg-red-100 text-red-800"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {sub.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-gray-400 block">فترة الاشتراك:</span>
                        <span>
                          {new Date(sub.startDate).toLocaleDateString("ar-EG")} ←{" "}
                          {new Date(sub.endDate).toLocaleDateString("ar-EG")}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">الأيام المتبقية:</span>
                        <span className="font-bold text-gray-900">{sub.daysLeft ?? "—"} يوم</span>
                      </div>
                    </div>

                    {sub.kind === "PT" && (
                      <div className="grid grid-cols-2 gap-2 text-xs text-gray-600 pt-2 border-t border-gray-100">
                        <div>
                          <span className="text-gray-400 block">المدرب المعين:</span>
                          <span className="font-bold text-purple-700">
                            {sub.currentCoach?.name || "كابتن أحمد"}
                          </span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">الجلسات المتبقية:</span>
                          <span className="font-bold text-indigo-700">
                            {sub.sessionsLeft ?? sub.totalSessions ?? 0} جلسة
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-gray-100">
                      <div>
                        <span className="text-gray-400 block">السعر والمدفوع:</span>
                        <span className="font-bold text-gray-900">
                          {formatMoney(sub.price)} ({formatMoney(sub.collected ?? sub.price)} محصل)
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-400 block">رصيد التجميد:</span>
                        <span>
                          {sub.freezeUsedCount ?? 0}/{sub.freezeMaxCount ?? 2} مرة ({sub.freezeUsedDays ?? 0}/
                          {sub.freezeMaxTotalDays ?? 15} يوم)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for this sub */}
                  <div className="pt-4 border-t border-gray-100 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/pos?memberId=${profile.id}&planId=${sub.planId}&startDate=${sub.endDate}`}
                      className="px-3 py-1.5 rounded-lg bg-[#C6F24E]/40 hover:bg-[#C6F24E] text-[#14181F] text-xs font-bold transition-colors"
                      title="يبدأ الاشتراك الجديد فور انتهاء هذا الاشتراك بدون تداخل أيام"
                    >
                      تجديد مبكر
                    </Link>

                    {sub.kind === "PT" && (
                      <>
                        <button
                          onClick={() => setSelectedSubForChangeCoach(sub)}
                          className="px-2.5 py-1.5 rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 text-xs font-bold transition-colors"
                        >
                          تغيير المدرب
                        </button>
                        <button
                          onClick={() => setSelectedSubForLogSession(sub)}
                          className="px-2.5 py-1.5 rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 text-xs font-bold transition-colors"
                        >
                          تسجيل جلسة
                        </button>
                      </>
                    )}

                    <button
                      onClick={() => {
                        if (sub.status === "FROZEN") {
                          setSelectedSubForUnfreeze(sub);
                        } else {
                          setSelectedSubForFreeze(sub);
                        }
                      }}
                      className="px-2.5 py-1.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-xs font-bold transition-colors"
                    >
                      {sub.status === "FROZEN" ? "إلغاء التجميد" : "تجميد"}
                    </button>

                    {sub.status !== "CANCELLED" && (
                      <button
                        onClick={() => setSelectedSubForCancel(sub)}
                        className="px-2.5 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-bold transition-colors"
                      >
                        إلغاء
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Invoices & Payments */}
      {activeTab === "invoices" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden space-y-4 p-5">
          <h3 className="text-base font-bold text-gray-900">سجل الفواتير والمدفوعات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                <tr>
                  <th className="p-3">رقم الفاتورة</th>
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">العناصر</th>
                  <th className="p-3">الإجمالي</th>
                  <th className="p-3">المدفوع</th>
                  <th className="p-3">المتبقي</th>
                  <th className="p-3">الحالة</th>
                  <th className="p-3 text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profile.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50">
                    <td className="p-3 font-mono font-bold text-gray-900">#{inv.number}</td>
                    <td className="p-3 text-gray-500">
                      {new Date(inv.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="p-3 text-gray-700">
                      {inv.items.map((i) => i.description).join("، ") || "اشتراك"}
                    </td>
                    <td className="p-3 font-bold text-gray-900">{formatMoney(inv.total)}</td>
                    <td className="p-3 text-emerald-700 font-semibold">{formatMoney(inv.collectedAmount)}</td>
                    <td className="p-3 font-bold text-red-600">
                      {inv.remainingAmount > 0 ? formatMoney(inv.remainingAmount) : "—"}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        inv.status === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : inv.status === "VOID"
                          ? "bg-gray-100 text-gray-600"
                          : "bg-amber-100 text-amber-800"
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      {inv.remainingAmount > 0 && (
                        <button
                          onClick={() => setSelectedInvoiceForCollect(inv)}
                          className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors"
                        >
                          تحصيل
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Wallet */}
      {activeTab === "wallet" && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-xs text-gray-500 font-medium">رصيد المحفظة الحالي</span>
              <span className="text-3xl font-black text-gray-900 mt-1 block">
                {formatMoney(profile.walletBalance)}
              </span>
              <p className="text-xs text-gray-400 mt-1">
                يمكن استخدام رصيد المحفظة للشراء من البار أو سداد رسوم الاشتراكات والخدمات تلقائياً.
              </p>
            </div>
            <Link
              href={`/shift`}
              className="px-4 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors"
            >
              إيداع / سند قبض بالمحفظة
            </Link>
          </div>
        </div>
      )}

      {/* Tab 5: Attendance */}
      {activeTab === "attendance" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-5 space-y-4">
          <h3 className="text-base font-bold text-gray-900">سجل الدخول والحضور التفصيلي</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                <tr>
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">حالة الإذن</th>
                  <th className="p-3">السبب / كود القرار</th>
                  <th className="p-3">الباقة المستخدمة</th>
                  <th className="p-3">نقطة المسح</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profile.attendance.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50/50">
                    <td className="p-3 text-gray-700 font-mono">
                      {new Date(log.scannedAt).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        log.allowed ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"
                      }`}>
                        {log.allowed ? "مسموح" : "مرفوض"}
                      </span>
                    </td>
                    <td className="p-3 font-semibold text-gray-900">{log.reason}</td>
                    <td className="p-3 text-gray-500">{log.planName || "—"}</td>
                    <td className="p-3 text-gray-400">الريسبشن الرئيسي</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 6: Freeze History */}
      {activeTab === "freeze" && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden p-5 space-y-4">
          <h3 className="text-base font-bold text-gray-900">سجل تجميد الاشتراكات</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-600 font-bold">
                <tr>
                  <th className="p-3">تاريخ البدء</th>
                  <th className="p-3">تاريخ الانتهاء</th>
                  <th className="p-3">الأيام المستهلكة</th>
                  <th className="p-3">السبب</th>
                  <th className="p-3">المسؤول</th>
                  <th className="p-3">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {profile.freezeHistory.map((f) => (
                  <tr key={f.id} className="hover:bg-gray-50/50">
                    <td className="p-3 text-gray-700 font-mono">
                      {new Date(f.startedAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="p-3 text-gray-700 font-mono">
                      {f.endedAt ? new Date(f.endedAt).toLocaleDateString("ar-EG") : "مفتوح حتى الآن"}
                    </td>
                    <td className="p-3 font-bold text-blue-700">
                      {f.days !== null ? `${f.days} يوم` : "قيد الاحتساب"}
                    </td>
                    <td className="p-3 text-gray-600">{f.reason || "تجميد عادي"}</td>
                    <td className="p-3 text-gray-500">{f.createdByName || "سارة حسن"}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full font-bold ${
                        f.endedAt ? "bg-gray-100 text-gray-700" : "bg-blue-100 text-blue-800"
                      }`}>
                        {f.endedAt ? "منتهي" : "مجمد حالياً"}
                      </span>
                    </td>
                  </tr>
                ))}
                {profile.freezeHistory.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-400">
                      لا توجد عمليات تجميد سابقة لهذا العضو
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 7: Notes */}
      {activeTab === "notes" && (
        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
          <h3 className="text-base font-bold text-gray-900">سجل الملاحظات الإدارية والرياضية</h3>

          <form onSubmit={handleAddNote} className="space-y-3">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="اكتب ملاحظة جديدة عن العضو..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black bg-gray-50/50"
              required
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={isAddingNote || !newNote.trim()}
                className="px-5 py-2 rounded-xl bg-gray-900 hover:bg-black text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {isAddingNote ? "جاري الحفظ..." : "إضافة الملاحظة"}
              </button>
            </div>
          </form>

          <div className="pt-4 border-t border-gray-100">
            <h4 className="text-xs font-bold text-gray-500 mb-2">الملاحظات المسجلة:</h4>
            <div className="bg-gray-50 p-4 rounded-xl text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
              {profile.notes || "لا توجد ملاحظات سابقة مسجلة."}
            </div>
          </div>
        </div>
      )}

      {/* Tab 8: Fitness Profile & InBody Assessments */}
      {activeTab === "fitness" && (
        <MemberFitnessTab memberId={memberId} />
      )}

      {/* Modals & Dialogs */}
      <EditMemberDialog
        member={profile}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={() => fetchProfile()}
      />

      <BlockMemberDialog
        member={profile}
        isOpen={isBlockOpen}
        onClose={() => setIsBlockOpen(false)}
        onSuccess={() => fetchProfile()}
      />

      <VisitorCheckinDialog
        member={profile}
        subscription={activeGymSub || profile.activeSubscriptions[0]}
        isOpen={isVisitorOpen}
        onClose={() => setIsVisitorOpen(false)}
        onSuccess={() => fetchProfile()}
      />

      {selectedSubForFreeze && (
        <FreezeDialog
          subscription={selectedSubForFreeze}
          member={profile}
          isOpen={true}
          onClose={() => setSelectedSubForFreeze(null)}
          onSuccess={() => {
            fetchProfile();
            setSelectedSubForFreeze(null);
          }}
        />
      )}

      {selectedSubForUnfreeze && (
        <UnfreezeDialog
          subscription={selectedSubForUnfreeze}
          member={profile}
          isOpen={true}
          onClose={() => setSelectedSubForUnfreeze(null)}
          onSuccess={() => {
            fetchProfile();
            setSelectedSubForUnfreeze(null);
          }}
        />
      )}

      {selectedSubForChangeCoach && (
        <ChangeCoachDialog
          subscription={selectedSubForChangeCoach}
          member={profile}
          isOpen={true}
          onClose={() => setSelectedSubForChangeCoach(null)}
          onSuccess={() => {
            fetchProfile();
            setSelectedSubForChangeCoach(null);
          }}
        />
      )}

      {selectedSubForCancel && (
        <CancelSubscriptionDialog
          subscription={selectedSubForCancel}
          member={profile}
          isOpen={true}
          onClose={() => setSelectedSubForCancel(null)}
          onSuccess={() => {
            fetchProfile();
            setSelectedSubForCancel(null);
          }}
        />
      )}

      {selectedSubForLogSession && (
        <LogSessionDialog
          subscription={selectedSubForLogSession}
          member={profile}
          isOpen={true}
          onClose={() => setSelectedSubForLogSession(null)}
          onSuccess={() => {
            fetchProfile();
            setSelectedSubForLogSession(null);
          }}
        />
      )}

      {selectedInvoiceForCollect && (
        <CollectBalanceDialog
          invoice={selectedInvoiceForCollect}
          member={profile}
          isOpen={true}
          onClose={() => setSelectedInvoiceForCollect(null)}
          onSuccess={() => {
            fetchProfile();
            setSelectedInvoiceForCollect(null);
          }}
        />
      )}
    </div>
  );
}
