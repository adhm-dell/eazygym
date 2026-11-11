"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  UserPlus,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  AlertTriangle,
  ShoppingCart,
  Phone,
  CheckCircle2,
} from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { membersApi } from "../../../features/members/api";
import { CreateMemberDialog } from "../../../features/members/components/create-member-dialog";
import { BlockMemberDialog } from "../../../features/members/components/block-member-dialog";
import { FreezeDialog } from "../../../features/members/components/freeze-dialog";
import { UnfreezeDialog } from "../../../features/members/components/unfreeze-dialog";
import type { Member, Staff, Subscription } from "@gym/contracts";

export default function MembersListPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [coaches, setCoaches] = useState<Staff[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [planKindFilter, setPlanKindFilter] = useState("ALL");
  const [coachFilter, setCoachFilter] = useState("ALL");
  const [expiringInDays, setExpiringInDays] = useState<string>("ALL");
  const [onlyOverdue, setOnlyOverdue] = useState(false);

  // Modal states
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedMemberForBlock, setSelectedMemberForBlock] = useState<Member | null>(null);
  const [selectedSubForFreeze, setSelectedSubForFreeze] = useState<{ sub: Subscription; member: Member } | null>(null);
  const [selectedSubForUnfreeze, setSelectedSubForUnfreeze] = useState<{ sub: Subscription; member: Member } | null>(null);

  const fetchMembers = async () => {
    setIsLoading(true);
    try {
      const res = await membersApi.listMembers({
        query: searchQuery || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        planKind: planKindFilter !== "ALL" ? planKindFilter : undefined,
        coachId: coachFilter !== "ALL" ? coachFilter : undefined,
        expiringInDays: expiringInDays !== "ALL" ? parseInt(expiringInDays, 10) : undefined,
        overdue: onlyOverdue ? true : undefined,
      });
      setMembers(res);
    } catch (err) {
      console.error("Error fetching members:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    membersApi.listStaff().then((s) => setCoaches(s.filter((st) => st.role === "COACH")));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMembers();
    }, 150);
    return () => clearTimeout(timer);
  }, [searchQuery, statusFilter, planKindFilter, coachFilter, expiringInDays, onlyOverdue]);

  // Overall counters
  const stats = useMemo(() => {
    const total = members.length;
    const active = members.filter((m) => m.derivedStatus === "ACTIVE").length;
    const overdue = members.filter((m) => (m.totalRemainingDebt ?? 0) > 0 || m.derivedStatus === "PAYMENT_OVERDUE").length;
    const frozen = members.filter((m) => m.derivedStatus === "FROZEN").length;
    const blocked = members.filter((m) => m.isBlocked).length;
    return { total, active, overdue, frozen, blocked };
  }, [members]);

  const handleMemberFreezeClick = async (member: Member) => {
    try {
      const subs = await membersApi.getMemberSubscriptions(member.id);
      const active = subs.find((s) => s.status === "ACTIVE" || s.status === "FROZEN");
      if (active) {
        if (active.status === "FROZEN") {
          setSelectedSubForUnfreeze({ sub: active, member });
        } else {
          setSelectedSubForFreeze({ sub: active, member });
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-gray-900 flex items-center gap-2.5">
            <Users className="h-7 w-7 text-[#14181F]" />
            <span>إدارة المشتركين والملفات</span>
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            دليل الأعضاء، تتبع الاشتراكات، تجميد الباقات، وتحصيل المديونيات
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsCreateOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F] text-sm font-bold shadow-sm transition-all flex items-center gap-2"
          >
            <UserPlus className="h-4 w-4" />
            <span>تسجيل عضو جديد</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
        <div
          onClick={() => {
            setStatusFilter("ALL");
            setOnlyOverdue(false);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "ALL" && !onlyOverdue
              ? "bg-[#14181F] text-white border-[#14181F] shadow-md"
              : "bg-white text-gray-800 border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className="text-xs opacity-75 block font-medium">إجمالي المشتركين</span>
          <span className="text-2xl font-black block mt-1">{stats.total}</span>
        </div>

        <div
          onClick={() => {
            setStatusFilter("ACTIVE");
            setOnlyOverdue(false);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "ACTIVE" && !onlyOverdue
              ? "bg-emerald-600 text-white border-emerald-600 shadow-md"
              : "bg-white text-gray-800 border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className="text-xs opacity-75 block font-medium">النشطين حالياً</span>
          <span className="text-2xl font-black block mt-1 text-emerald-600">{stats.active}</span>
        </div>

        <div
          onClick={() => {
            setOnlyOverdue(true);
            setStatusFilter("ALL");
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            onlyOverdue
              ? "bg-red-600 text-white border-red-600 shadow-md"
              : "bg-white text-gray-800 border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className="text-xs opacity-75 block font-medium">مديونيات مستحقة</span>
          <span className="text-2xl font-black block mt-1 text-red-600">{stats.overdue}</span>
        </div>

        <div
          onClick={() => {
            setStatusFilter("FROZEN");
            setOnlyOverdue(false);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "FROZEN"
              ? "bg-blue-600 text-white border-blue-600 shadow-md"
              : "bg-white text-gray-800 border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className="text-xs opacity-75 block font-medium">الاشتراكات المجمدة</span>
          <span className="text-2xl font-black block mt-1 text-blue-600">{stats.frozen}</span>
        </div>

        <div
          onClick={() => {
            setStatusFilter("BLOCKED");
            setOnlyOverdue(false);
          }}
          className={`p-4 rounded-2xl border transition-all cursor-pointer ${
            statusFilter === "BLOCKED"
              ? "bg-gray-800 text-white border-gray-800 shadow-md"
              : "bg-white text-gray-800 border-gray-200 hover:border-gray-300"
          }`}
        >
          <span className="text-xs opacity-75 block font-medium">المحظورين إدارياً</span>
          <span className="text-2xl font-black block mt-1 text-gray-700">{stats.blocked}</span>
        </div>
      </div>

      {/* Search and Filters Bar */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute right-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث باسم العضو، كود الباركود، رقم الموبايل..."
              className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black bg-gray-50/50"
            />
          </div>

          {/* Plan Kind Filter */}
          <select
            value={planKindFilter}
            onChange={(e) => setPlanKindFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black bg-white"
          >
            <option value="ALL">كل أنواع الباقات</option>
            <option value="GYM">جيم (Floor Access)</option>
            <option value="PT">تدريب خاص (PT)</option>
            <option value="CLASS">حصص جماعية (Classes)</option>
          </select>

          {/* Coach Filter */}
          <select
            value={coachFilter}
            onChange={(e) => setCoachFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black bg-white"
          >
            <option value="ALL">كل المدربين</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Expiring In Days Filter */}
          <select
            value={expiringInDays}
            onChange={(e) => setExpiringInDays(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black bg-white"
          >
            <option value="ALL">فترة الانتهاء</option>
            <option value="7">ينتهي خلال 7 أيام</option>
            <option value="14">ينتهي خلال 14 يوم</option>
            <option value="30">ينتهي خلال 30 يوم</option>
          </select>

          {/* Overdue shortcut button */}
          <button
            onClick={() => setOnlyOverdue(!onlyOverdue)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold border transition-colors flex items-center gap-1.5 ${
              onlyOverdue
                ? "bg-red-50 border-red-300 text-red-700 font-black shadow-sm"
                : "border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <span>المتأخرات المالية</span>
          </button>
        </div>
      </div>

      {/* Members Table */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400">
            <div className="animate-spin h-8 w-8 border-4 border-gray-200 border-t-[#14181F] rounded-full mx-auto mb-3" />
            <p className="text-sm">جاري تحميل قائمة المشتركين...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="p-16 text-center text-gray-500">
            <Users className="h-12 w-12 mx-auto text-gray-300 mb-3" />
            <h3 className="text-base font-bold text-gray-800">لا يوجد أعضاء مطابقين للبحث</h3>
            <p className="text-xs text-gray-400 mt-1">
              جرب تغيير معايير البحث أو الفلاتر، أو قم بتسجيل عضو جديد.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead className="bg-gray-50/80 border-b border-gray-200 text-gray-600 font-bold text-xs">
                <tr>
                  <th className="p-4">العضو</th>
                  <th className="p-4">الباقة والمدرب</th>
                  <th className="p-4">حالة الاشتراك والدخول</th>
                  <th className="p-4">المدة / الجلسات</th>
                  <th className="p-4">المحفظة / المديونية</th>
                  <th className="p-4 text-center">الإجراءات السريعة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {members.map((member) => {
                  const isBlocked = member.isBlocked;
                  const isOverdueMember = (member.totalRemainingDebt ?? 0) > 0 || member.derivedStatus === "PAYMENT_OVERDUE";
                  const status = member.derivedStatus || "NO_SUBSCRIPTION";

                  return (
                    <tr key={member.id} className="hover:bg-gray-50/70 transition-colors">
                      {/* Member Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-gray-100 text-gray-700 font-bold flex items-center justify-center shrink-0 border border-gray-200">
                            {member.name.slice(0, 2)}
                          </div>
                          <div>
                            <Link
                              href={`/members/${member.id}`}
                              className="font-bold text-gray-900 hover:text-black hover:underline text-sm block"
                            >
                              {member.name}
                            </Link>
                            <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">
                                {member.code}
                              </span>
                              <span>·</span>
                              <span className="flex items-center gap-1 font-mono">
                                <Phone className="h-3 w-3" />
                                {member.phone}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan & Coach */}
                      <td className="p-4">
                        {member.activeSubscriptions && member.activeSubscriptions.length > 0 ? (
                          <div className="space-y-2">
                            {member.activeSubscriptions.map((sub: any) => {
                              const isPT = sub.kind === "PT";
                              const isClass = sub.kind === "CLASS";
                              const isFuture = sub.isFutureRenewal || new Date(sub.startDate) > new Date();

                              return (
                                <div key={sub.id} className="text-xs">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                        isPT
                                          ? "bg-purple-100 text-purple-800"
                                          : isClass
                                          ? "bg-emerald-100 text-emerald-800"
                                          : "bg-blue-100 text-blue-800"
                                      }`}
                                    >
                                      {isPT ? "برايفت" : isClass ? "كلاس" : "جيم"}
                                    </span>
                                    <span className="font-semibold text-gray-800">
                                      {sub.planName}
                                    </span>
                                    {isFuture && (
                                      <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-1.5 py-0.5 rounded">
                                        تجديد مسبق
                                      </span>
                                    )}
                                  </div>
                                  {sub.coachName && (
                                    <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded inline-block mt-0.5 font-medium">
                                      كابتن: {sub.coachName}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : member.activePlanName ? (
                          <div>
                            <span className="font-semibold text-gray-800 text-xs block">
                              {member.activePlanName}
                            </span>
                            {member.currentCoachName && (
                              <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full inline-block mt-1 font-medium">
                                كابتن: {member.currentCoachName}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">لا يوجد اشتراك نشط</span>
                        )}
                      </td>

                      {/* Status Badge */}
                      <td className="p-4">
                        {isBlocked ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                            <ShieldAlert className="h-3 w-3" />
                            محظور إدارياً
                          </span>
                        ) : status === "ACTIVE" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            نشط
                          </span>
                        ) : status === "FROZEN" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
                            <Snowflake className="h-3 w-3" />
                            مجمد
                          </span>
                        ) : isOverdueMember ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-red-50 text-red-700 border border-red-200">
                            <AlertTriangle className="h-3 w-3" />
                            متأخر عن السداد
                          </span>
                        ) : status === "EXPIRED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                            منتهي
                          </span>
                        ) : status === "PENDING_PAYMENT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            بانتظار الدفع
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-50 text-gray-500">
                            بدون اشتراك
                          </span>
                        )}
                      </td>

                      {/* Days / Sessions Left */}
                      <td className="p-4 text-xs">
                        {member.daysLeft !== undefined && member.daysLeft !== null ? (
                          <div>
                            <span className={`font-bold ${member.daysLeft <= 3 ? "text-amber-600" : "text-gray-800"}`}>
                              {member.daysLeft} يوم متبقي
                            </span>
                            {member.daysLeft <= 3 && (
                              <span className="block text-[10px] text-amber-600">ينتهي قريباً</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>

                      {/* Wallet & Debt */}
                      <td className="p-4 text-xs">
                        <div>
                          <span className="text-gray-500 block">
                            المحفظة:{" "}
                            <span className="font-bold text-gray-900">
                              {formatMoney(member.walletBalance ?? 0)}
                            </span>
                          </span>
                          {(member.totalRemainingDebt ?? 0) > 0 && (
                            <span className="font-bold text-red-600 block mt-0.5">
                              متبقي: {formatMoney(member.totalRemainingDebt ?? 0)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-2">
                          <Link
                            href={`/members/${member.id}`}
                            className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-bold text-gray-700 hover:bg-gray-100 transition-colors"
                          >
                            عرض الملف
                          </Link>

                          <Link
                            href={`/pos?memberId=${member.id}`}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-700 hover:bg-[#C6F24E]/30 transition-colors"
                            title="بيع اشتراك أو مشتريات"
                          >
                            <ShoppingCart className="h-4 w-4" />
                          </Link>

                          <button
                            onClick={() => handleMemberFreezeClick(member)}
                            className="p-1.5 rounded-lg border border-gray-200 text-blue-600 hover:bg-blue-50 transition-colors"
                            title="تجميد / إلغاء تجميد"
                          >
                            <Snowflake className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => setSelectedMemberForBlock(member)}
                            className={`p-1.5 rounded-lg border transition-colors ${
                              isBlocked
                                ? "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                                : "border-gray-200 text-gray-400 hover:text-red-600 hover:bg-red-50"
                            }`}
                            title={isBlocked ? "فك الحظر" : "حظر العضو"}
                          >
                            {isBlocked ? <ShieldCheck className="h-4 w-4" /> : <ShieldAlert className="h-4 w-4" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateMemberDialog
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={() => fetchMembers()}
      />

      {selectedMemberForBlock && (
        <BlockMemberDialog
          member={selectedMemberForBlock}
          isOpen={true}
          onClose={() => setSelectedMemberForBlock(null)}
          onSuccess={() => {
            fetchMembers();
            setSelectedMemberForBlock(null);
          }}
        />
      )}

      {selectedSubForFreeze && (
        <FreezeDialog
          subscription={selectedSubForFreeze.sub}
          member={selectedSubForFreeze.member}
          isOpen={true}
          onClose={() => setSelectedSubForFreeze(null)}
          onSuccess={() => {
            fetchMembers();
            setSelectedSubForFreeze(null);
          }}
        />
      )}

      {selectedSubForUnfreeze && (
        <UnfreezeDialog
          subscription={selectedSubForUnfreeze.sub}
          member={selectedSubForUnfreeze.member}
          isOpen={true}
          onClose={() => setSelectedSubForUnfreeze(null)}
          onSuccess={() => {
            fetchMembers();
            setSelectedSubForUnfreeze(null);
          }}
        />
      )}
    </div>
  );
}
