"use client";

import React, { useState, useEffect } from "react";
import {
  useToast,
  Button,
  Chip,
  Badge,
  StatCard,
} from "@gym/ui";
import {
  Lock,
  Unlock,
  Wallet,
  FileSpreadsheet,
  Sliders,
  RefreshCw,
  PlusCircle,
  Dumbbell,
  Download,
  Bell,
  History,
  Info,
} from "lucide-react";

import {
  fetchPayrollRuns,
  fetchPayrollRun,
  createPayrollRun,
  recalculatePayrollRun,
  closePayrollRun,
  deletePayrollLine,
  type PayrollRunDetail,
} from "../../../features/payroll/api";

import {
  fetchDailyRevenue,
  fetchExpiringSubscriptions,
  fetchOverdueBalances,
  fetchPromotionUsage,
  fetchCoachPerformance,
  fetchAuditLogs,
  fetchNotifications,
  subscribeToNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from "../../../features/reports/api";

import { TiersEditorDialog } from "../../../features/payroll/components/tiers-editor-dialog";
import { CoachMilestonesModal } from "../../../features/payroll/components/coach-milestones-modal";
import { AddPayrollLineDialog } from "../../../features/payroll/components/add-payroll-line-dialog";

export default function AdminDashboardPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"payroll" | "reports" | "audit">("payroll");

  // Payroll state
  const currentDate = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [payrollRuns, setPayrollRuns] = useState<any[]>([]);
  const [currentRun, setCurrentRun] = useState<PayrollRunDetail | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  // Dialog states
  const [tiersOpen, setTiersOpen] = useState(false);
  const [addLineOpen, setAddLineOpen] = useState(false);
  const [selectedCoachForModal, setSelectedCoachForModal] = useState<{ id: string; name: string } | null>(null);

  // Reports state
  const [reportDate, setReportDate] = useState<string>(currentDate.toISOString().slice(0, 10));
  const [dailyRevenue, setDailyRevenue] = useState<any>(null);
  const [expiringSubs, setExpiringSubs] = useState<any[]>([]);
  const [overdueBalances, setOverdueBalances] = useState<any[]>([]);
  const [promoUsage, setPromoUsage] = useState<any[]>([]);
  const [coachPerformance, setCoachPerformance] = useState<any[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);

  // Notifications & Audit state
  const [notifications, setNotifications] = useState<{ unreadCount: number; items: any[] }>({ unreadCount: 0, items: [] });
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  // Load payroll runs list
  const loadPayrollRuns = async () => {
    try {
      const runs = await fetchPayrollRuns();
      setPayrollRuns(runs);
    } catch {
      // ignore
    }
  };

  // Load selected payroll run
  const loadRunDetail = async (year: number, month: number) => {
    setPayrollLoading(true);
    try {
      const runs = await fetchPayrollRuns();
      setPayrollRuns(runs);
      const match = runs.find((r) => r.year === year && r.month === month);
      if (match) {
        const detail = await fetchPayrollRun(match.id);
        setCurrentRun(detail);
      } else {
        setCurrentRun(null);
      }
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    } finally {
      setPayrollLoading(false);
    }
  };

  useEffect(() => {
    loadPayrollRuns();
    loadRunDetail(selectedYear, selectedMonth);
  }, [selectedYear, selectedMonth]);

  // Load reports data
  const loadReports = async () => {
    setReportsLoading(true);
    try {
      const [rev, exp, over, promo, coach] = await Promise.all([
        fetchDailyRevenue(reportDate),
        fetchExpiringSubscriptions(7),
        fetchOverdueBalances(),
        fetchPromotionUsage(),
        fetchCoachPerformance(`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`),
      ]);
      setDailyRevenue(rev);
      setExpiringSubs(exp);
      setOverdueBalances(over);
      setPromoUsage(promo);
      setCoachPerformance(coach);
    } catch (err: any) {
      toast({ title: "خطأ في التقارير", description: err.message, variant: "error" });
    } finally {
      setReportsLoading(false);
    }
  };

  // Load notifications & audit
  const loadNotificationsAndAudit = async () => {
    setAuditLoading(true);
    try {
      const [notifs, audits] = await Promise.all([
        fetchNotifications(),
        fetchAuditLogs({ limit: 30 }),
      ]);
      setNotifications(notifs);
      setAuditLogs(audits.data || audits || []);
    } catch (err: any) {
      // ignore
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "reports") {
      loadReports();
    } else if (activeTab === "audit") {
      loadNotificationsAndAudit();
    }
  }, [activeTab, reportDate]);

  // Live SSE stream with polling fallback for notifications
  useEffect(() => {
    const unsubscribe = subscribeToNotifications((incoming) => {
      if (incoming && incoming.unreadCount !== undefined) {
        setNotifications(incoming);
      } else if (incoming && incoming.id) {
        setNotifications((prev) => ({
          unreadCount: prev.unreadCount + 1,
          items: [incoming, ...prev.items],
        }));
      }
    });
    return () => unsubscribe();
  }, []);

  // Handlers for payroll
  const handleCreateRun = async () => {
    try {
      const run = await createPayrollRun(selectedYear, selectedMonth);
      setCurrentRun(run);
      await loadPayrollRuns();
      toast({ title: "تم إنشاء الكشف", description: `تم احتساب مسودة مرتبات ${selectedMonth}/${selectedYear}` });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    }
  };

  const handleRecalculate = async () => {
    if (!currentRun) return;
    try {
      const updated = await recalculatePayrollRun(currentRun.id);
      setCurrentRun(updated);
      toast({ title: "تمت إعادة الاحتساب", description: "تم تحديث كافة العمولات والشرائح والبيانات" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    }
  };

  const handleCloseRun = async () => {
    if (!currentRun) return;
    if (!confirm(`هل أنت متأكد من قفل كشف مرتبات وعمولات ${currentRun.month}/${currentRun.year}؟ هذا الإجراء نهائي وسيجمد المحطات.`)) {
      return;
    }
    try {
      await closePayrollRun(currentRun.id);
      await loadRunDetail(selectedYear, selectedMonth);
      toast({ title: "تم قفل الكشف بنجاح", description: "تم تجميد مبالغ العمولات وقفل الشهر" });
    } catch (err: any) {
      toast({ title: "تعذر قفل الكشف", description: err.message, variant: "error" });
    }
  };

  const handleDeleteLine = async (lineId: string) => {
    if (!currentRun) return;
    try {
      await deletePayrollLine(currentRun.id, lineId);
      await loadRunDetail(selectedYear, selectedMonth);
      toast({ title: "تم الحذف", description: "تم حذف البند اليدوي" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    }
  };

  // Export CSV helper
  const exportToCsv = (filename: string, rows: any[]) => {
    if (!rows || rows.length === 0) {
      toast({ title: "تنبيه", description: "لا توجد بيانات للتصدير" });
      return;
    }
    const headers = Object.keys(rows[0]);
    const csvContent =
      "data:text/csv;charset=utf-8,\uFEFF" +
      [
        headers.join(","),
        ...rows.map((r) =>
          headers.map((h) => `"${String(r[h] ?? "").replace(/"/g, '""')}"`).join(",")
        ),
      ].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Coaches list for dialogs
  const coachesList = currentRun
    ? currentRun.staff
        .filter((s) => s.staff.role === "COACH")
        .map((s) => ({ id: s.staffId, name: s.staff.name }))
    : [];

  return (
    <div className="p-6 md:p-[26px_30px] flex flex-col gap-[20px]" dir="rtl">
      {/* Top Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-black tracking-tight text-[#14181F]">
            لوحة الإدارة والرواتب والتقارير
          </h1>
          <p className="text-xs text-[#5B6470] mt-0.5">
            إدارة شرائح العمولات، كشوف المرتبات، تقارير الإيرادات اليومية، وسجل التدقيق
          </p>
        </div>

        <div className="flex items-center gap-2">
          {notifications.unreadCount > 0 && (
            <Chip className="bg-[#B3261E]/10 text-[#B3261E] border border-[#B3261E]/20 font-bold">
              <Bell className="h-3.5 w-3.5 me-1 text-[#B3261E]" />
              <span>{notifications.unreadCount} تنبيه جديد</span>
            </Chip>
          )}
          <Chip>
            <span>أدمن · منى السيد (فرع المعادي)</span>
          </Chip>
        </div>
      </header>

      {/* Primary Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E1E5DF] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("payroll")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "payroll"
              ? "bg-[#14181F] text-white shadow-sm"
              : "text-[#5B6470] hover:bg-[#E1E5DF]/50 hover:text-[#14181F]"
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          <span>كشف الرواتب والعمولات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("reports")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "reports"
              ? "bg-[#14181F] text-white shadow-sm"
              : "text-[#5B6470] hover:bg-[#E1E5DF]/50 hover:text-[#14181F]"
          }`}
        >
          <Wallet className="h-4 w-4" />
          <span>التقارير والإحصائيات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("audit")}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-sm transition-all cursor-pointer ${
            activeTab === "audit"
              ? "bg-[#14181F] text-white shadow-sm"
              : "text-[#5B6470] hover:bg-[#E1E5DF]/50 hover:text-[#14181F]"
          }`}
        >
          <History className="h-4 w-4" />
          <span>التنبيهات وسجل التدقيق</span>
          {notifications.unreadCount > 0 && (
            <span className="h-2 w-2 rounded-full bg-[#B3261E]" />
          )}
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: PAYROLL & COMMISSIONS */}
      {/* ========================================================================= */}
      {activeTab === "payroll" && (
        <div className="space-y-4">
          {/* Controls Bar */}
          <div className="bg-white border border-[#E1E5DF] rounded-2xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            {/* Month & Year Picker */}
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-[#5B6470]">شهر الكشف:</span>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                className="bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-1.5 text-sm font-bold text-[#14181F]"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    شهر {m}
                  </option>
                ))}
              </select>

              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                className="bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-1.5 text-sm font-bold text-[#14181F]"
              >
                <option value={2025}>2025</option>
                <option value={2026}>2026</option>
                <option value={2027}>2027</option>
              </select>

              {currentRun && (
                <div className="flex items-center gap-2 ms-2">
                  {currentRun.status === "CLOSED" ? (
                    <Badge variant="r" className="flex items-center gap-1 font-bold">
                      <Lock className="h-3 w-3" />
                      مغلق ومقفل
                    </Badge>
                  ) : (
                    <Badge variant="w" className="flex items-center gap-1 font-bold">
                      <Unlock className="h-3 w-3" />
                      مسودة مفتوحة
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTiersOpen(true)}
                className="border-[#E1E5DF] rounded-xl font-bold text-xs"
              >
                <Sliders className="h-3.5 w-3.5 me-1.5" />
                <span>إعداد شرائح العمولات</span>
              </Button>

              {currentRun && currentRun.status === "DRAFT" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setAddLineOpen(true)}
                    className="border-[#E1E5DF] rounded-xl font-bold text-xs"
                  >
                    <PlusCircle className="h-3.5 w-3.5 me-1.5" />
                    <span>مكافأة / خصم</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRecalculate}
                    className="border-[#E1E5DF] rounded-xl font-bold text-xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5 me-1.5" />
                    <span>إعادة احتساب</span>
                  </Button>

                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleCloseRun}
                    className="rounded-xl font-bold text-xs bg-[#B3261E] hover:bg-[#921E17] text-white"
                  >
                    <Lock className="h-3.5 w-3.5 me-1.5" />
                    <span>قفل الكشف</span>
                  </Button>
                </>
              )}

              {currentRun && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const rows = currentRun.staff.map((s) => ({
                      الموظف: s.staff.name,
                      الوظيفة: s.staff.role,
                      الأساسي: s.lines.find((l) => l.kind === "BASE_SALARY")?.amount || 0,
                      المحصل: s.lines.find((l) => l.kind === "COMMISSION")?.collectedRevenue || 0,
                      الشريحة: s.lines.find((l) => l.kind === "COMMISSION")?.tierPercent || 0,
                      العمولة: s.lines.find((l) => l.kind === "COMMISSION")?.amount || 0,
                      التسويات: s.lines.filter((l) => l.kind === "ADJUSTMENT").reduce((acc, l) => acc + l.amount, 0),
                      المكافآت: s.lines.filter((l) => l.kind === "BONUS").reduce((acc, l) => acc + l.amount, 0),
                      الخصومات: s.lines.filter((l) => l.kind === "DEDUCTION").reduce((acc, l) => acc + l.amount, 0),
                      الصافي: s.netTotal,
                    }));
                    exportToCsv(`payroll_${currentRun.year}_${currentRun.month}`, rows);
                  }}
                  className="border-[#E1E5DF] rounded-xl font-bold text-xs"
                >
                  <Download className="h-3.5 w-3.5 me-1.5" />
                  <span>تصدير CSV</span>
                </Button>
              )}
            </div>
          </div>

          {/* Payroll Content */}
          {payrollLoading ? (
            <div className="py-20 text-center text-sm font-semibold text-[#5B6470] bg-white rounded-2xl border border-[#E1E5DF]">
              جاري تحميل كشف الرواتب...
            </div>
          ) : !currentRun ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-[#E1E5DF] p-6 flex flex-col items-center gap-3">
              <FileSpreadsheet className="h-10 w-10 text-[#5B6470]/50" />
              <h3 className="text-base font-bold text-[#14181F]">
                لم يتم احتساب كشف رواتب لشهر {selectedMonth}/{selectedYear} حتى الآن
              </h3>
              <p className="text-xs text-[#5B6470] max-w-md">
                يمكنك إنشاء مسودة الكشف الآن ليقوم النظام بحساب الرواتب الأساسية، المبالغ المحصلة لكل مدرب، وتحديد الشرائح المستحقة بدقة.
              </p>
              <Button variant="lime" onClick={handleCreateRun} className="rounded-xl font-bold mt-2">
                <PlusCircle className="h-4 w-4 me-1.5" />
                <span>إنشاء واحتساب كشف {selectedMonth}/{selectedYear}</span>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Rule Banner */}
              <div className="p-3.5 rounded-2xl bg-white border border-[#E1E5DF] flex items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-2 text-[#5B6470]">
                  <Info className="h-4 w-4 text-[#14181F] shrink-0" />
                  <span>
                    <strong className="text-[#14181F]">قاعدة عمولات التدريب الشخصي (PT): </strong>
                    تُحدد الشريحة بإجمالي المبالغ المحصلة فعلاً للتدريب الشخصي خلال الشهر، وتُطبق نسبة الشريحة على كامل مبلغ الشهر المستحق.
                  </span>
                </div>
                <div className="text-end font-bold text-[#14181F] whitespace-nowrap">
                  إجمالي المصروف: <span className="text-base font-black tabular-nums">{currentRun.totalPayout.toLocaleString()} ج.م</span>
                </div>
              </div>

              {/* Staff Breakdown Table */}
              <div className="bg-white border border-[#E1E5DF] rounded-2xl overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead className="bg-[#F2F4F1] border-b border-[#E1E5DF] text-[#5B6470] font-bold">
                      <tr>
                        <th className="py-3 px-3 text-start">الموظف</th>
                        <th className="py-3 px-3 text-start">الوظيفة</th>
                        <th className="py-3 px-3 text-end">الراتب الأساسي</th>
                        <th className="py-3 px-3 text-end">المحصل الفعلي</th>
                        <th className="py-3 px-3 text-center">الشريحة</th>
                        <th className="py-3 px-3 text-end">العمولة</th>
                        <th className="py-3 px-3 text-end">تسويات سابقة</th>
                        <th className="py-3 px-3 text-end">مكافآت / خصومات</th>
                        <th className="py-3 px-3 text-end font-black">الصافي المستحق</th>
                        <th className="py-3 px-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E5DF]">
                      {currentRun.staff.map((s) => {
                        const baseSalary = s.lines.find((l) => l.kind === "BASE_SALARY")?.amount || 0;
                        const commLine = s.lines.find((l) => l.kind === "COMMISSION");
                        const adjustments = s.lines
                          .filter((l) => l.kind === "ADJUSTMENT")
                          .reduce((sum, l) => sum + l.amount, 0);
                        const bonus = s.lines
                          .filter((l) => l.kind === "BONUS")
                          .reduce((sum, l) => sum + l.amount, 0);
                        const deduction = s.lines
                          .filter((l) => l.kind === "DEDUCTION")
                          .reduce((sum, l) => sum + l.amount, 0);

                        return (
                          <tr key={s.staffId} className="hover:bg-[#F9FAF9] transition-colors">
                            <td className="py-3 px-3 font-bold text-[#14181F]">
                              {s.staff.name}
                            </td>
                            <td className="py-3 px-3 text-[#5B6470] font-medium">
                              {s.staff.role === "COACH" ? (
                                <Badge variant="g">مدرب (COACH)</Badge>
                              ) : (
                                s.staff.role
                              )}
                            </td>
                            <td className="py-3 px-3 text-end tabular-nums font-semibold">
                              {baseSalary > 0 ? `${baseSalary.toLocaleString()} ج.م` : "—"}
                            </td>
                            <td className="py-3 px-3 text-end tabular-nums font-bold text-[#14181F]">
                              {commLine?.collectedRevenue !== null && commLine?.collectedRevenue !== undefined
                                ? `${commLine.collectedRevenue.toLocaleString()} ج.م`
                                : "—"}
                            </td>
                            <td className="py-3 px-3 text-center">
                              {commLine?.tierPercent !== null && commLine?.tierPercent !== undefined ? (
                                <Badge variant="default" className="font-bold bg-[#14181F] text-white">
                                  {commLine.tierPercent}%
                                </Badge>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-3 text-end tabular-nums font-bold text-[#14181F]">
                              {commLine ? `${commLine.amount.toLocaleString()} ج.م` : "—"}
                            </td>
                            <td className="py-3 px-3 text-end tabular-nums font-semibold">
                              {adjustments !== 0 ? (
                                <span className={adjustments > 0 ? "text-[#1B7F4B]" : "text-[#B3261E]"}>
                                  {adjustments > 0 ? `+${adjustments.toLocaleString()}` : adjustments.toLocaleString()} ج.م
                                </span>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="py-3 px-3 text-end tabular-nums font-semibold">
                              {bonus > 0 && <span className="text-[#1B7F4B] block">+{bonus} مكافأة</span>}
                              {deduction > 0 && <span className="text-[#B3261E] block">-{deduction} خصم</span>}
                              {bonus === 0 && deduction === 0 && "—"}
                            </td>
                            <td className="py-3 px-3 text-end tabular-nums font-black text-sm text-[#14181F]">
                              {s.netTotal.toLocaleString()} ج.م
                            </td>
                            <td className="py-3 px-3 text-center whitespace-nowrap">
                              <div className="flex items-center justify-center gap-1.5">
                                {s.staff.role === "COACH" && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                      setSelectedCoachForModal({
                                        id: s.staffId,
                                        name: s.staff.name,
                                      })
                                    }
                                    className="h-7 px-2 text-[11px] font-bold rounded-lg border-[#E1E5DF]"
                                  >
                                    <Dumbbell className="h-3 w-3 me-1" />
                                    المحطات
                                  </Button>
                                )}

                                {currentRun.status === "DRAFT" &&
                                  s.lines
                                    .filter((l) => l.kind === "BONUS" || l.kind === "DEDUCTION")
                                    .map((l) => (
                                      <button
                                        key={l.id}
                                        type="button"
                                        onClick={() => handleDeleteLine(l.id)}
                                        className="h-7 px-1.5 text-[10px] text-[#B3261E] hover:underline"
                                        title={`حذف ${l.description || ""}`}
                                      >
                                        إلغاء {l.kind === "BONUS" ? "المكافأة" : "الخصم"}
                                      </button>
                                    ))}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: REPORTS & ANALYTICS */}
      {/* ========================================================================= */}
      {activeTab === "reports" && (
        <div className="space-y-6">
          {/* Daily Revenue Section */}
          <section className="bg-white border border-[#E1E5DF] rounded-2xl p-5 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-[#14181F]">تقرير الإيرادات اليومية حسب طريقة الدفع</h3>
                <p className="text-xs text-[#5B6470]">توزيع مبيعات الجيم والبار والخدمات حسب وسيلة السداد</p>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={reportDate}
                  onChange={(e) => setReportDate(e.target.value)}
                  className="bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-1.5 text-xs font-bold text-[#14181F]"
                />
                {dailyRevenue && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      exportToCsv(`daily_revenue_${reportDate}`, [
                        { التاريخ: reportDate, الطريقة: "كاش", المبلغ: dailyRevenue.byMethod.cash },
                        { التاريخ: reportDate, الطريقة: "إنستا باي", المبلغ: dailyRevenue.byMethod.instapay },
                        { التاريخ: reportDate, الطريقة: "بطاقة بنكية", المبلغ: dailyRevenue.byMethod.card },
                        { التاريخ: reportDate, الطريقة: "محفظة الأعضاء", المبلغ: dailyRevenue.byMethod.wallet },
                        { التاريخ: reportDate, الطريقة: "الإجمالي", المبلغ: dailyRevenue.total },
                      ]);
                    }}
                    className="border-[#E1E5DF] rounded-xl text-xs font-bold"
                  >
                    <Download className="h-3.5 w-3.5 me-1" />
                    تصدير
                  </Button>
                )}
              </div>
            </div>

            {dailyRevenue && (
              <div className="space-y-3">
                <div className="text-xl font-black text-[#14181F] tabular-nums">
                  إجمالي إيراد اليوم: {dailyRevenue.total?.toLocaleString()} ج.م
                  <span className="text-xs text-[#5B6470] font-normal ms-2">
                    ({dailyRevenue.paymentCount} عملية دفع)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                  <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
                    <span className="text-xs text-[#5B6470] block font-medium">كاش (الدرج)</span>
                    <span className="text-base font-bold text-[#14181F] tabular-nums">
                      {dailyRevenue.byMethod.cash?.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
                    <span className="text-xs text-[#5B6470] block font-medium">إنستا باي (InstaPay)</span>
                    <span className="text-base font-bold text-[#14181F] tabular-nums">
                      {dailyRevenue.byMethod.instapay?.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
                    <span className="text-xs text-[#5B6470] block font-medium">بطاقة / POS</span>
                    <span className="text-base font-bold text-[#14181F] tabular-nums">
                      {dailyRevenue.byMethod.card?.toLocaleString()} ج.م
                    </span>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]">
                    <span className="text-xs text-[#5B6470] block font-medium">محفظة رصيد</span>
                    <span className="text-base font-bold text-[#14181F] tabular-nums">
                      {dailyRevenue.byMethod.wallet?.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Two Columns: Expiring Subscriptions & Overdue Balances */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Expiring Subscriptions */}
            <section className="bg-white border border-[#E1E5DF] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#14181F]">اشتراكات تنتهي قريباً (خلال 7 أيام)</h3>
                  <span className="text-xs text-[#5B6470]">فرصة متابعة التجديد السريع</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportToCsv(
                      "expiring_subscriptions",
                      expiringSubs.map((s) => ({
                        المشترك: s.member.name,
                        الهاتف: s.member.phone,
                        الباقة: s.plan.name,
                        تاريخ_الانتهاء: s.endDate.slice(0, 10),
                        الأيام_المتبقية: s.daysRemaining,
                      }))
                    );
                  }}
                  className="border-[#E1E5DF] rounded-xl text-xs font-bold"
                >
                  <Download className="h-3 w-3 me-1" />
                  تصدير
                </Button>
              </div>

              {expiringSubs.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5B6470] bg-[#F2F4F1] rounded-xl">
                  لا توجد اشتراكات تنتهي خلال الأيام السبعة القادمة
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#E1E5DF] rounded-xl">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead className="bg-[#F2F4F1] text-[#5B6470] font-bold border-b border-[#E1E5DF]">
                      <tr>
                        <th className="py-2 px-3 text-start">المشترك</th>
                        <th className="py-2 px-3 text-start">الباقة</th>
                        <th className="py-2 px-3 text-center">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E5DF]">
                      {expiringSubs.map((s) => (
                        <tr key={s.id} className="hover:bg-[#F9FAF9]">
                          <td className="py-2 px-3 font-bold text-[#14181F]">
                            {s.member.name}
                            <span className="block text-[10px] text-[#5B6470] font-normal">
                              {s.member.phone}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#5B6470]">{s.plan.name}</td>
                          <td className="py-2 px-3 text-center">
                            <Badge variant="w">{s.daysRemaining} يوم</Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            {/* Overdue Balances */}
            <section className="bg-white border border-[#E1E5DF] rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#14181F]">أقساط ومستحقات متأخرة</h3>
                  <span className="text-xs text-[#5B6470]">أعضاء عليهم مبالغ متبقية للاشتراك</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    exportToCsv(
                      "overdue_balances",
                      overdueBalances.map((o) => ({
                        المشترك: o.member.name,
                        الهاتف: o.member.phone,
                        الباقة: o.plan.name,
                        الإجمالي: o.total,
                        المحصل: o.collected,
                        المتبقي: o.remainingDue,
                        الحالة: o.status,
                      }))
                    );
                  }}
                  className="border-[#E1E5DF] rounded-xl text-xs font-bold"
                >
                  <Download className="h-3 w-3 me-1" />
                  تصدير
                </Button>
              </div>

              {overdueBalances.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#5B6470] bg-[#F2F4F1] rounded-xl">
                  لا توجد مبالغ متأخرة مستحقة التحصيل
                </div>
              ) : (
                <div className="overflow-x-auto border border-[#E1E5DF] rounded-xl">
                  <table className="w-full text-xs text-start border-collapse">
                    <thead className="bg-[#F2F4F1] text-[#5B6470] font-bold border-b border-[#E1E5DF]">
                      <tr>
                        <th className="py-2 px-3 text-start">المشترك</th>
                        <th className="py-2 px-3 text-start">الباقة</th>
                        <th className="py-2 px-3 text-end font-black">المتبقي</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E1E5DF]">
                      {overdueBalances.map((o) => (
                        <tr key={o.id} className="hover:bg-[#F9FAF9]">
                          <td className="py-2 px-3 font-bold text-[#14181F]">
                            {o.member.name}
                            <span className="block text-[10px] text-[#5B6470] font-normal">
                              {o.member.phone}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-[#5B6470]">{o.plan.name}</td>
                          <td className="py-2 px-3 text-end font-bold text-[#B3261E] tabular-nums">
                            {o.remainingDue?.toLocaleString()} ج.م
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          {/* Coach Performance Matrix */}
          <section className="bg-white border border-[#E1E5DF] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-[#14181F]">مصفوفة أداء الكباتن والمدربين</h3>
                <p className="text-xs text-[#5B6470]">عدد المتدربين النشطين، الجلسات المنفذة، والإيراد المحصل</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportToCsv("coach_performance", coachPerformance);
                }}
                className="border-[#E1E5DF] rounded-xl text-xs font-bold"
              >
                <Download className="h-3.5 w-3.5 me-1" />
                تصدير المصفوفة
              </Button>
            </div>

            <div className="overflow-x-auto border border-[#E1E5DF] rounded-xl">
              <table className="w-full text-xs text-start border-collapse">
                <thead className="bg-[#F2F4F1] text-[#5B6470] font-bold border-b border-[#E1E5DF]">
                  <tr>
                    <th className="py-2.5 px-3 text-start">الكابتن</th>
                    <th className="py-2.5 px-3 text-center">المتدربين النشطين</th>
                    <th className="py-2.5 px-3 text-center">إجمالي الجلسات</th>
                    <th className="py-2.5 px-3 text-center">الجلسات المنفذة</th>
                    <th className="py-2.5 px-3 text-end">الإيراد المحصل (PT)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E5DF]">
                  {coachPerformance.map((c) => (
                    <tr key={c.coachId} className="hover:bg-[#F9FAF9]">
                      <td className="py-2.5 px-3 font-bold text-[#14181F]">
                        {c.name}
                      </td>
                      <td className="py-2.5 px-3 text-center font-bold text-[#14181F]">
                        {c.activeTrainees}
                      </td>
                      <td className="py-2.5 px-3 text-center text-[#5B6470]">
                        {c.totalSessions}
                      </td>
                      <td className="py-2.5 px-3 text-center font-semibold text-[#1B7F4B]">
                        {c.completedSessions}
                      </td>
                      <td className="py-2.5 px-3 text-end font-black text-[#14181F] tabular-nums">
                        {c.collectedRevenue?.toLocaleString()} ج.م
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: NOTIFICATIONS & AUDIT LOG */}
      {/* ========================================================================= */}
      {activeTab === "audit" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Notifications Center (1 col) */}
          <section className="bg-white border border-[#E1E5DF] rounded-2xl p-5 space-y-4 flex flex-col">
            <div className="flex items-center justify-between pb-2 border-b border-[#E1E5DF]">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-[#14181F]" />
                <h3 className="text-base font-bold text-[#14181F]">مركز التنبيهات</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  await markAllNotificationsRead();
                  await loadNotificationsAndAudit();
                  toast({ title: "تم التحديث", description: "تم تحديد جميع التنبيهات كمقروءة" });
                }}
                className="h-7 text-[11px] font-bold border-[#E1E5DF]"
              >
                قراءة الكل
              </Button>
            </div>

            {notifications.items.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#5B6470]">لا توجد تنبيهات جديدة</div>
            ) : (
              <div className="space-y-2.5 max-h-[500px] overflow-y-auto pe-1">
                {notifications.items.map((n) => (
                  <div
                    key={n.id}
                    onClick={async () => {
                      if (!n.isRead) {
                        await markNotificationRead(n.id);
                        await loadNotificationsAndAudit();
                      }
                    }}
                    className={`p-3 rounded-xl border transition-all cursor-pointer ${
                      n.isRead
                        ? "bg-[#F9FAF9] border-[#E1E5DF] opacity-75"
                        : "bg-white border-[#C6F24E] shadow-sm ring-1 ring-[#C6F24E]"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-[#14181F]">{n.title}</span>
                      <span className="text-[10px] text-[#5B6470] tabular-nums">
                        {new Date(n.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <p className="text-xs text-[#5B6470] leading-relaxed">{n.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Audit Log Viewer (2 cols) */}
          <section className="lg:col-span-2 bg-white border border-[#E1E5DF] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#E1E5DF]">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-[#14181F]" />
                <h3 className="text-base font-bold text-[#14181F]">سجل التدقيق والحركات (Audit Trail)</h3>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  exportToCsv(
                    "audit_trail",
                    auditLogs.map((a) => ({
                      الوقت: a.createdAt,
                      الإجراء: a.action,
                      الكيان: a.entityType,
                      المعرف: a.entityId,
                      الفاعل: a.actorId,
                    }))
                  );
                }}
                className="border-[#E1E5DF] rounded-xl text-xs font-bold"
              >
                <Download className="h-3.5 w-3.5 me-1" />
                تصدير السجل
              </Button>
            </div>

            {auditLoading ? (
              <div className="py-12 text-center text-xs text-[#5B6470]">جاري تحميل سجل التدقيق...</div>
            ) : auditLogs.length === 0 ? (
              <div className="py-12 text-center text-xs text-[#5B6470]">لا توجد سجلات تدقيق مسجلة</div>
            ) : (
              <div className="overflow-x-auto border border-[#E1E5DF] rounded-xl">
                <table className="w-full text-xs text-start border-collapse">
                  <thead className="bg-[#F2F4F1] text-[#5B6470] font-bold border-b border-[#E1E5DF]">
                    <tr>
                      <th className="py-2.5 px-3 text-start">الوقت</th>
                      <th className="py-2.5 px-3 text-start">نوع الإجراء</th>
                      <th className="py-2.5 px-3 text-start">الكيان</th>
                      <th className="py-2.5 px-3 text-start">الفاعل</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E5DF]">
                    {auditLogs.map((log: any) => (
                      <tr key={log.id} className="hover:bg-[#F9FAF9]">
                        <td className="py-2 px-3 text-[#5B6470] tabular-nums whitespace-nowrap">
                          {new Date(log.createdAt).toLocaleString("ar-EG")}
                        </td>
                        <td className="py-2 px-3 font-bold text-[#14181F]">
                          <Badge variant="default" className="font-semibold bg-[#F2F4F1] text-[#14181F] border border-[#E1E5DF]">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-[#5B6470]">
                          {log.entityType} ({log.entityId?.slice(0, 8)})
                        </td>
                        <td className="py-2 px-3 text-[#5B6470] font-mono text-[11px]">
                          {log.actorId || "System"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Dialogs */}
      <TiersEditorDialog
        open={tiersOpen}
        onOpenChange={setTiersOpen}
        coaches={coachesList}
        onSaved={() => loadRunDetail(selectedYear, selectedMonth)}
      />

      <AddPayrollLineDialog
        open={addLineOpen}
        onOpenChange={setAddLineOpen}
        runId={currentRun?.id || ""}
        staffList={currentRun ? currentRun.staff : []}
        onAdded={() => loadRunDetail(selectedYear, selectedMonth)}
      />

      <CoachMilestonesModal
        open={!!selectedCoachForModal}
        onOpenChange={(open) => !open && setSelectedCoachForModal(null)}
        coach={selectedCoachForModal}
        monthStr={`${selectedYear}-${String(selectedMonth).padStart(2, "0")}`}
      />
    </div>
  );
}
