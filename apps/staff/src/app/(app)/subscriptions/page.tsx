"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import {
  CreditCard,
  Search,
  RefreshCw,
  Download,
  AlertTriangle,
  Clock,
  CheckCircle2,
  XCircle,
  Snowflake,
  Dumbbell,
  ArrowRightLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  DollarSign,
} from "lucide-react";
import { Button, Badge, useToast } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import { formatMoney } from "../../../lib/money";
import {
  subscriptionsApi,
  type SubscriptionItem,
  type PaginatedSubscriptionsResult,
} from "../../../features/subscriptions/api";
import { FreezeDialog } from "../../../features/members/components/freeze-dialog";
import { UnfreezeDialog } from "../../../features/members/components/unfreeze-dialog";
import { CancelSubscriptionDialog } from "../../../features/members/components/cancel-subscription-dialog";
import { ChangeCoachDialog } from "../../../features/members/components/change-coach-dialog";
import { LogSessionDialog } from "../../../features/members/components/log-session-dialog";
import { CollectBalanceDialog } from "../../../features/members/components/collect-balance-dialog";
import { useShift } from "../../../lib/shift-context";

export default function SubscriptionsManagementPage() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { currentUser } = useShift();

  // Filters State
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [kind, setKind] = useState<string>("ALL");
  const [planId, setPlanId] = useState<string>("ALL");
  const [coachId, setCoachId] = useState<string>("ALL");
  const [quickFilter, setQuickFilter] = useState<
    "ALL" | "EXPIRING_7" | "OVERDUE" | "FROZEN" | "PENDING_PAYMENT"
  >("ALL");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Pagination State
  const [page, setPage] = useState(1);
  const limit = 20;

  // Data State
  const [data, setData] = useState<PaginatedSubscriptionsResult | null>(null);
  const [plans, setPlans] = useState<any[]>([]);
  const [coaches, setCoaches] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  // Dialog Selection State
  const [selectedSubForFreeze, setSelectedSubForFreeze] = useState<SubscriptionItem | null>(null);
  const [selectedSubForUnfreeze, setSelectedSubForUnfreeze] = useState<SubscriptionItem | null>(null);
  const [selectedSubForCancel, setSelectedSubForCancel] = useState<SubscriptionItem | null>(null);
  const [selectedSubForChangeCoach, setSelectedSubForChangeCoach] = useState<SubscriptionItem | null>(null);
  const [selectedSubForLogSession, setSelectedSubForLogSession] = useState<SubscriptionItem | null>(null);
  const [selectedInvoiceForCollect, setSelectedInvoiceForCollect] = useState<{
    invoice: any;
    member: any;
  } | null>(null);

  // Load plans & coaches on mount
  useEffect(() => {
    Promise.all([subscriptionsApi.listPlans(), subscriptionsApi.listCoaches()])
      .then(([plansData, coachesData]) => {
        setPlans(plansData);
        setCoaches(coachesData);
      })
      .catch((err) => {
        console.error("Failed to load plans or coaches metadata", err);
      });
  }, []);

  // Fetch subscriptions with current filters
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const expiringInDays = quickFilter === "EXPIRING_7" ? 7 : undefined;
      const overdue = quickFilter === "OVERDUE" ? true : undefined;
      let effectiveStatus = status;
      if (quickFilter === "FROZEN") effectiveStatus = "FROZEN";
      if (quickFilter === "PENDING_PAYMENT") effectiveStatus = "PENDING_PAYMENT";

      const res = await subscriptionsApi.listSubscriptions({
        search: search.trim() || undefined,
        status: effectiveStatus !== "ALL" ? effectiveStatus : undefined,
        kind: kind !== "ALL" ? kind : undefined,
        planId: planId !== "ALL" ? planId : undefined,
        coachId: coachId !== "ALL" ? coachId : undefined,
        expiringInDays,
        overdue,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        page,
        limit,
      });

      setData(res);
    } catch (err: any) {
      console.error("Failed to load subscriptions", err);
      toast({
        title: "تعذر تحميل الاشتراكات",
        description: err?.message || "حدث خطأ أثناء تحميل البيانات",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [search, status, kind, planId, coachId, quickFilter, startDate, endDate, page, limit, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Quick Filter Change
  const handleQuickFilter = (
    filter: "ALL" | "EXPIRING_7" | "OVERDUE" | "FROZEN" | "PENDING_PAYMENT"
  ) => {
    setQuickFilter(filter);
    setPage(1);
    if (filter === "FROZEN") setStatus("FROZEN");
    else if (filter === "PENDING_PAYMENT") setStatus("PENDING_PAYMENT");
    else if (status === "FROZEN" || status === "PENDING_PAYMENT") setStatus("ALL");
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearch("");
    setStatus("ALL");
    setKind("ALL");
    setPlanId("ALL");
    setCoachId("ALL");
    setQuickFilter("ALL");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  // CSV Export with UTF-8 BOM
  const handleExportCsv = () => {
    if (!data?.items || data.items.length === 0) {
      toast({
        title: "لا توجد بيانات للتصدير",
        description: "القائمة الحالية لا تحتوي على أي اشتراكات",
        variant: "warning",
      });
      return;
    }

    setIsExporting(true);
    try {
      const headers = [
        "كود العضو",
        "اسم العضو",
        "رقم الهاتف",
        "اسم الباقة",
        "النوع",
        "المدرب المعين",
        "تاريخ البدء",
        "تاريخ الانتهاء",
        "الأيام المتبقية",
        "الحالة",
        "السعر الإجمالي (ج.م)",
        "المبلغ المحصل (ج.م)",
        "المتبقي المستحق (ج.م)",
        "الجلسات المتبقية",
      ];

      const rows = data.items.map((s) => [
        s.member.code,
        `"${s.member.name.replace(/"/g, '""')}"`,
        s.member.phone || "—",
        `"${s.plan.name.replace(/"/g, '""')}"`,
        s.kind,
        s.currentCoach?.name ? `"${s.currentCoach.name.replace(/"/g, '""')}"` : "—",
        s.startDate.slice(0, 10),
        s.endDate.slice(0, 10),
        s.daysLeft,
        s.status,
        (s.price / 100).toFixed(2),
        (s.collected / 100).toFixed(2),
        (s.remaining / 100).toFixed(2),
        s.sessionsLeft !== null ? s.sessionsLeft : "—",
      ]);

      const csvContent =
        "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute(
        "download",
        `subscriptions_${new Date().toISOString().slice(0, 10)}.csv`
      );
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({
        title: "تم تصدير التقرير بنجاح",
        description: `تم تنزيل ملف CSV يحتوي على ${data.items.length} اشتراك`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "فشل التصدير",
        description: err?.message || "حدث خطأ أثناء إعداد ملف CSV",
        variant: "error",
      });
    } finally {
      setIsExporting(false);
    }
  };

  const summary = data?.summary || {
    totalActive: 0,
    totalExpiringSoon: 0,
    totalOverdueAmount: 0,
    totalPendingPayment: 0,
  };

  const isGymAdmin = currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN";

  // Role Access Guard (RECEPTION, GYM_ADMIN, SUPER_ADMIN)
  if (
    currentUser &&
    currentUser.role !== "RECEPTION" &&
    currentUser.role !== "GYM_ADMIN" &&
    currentUser.role !== "SUPER_ADMIN"
  ) {
    return (
      <div className="p-8 text-center max-w-lg mx-auto mt-12 bg-white rounded-2xl border border-red-100 shadow-sm" dir="rtl">
        <AlertTriangle className="w-12 h-12 mx-auto text-red-500 mb-3" />
        <h2 className="text-xl font-bold text-[#14181F]">غير مصرح لك بالوصول</h2>
        <p className="text-sm text-[#5B6470] mt-1">
          هذه الشاشة مخصصة فقط لموظفي الاستقبال وإدارة النادي لمتابعة الاشتراكات.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1500px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E1E5DF]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-[#14181F]">
              {t("subscriptionsManagement.title")}
            </h1>
            <Badge variant="lime" className="font-mono text-xs">
              {data?.total ?? 0} اشتراك
            </Badge>
          </div>
          <p className="text-sm text-[#5B6470] mt-1">
            {t("subscriptionsManagement.description")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isExporting || !data?.items?.length}
            className="flex items-center gap-1.5 font-bold"
            title="تصدير كشف المشتركين بتنسيق CSV"
          >
            <Download className="w-4 h-4" />
            <span>{t("subscriptionsManagement.actions.exportCsv")}</span>
          </Button>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Active Subscriptions */}
        <div
          onClick={() => handleQuickFilter("ALL")}
          className={`p-4 bg-white border rounded-2xl cursor-pointer transition-all hover:shadow-subtle ${
            quickFilter === "ALL" && status === "ALL"
              ? "border-[#14181F] ring-2 ring-[#14181F]/10"
              : "border-[#E1E5DF]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#5B6470] font-medium">
                {t("subscriptionsManagement.totalActive")}
              </p>
              <p className="text-2xl font-black text-emerald-600 mt-1">
                {summary.totalActive}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Expiring Soon (7 Days) */}
        <div
          onClick={() => handleQuickFilter("EXPIRING_7")}
          className={`p-4 bg-white border rounded-2xl cursor-pointer transition-all hover:shadow-subtle ${
            quickFilter === "EXPIRING_7"
              ? "border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/20"
              : "border-[#E1E5DF]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#5B6470] font-medium">
                {t("subscriptionsManagement.totalExpiringSoon")}
              </p>
              <p className="text-2xl font-black text-amber-600 mt-1">
                {summary.totalExpiringSoon}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Overdue Debt Amount */}
        <div
          onClick={() => handleQuickFilter("OVERDUE")}
          className={`p-4 bg-white border rounded-2xl cursor-pointer transition-all hover:shadow-subtle ${
            quickFilter === "OVERDUE"
              ? "border-red-400 ring-2 ring-red-400/20 bg-red-50/20"
              : "border-[#E1E5DF]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#5B6470] font-medium">
                {t("subscriptionsManagement.totalOverdueAmount")}
              </p>
              <p className="text-2xl font-black text-red-600 mt-1">
                {formatMoney(summary.totalOverdueAmount)}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Pending Payment */}
        <div
          onClick={() => handleQuickFilter("PENDING_PAYMENT")}
          className={`p-4 bg-white border rounded-2xl cursor-pointer transition-all hover:shadow-subtle ${
            quickFilter === "PENDING_PAYMENT"
              ? "border-blue-400 ring-2 ring-blue-400/20 bg-blue-50/20"
              : "border-[#E1E5DF]"
          }`}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-[#5B6470] font-medium">
                {t("subscriptionsManagement.totalPendingPayment")}
              </p>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {summary.totalPendingPayment}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Quick Filter Chips */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => handleQuickFilter("ALL")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 ${
            quickFilter === "ALL" && status === "ALL"
              ? "bg-[#14181F] text-white"
              : "bg-white border border-[#E1E5DF] text-[#5B6470] hover:bg-[#F6F8F5]"
          }`}
        >
          {t("subscriptionsManagement.all")}
        </button>

        <button
          type="button"
          onClick={() => handleQuickFilter("EXPIRING_7")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            quickFilter === "EXPIRING_7"
              ? "bg-amber-500 text-white shadow-xs"
              : "bg-white border border-[#E1E5DF] text-[#5B6470] hover:bg-amber-50 hover:text-amber-800"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t("subscriptionsManagement.quickFilters.expiring7")}</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-black/10">
            {summary.totalExpiringSoon}
          </span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickFilter("OVERDUE")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            quickFilter === "OVERDUE"
              ? "bg-red-600 text-white shadow-xs"
              : "bg-white border border-[#E1E5DF] text-[#5B6470] hover:bg-red-50 hover:text-red-800"
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>{t("subscriptionsManagement.quickFilters.overdue")}</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickFilter("FROZEN")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            quickFilter === "FROZEN"
              ? "bg-blue-600 text-white shadow-xs"
              : "bg-white border border-[#E1E5DF] text-[#5B6470] hover:bg-blue-50 hover:text-blue-800"
          }`}
        >
          <Snowflake className="w-3.5 h-3.5" />
          <span>{t("subscriptionsManagement.quickFilters.frozen")}</span>
        </button>

        <button
          type="button"
          onClick={() => handleQuickFilter("PENDING_PAYMENT")}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 ${
            quickFilter === "PENDING_PAYMENT"
              ? "bg-purple-600 text-white shadow-xs"
              : "bg-white border border-[#E1E5DF] text-[#5B6470] hover:bg-purple-50 hover:text-purple-800"
          }`}
        >
          <DollarSign className="w-3.5 h-3.5" />
          <span>{t("subscriptionsManagement.quickFilters.pendingPayment")}</span>
        </button>
      </div>

      {/* Advanced Filters Panel */}
      <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl space-y-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-[#5B6470]" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder={t("subscriptionsManagement.filters.searchPlaceholder")}
              className="w-full h-10 ps-9 pe-3 text-xs bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-transparent"
            />
          </div>

          {/* Status Select */}
          <div>
            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value);
                setQuickFilter("ALL");
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            >
              <option value="ALL">كل الحالات</option>
              <option value="ACTIVE">{t("subscriptionsManagement.statuses.ACTIVE")}</option>
              <option value="PENDING_PAYMENT">{t("subscriptionsManagement.statuses.PENDING_PAYMENT")}</option>
              <option value="FROZEN">{t("subscriptionsManagement.statuses.FROZEN")}</option>
              <option value="SUSPENDED_UNPAID">{t("subscriptionsManagement.statuses.SUSPENDED_UNPAID")}</option>
              <option value="EXPIRED">{t("subscriptionsManagement.statuses.EXPIRED")}</option>
              <option value="CANCELLED">{t("subscriptionsManagement.statuses.CANCELLED")}</option>
            </select>
          </div>

          {/* Kind Select */}
          <div>
            <select
              value={kind}
              onChange={(e) => {
                setKind(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            >
              <option value="ALL">كل الأنواع</option>
              <option value="GYM">{t("subscriptionsManagement.kinds.GYM")}</option>
              <option value="PT">{t("subscriptionsManagement.kinds.PT")}</option>
              <option value="CLASS">{t("subscriptionsManagement.kinds.CLASS")}</option>
            </select>
          </div>

          {/* Plan Select */}
          <div>
            <select
              value={planId}
              onChange={(e) => {
                setPlanId(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            >
              <option value="ALL">كل الباقات</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Coach Select */}
          <div>
            <select
              value={coachId}
              onChange={(e) => {
                setCoachId(e.target.value);
                setPage(1);
              }}
              className="w-full h-10 px-3 text-xs bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            >
              <option value="ALL">كل المدربين</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Filter & Reset Button */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[#E1E5DF] text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#5B6470] font-medium">نطاق تاريخ البدء:</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 bg-[#F6F8F5] border border-[#E1E5DF] rounded-lg text-xs"
            />
            <span className="text-[#5B6470]">إلى</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
              className="h-8 px-2 bg-[#F6F8F5] border border-[#E1E5DF] rounded-lg text-xs"
            />
          </div>

          <button
            type="button"
            onClick={handleResetFilters}
            className="text-xs font-bold text-[#5B6470] hover:text-[#14181F] underline cursor-pointer"
          >
            {t("subscriptionsManagement.filters.reset")}
          </button>
        </div>
      </div>

      {/* Subscriptions Table */}
      <div className="bg-white border border-[#E1E5DF] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead className="bg-[#F6F8F5] border-b border-[#E1E5DF] text-[#5B6470] font-bold">
              <tr>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.member")}</th>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.plan")}</th>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.coach")}</th>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.period")}</th>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.daysLeft")}</th>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.status")}</th>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.financials")}</th>
                <th className="p-3.5 text-start">{t("subscriptionsManagement.table.sessions")}</th>
                <th className="p-3.5 text-center">{t("subscriptionsManagement.table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E5DF]">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[#5B6470]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#4D6B00] mb-2" />
                    <span>جاري تحميل الاشتراكات...</span>
                  </td>
                </tr>
              ) : !data?.items || data.items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-16 text-center text-[#5B6470]">
                    <CreditCard className="w-10 h-10 mx-auto text-[#5B6470]/40 mb-2" />
                    <p className="font-bold text-sm text-[#14181F]">
                      {t("subscriptionsManagement.empty")}
                    </p>
                    <p className="text-xs text-[#5B6470] mt-1">
                      جرب تغيير محددات البحث أو تصفير الفلاتر
                    </p>
                  </td>
                </tr>
              ) : (
                data.items.map((sub) => {
                  const isOverdue = sub.isOverdue;
                  const isFrozen = sub.status === "FROZEN";
                  const isActive = sub.status === "ACTIVE";
                  const isExpiringSoon = isActive && sub.daysLeft <= 7 && sub.daysLeft > 0;

                  return (
                    <tr
                      key={sub.id}
                      className={`hover:bg-[#F6F8F5]/60 transition-colors ${
                        isOverdue ? "bg-red-50/20" : ""
                      }`}
                    >
                      {/* Member Column */}
                      <td className="p-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#E1E5DF]/60 text-[#14181F] font-bold text-xs flex items-center justify-center shrink-0">
                            {sub.member.name.charAt(0)}
                          </div>
                          <div>
                            <Link
                              href={`/members/${sub.member.id}`}
                              className="font-bold text-[#14181F] hover:text-[#4D6B00] hover:underline flex items-center gap-1"
                            >
                              <span>{sub.member.name}</span>
                              <ExternalLink className="w-3 h-3 text-[#5B6470]" />
                            </Link>
                            <div className="flex items-center gap-2 text-[11px] text-[#5B6470] mt-0.5">
                              <span className="font-mono">#{sub.member.code}</span>
                              {sub.member.phone && (
                                <span className="font-mono dir-ltr">· {sub.member.phone}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Plan Column */}
                      <td className="p-3.5">
                        <div className="font-bold text-[#14181F]">{sub.plan.name}</div>
                        <span
                          className={`inline-block text-[10px] font-bold px-1.5 py-0.2 rounded mt-0.5 ${
                            sub.kind === "GYM"
                              ? "bg-slate-100 text-slate-700"
                              : sub.kind === "PT"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-amber-100 text-amber-800"
                          }`}
                        >
                          {t(`subscriptionsManagement.kinds.${sub.kind}`)}
                        </span>
                      </td>

                      {/* Coach Column */}
                      <td className="p-3.5 text-[#5B6470]">
                        {sub.currentCoach?.name ? (
                          <span className="font-semibold text-[#14181F] flex items-center gap-1">
                            <Dumbbell className="w-3.5 h-3.5 text-purple-600" />
                            {sub.currentCoach.name}
                          </span>
                        ) : (
                          <span>—</span>
                        )}
                      </td>

                      {/* Period Column */}
                      <td className="p-3.5 font-mono text-[11px] text-[#5B6470] whitespace-nowrap">
                        <div className="dir-ltr text-start">
                          {sub.startDate.slice(0, 10)} ← {sub.endDate.slice(0, 10)}
                        </div>
                        <span className="text-[10px] text-[#5B6470]">
                          ({sub.durationDays} يوم)
                        </span>
                      </td>

                      {/* Days Left Column */}
                      <td className="p-3.5">
                        <span
                          className={`font-bold font-mono text-xs px-2 py-0.5 rounded-md inline-block ${
                            sub.daysLeft <= 0
                              ? "bg-gray-100 text-gray-500"
                              : isExpiringSoon
                              ? "bg-amber-100 text-amber-800"
                              : "bg-emerald-50 text-emerald-800"
                          }`}
                        >
                          {sub.daysLeft <= 0 ? "منتهي" : `${sub.daysLeft} يوم`}
                        </span>
                      </td>

                      {/* Status Column */}
                      <td className="p-3.5">
                        <Badge
                          variant={
                            isActive
                              ? "g"
                              : isFrozen
                              ? "default"
                              : isOverdue || sub.status === "SUSPENDED_UNPAID"
                              ? "r"
                              : sub.status === "PENDING_PAYMENT"
                              ? "w"
                              : "default"
                          }
                          className="font-bold text-[11px]"
                        >
                          {t(`subscriptionsManagement.statuses.${sub.status}`)}
                        </Badge>
                        {isOverdue && (
                          <span className="block text-[10px] text-red-600 font-bold mt-0.5">
                            مستحق متأخر
                          </span>
                        )}
                      </td>

                      {/* Financials Column */}
                      <td className="p-3.5">
                        <div className="font-bold text-[#14181F]">
                          {formatMoney(sub.price)}
                        </div>
                        <div className="text-[11px] mt-0.5 space-x-1 space-x-reverse">
                          <span className="text-emerald-700 font-medium">
                            {formatMoney(sub.collected)}
                          </span>
                          {sub.remaining > 0 && (
                            <span className="text-red-600 font-bold">
                              · متبقي {formatMoney(sub.remaining)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sessions Column */}
                      <td className="p-3.5 text-[#5B6470]">
                        {sub.totalSessions !== null ? (
                          <div className="font-mono text-xs font-bold text-[#14181F]">
                            {sub.sessionsLeft} / {sub.totalSessions}
                          </div>
                        ) : (
                          <span>—</span>
                        )}
                      </td>

                      {/* Actions Column */}
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {/* Collect Balance Action */}
                          {sub.remaining > 0 && sub.invoice && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs h-7 px-2 font-bold text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                              onClick={() => {
                                setSelectedInvoiceForCollect({
                                  invoice: sub.invoice,
                                  member: sub.member,
                                });
                              }}
                              title="سداد المتبقي المستحق"
                            >
                              <DollarSign className="w-3 h-3 me-1" />
                              <span>تحصيل</span>
                            </Button>
                          )}

                          {/* Early Renewal Button */}
                          <Link
                            href={`/pos?memberId=${sub.member.id}&planId=${sub.planId}&startDate=${sub.endDate}`}
                            className="inline-flex items-center justify-center h-7 px-2 text-xs font-bold bg-[#C6F24E]/40 hover:bg-[#C6F24E] text-[#14181F] rounded-lg transition-colors"
                            title="تجديد مبكر يبدأ تلقائياً فور انتهاء هذا الاشتراك"
                          >
                            <span>تجديد</span>
                          </Link>

                          {/* Freeze / Unfreeze Button */}
                          <button
                            type="button"
                            onClick={() => {
                              if (isFrozen) {
                                setSelectedSubForUnfreeze(sub);
                              } else {
                                setSelectedSubForFreeze(sub);
                              }
                            }}
                            className="h-7 px-2 text-xs font-bold rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 transition-colors flex items-center gap-1"
                            title={isFrozen ? "إلغاء التجميد" : "تجميد الاشتراك"}
                          >
                            <Snowflake className="w-3 h-3" />
                            <span>{isFrozen ? "فك" : "تجميد"}</span>
                          </button>

                          {/* PT Log Session */}
                          {sub.kind === "PT" && (
                            <button
                              type="button"
                              onClick={() => setSelectedSubForLogSession(sub)}
                              className="h-7 px-2 text-xs font-bold rounded-lg border border-indigo-200 text-indigo-700 hover:bg-indigo-50 transition-colors"
                              title="تسجيل جلسة تدريب"
                            >
                              جلسة
                            </button>
                          )}

                          {/* PT Change Coach */}
                          {isGymAdmin && sub.kind === "PT" && (
                            <button
                              type="button"
                              onClick={() => setSelectedSubForChangeCoach(sub)}
                              className="h-7 px-2 text-xs font-bold rounded-lg border border-purple-200 text-purple-700 hover:bg-purple-50 transition-colors"
                              title="تغيير المدرب المعين"
                            >
                              <ArrowRightLeft className="w-3 h-3" />
                            </button>
                          )}

                          {/* Cancel Subscription */}
                          {isGymAdmin && sub.status !== "CANCELLED" && (
                            <button
                              type="button"
                              onClick={() => setSelectedSubForCancel(sub)}
                              className="p-1 text-[#5B6470] hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                              title="إلغاء الاشتراك"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Server-Side Pagination Footer */}
        {data && data.totalPages > 1 && (
          <div className="p-4 bg-[#F6F8F5] border-t border-[#E1E5DF] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
            <span className="text-[#5B6470]">
              عرض {(page - 1) * limit + 1} إلى {Math.min(page * limit, data.total)} من إجمالي{" "}
              <strong className="text-[#14181F] font-bold">{data.total}</strong> اشتراك
            </span>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 px-3 text-xs"
              >
                <ChevronRight className="w-3.5 h-3.5 me-1" />
                <span>السابق</span>
              </Button>

              <span className="text-[#14181F] font-bold px-2">
                صفحة {page} من {data.totalPages}
              </span>

              <Button
                variant="outline"
                size="sm"
                disabled={page >= data.totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 px-3 text-xs"
              >
                <span>التالي</span>
                <ChevronLeft className="w-3.5 h-3.5 ms-1" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* DIALOGS REUSED DIRECTLY AS REQUESTED */}
      {selectedSubForFreeze && (
        <FreezeDialog
          subscription={selectedSubForFreeze as any}
          member={selectedSubForFreeze.member as any}
          isOpen={Boolean(selectedSubForFreeze)}
          onClose={() => setSelectedSubForFreeze(null)}
          onSuccess={() => {
            setSelectedSubForFreeze(null);
            fetchData();
          }}
        />
      )}

      {selectedSubForUnfreeze && (
        <UnfreezeDialog
          subscription={selectedSubForUnfreeze as any}
          member={selectedSubForUnfreeze.member as any}
          isOpen={Boolean(selectedSubForUnfreeze)}
          onClose={() => setSelectedSubForUnfreeze(null)}
          onSuccess={() => {
            setSelectedSubForUnfreeze(null);
            fetchData();
          }}
        />
      )}

      {selectedSubForCancel && (
        <CancelSubscriptionDialog
          subscription={selectedSubForCancel as any}
          member={selectedSubForCancel.member as any}
          isOpen={Boolean(selectedSubForCancel)}
          onClose={() => setSelectedSubForCancel(null)}
          onSuccess={() => {
            setSelectedSubForCancel(null);
            fetchData();
          }}
        />
      )}

      {selectedSubForChangeCoach && (
        <ChangeCoachDialog
          subscription={selectedSubForChangeCoach as any}
          member={selectedSubForChangeCoach.member as any}
          isOpen={Boolean(selectedSubForChangeCoach)}
          onClose={() => setSelectedSubForChangeCoach(null)}
          onSuccess={() => {
            setSelectedSubForChangeCoach(null);
            fetchData();
          }}
        />
      )}

      {selectedSubForLogSession && (
        <LogSessionDialog
          subscription={selectedSubForLogSession as any}
          member={selectedSubForLogSession.member as any}
          isOpen={Boolean(selectedSubForLogSession)}
          onClose={() => setSelectedSubForLogSession(null)}
          onSuccess={() => {
            setSelectedSubForLogSession(null);
            fetchData();
          }}
        />
      )}

      {selectedInvoiceForCollect && (
        <CollectBalanceDialog
          invoice={selectedInvoiceForCollect.invoice}
          member={selectedInvoiceForCollect.member}
          isOpen={Boolean(selectedInvoiceForCollect)}
          onClose={() => setSelectedInvoiceForCollect(null)}
          onSuccess={() => {
            setSelectedInvoiceForCollect(null);
            fetchData();
          }}
        />
      )}
    </div>
  );
}

