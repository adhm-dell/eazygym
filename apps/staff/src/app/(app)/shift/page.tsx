"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Clock,
  Printer,
  Plus,
  AlertTriangle,
  Lock,
  Unlock,
  ShieldAlert,
  CreditCard,
  Smartphone,
  Wallet as WalletIcon,
  Users,
} from "lucide-react";
import { useToast, Button, Dialog } from "@gym/ui";
import { useShift } from "../../../lib/shift-context";
import { shiftApi } from "../../../features/shift/api";
import { formatMoney } from "../../../lib/money";
import { CloseShiftDialog } from "../../../features/shift/components/close-shift-dialog";
import { ShiftReportModal } from "../../../features/shift/components/shift-report-modal";
import { AddExpenseDialog } from "../../../features/shift/components/add-expense-dialog";
import type { Shift, ShiftReport, Staff } from "@gym/contracts";

export default function ShiftManagementPage() {
  const { toast } = useToast();
  const {
    shift: currentShift,
    isOpen: isShiftOpen,
    openShiftModal,
    refreshShift,
    currentUser,
    switchUser,
  } = useShift();

  const [activeTab, setActiveTab] = useState<"current" | "branch" | "history">("current");
  const [report, setReport] = useState<ShiftReport | null>(null);

  // Modals
  const [isCloseModalOpen, setIsCloseModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isCloseAllModalOpen, setIsCloseAllModalOpen] = useState(false);
  const [closeAllNote, setCloseAllNote] = useState("إقفال نهاية اليوم من الإدارة");
  const [isSubmittingCloseAll, setIsSubmittingCloseAll] = useState(false);

  // Selected shift for viewing report
  const [selectedReport, setSelectedReport] = useState<ShiftReport | null>(null);
  const [isViewPastReportOpen, setIsViewPastReportOpen] = useState(false);

  // Shifts List for Branch & History
  const [allShifts, setAllShifts] = useState<(Shift & { staff?: Staff; closedBy?: Staff | null })[]>([]);
  const [historyStaffFilter, setHistoryStaffFilter] = useState("");
  const [historyVarianceOnly, setHistoryVarianceOnly] = useState(false);
  const [allStaffList, setAllStaffList] = useState<Staff[]>([]);

  // Current Shift Transactions Sub-filter
  const [txFilter, setTxFilter] = useState<"all" | "payments" | "expenses" | "vouchers">("all");

  const isAdmin = currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN";

  // Load current shift report
  const loadReport = async () => {
    if (!currentShift) {
      setReport(null);
      return;
    }
    try {
      const rep = await shiftApi.getShiftReport(currentShift.id);
      setReport(rep);
    } catch {
      // shift might be closed or empty
    }
  };

  // Load all shifts and staff
  const loadAllShifts = async () => {
    try {
      const [shifts, staff] = await Promise.all([
        shiftApi.listShifts(),
        shiftApi.listStaff(),
      ]);
      setAllShifts(shifts);
      setAllStaffList(staff);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    }
  };

  useEffect(() => {
    loadReport();
    loadAllShifts();
  }, [currentShift?.id, isShiftOpen]);

  // Handle Switch Staff
  const handleSwitchStaff = async (staffId: string) => {
    try {
      await switchUser(staffId);
      await loadAllShifts();
    } catch {
      // handled
    }
  };

  // Handle Admin Close All
  const handleConfirmCloseAll = async () => {
    if (!closeAllNote.trim()) {
      toast({ title: "بيانات ناقصة", description: "يرجى كتابة سبب الإقفال الجماعي", variant: "warning" });
      return;
    }
    setIsSubmittingCloseAll(true);
    try {
      const closed = await shiftApi.adminCloseAllShifts(closeAllNote.trim(), currentUser?.id);
      toast({
        title: "تم الإقفال الجماعي بنجاح",
        description: `تم إقفال ${closed.length} وردية مفتوحة بواسطة الإدارة وتجميد كاش الدرج`,
        variant: "success",
      });
      setIsCloseAllModalOpen(false);
      await refreshShift();
      await loadAllShifts();
    } catch (err: any) {
      toast({ title: "خطأ في الإقفال الجماعي", description: err.message, variant: "error" });
    } finally {
      setIsSubmittingCloseAll(false);
    }
  };

  // Open past shift report
  const handleViewShiftReport = async (shiftId: string) => {
    try {
      const rep = await shiftApi.getShiftReport(shiftId);
      setSelectedReport(rep);
      setIsViewPastReportOpen(true);
    } catch (err: any) {
      toast({ title: "تعذر فتح التقرير", description: err.message, variant: "error" });
    }
  };

  // Open Shifts across branch
  const openShiftsList = useMemo(() => {
    return allShifts.filter((s) => s.status === "OPEN");
  }, [allShifts]);

  // History filtered
  const filteredHistory = useMemo(() => {
    let list = allShifts.filter((s) => s.status === "CLOSED");
    if (historyStaffFilter) {
      list = list.filter((s) => s.staffId === historyStaffFilter);
    }
    if (historyVarianceOnly) {
      list = list.filter((s) => s.variance !== null && s.variance !== 0);
    }
    return list;
  }, [allShifts, historyStaffFilter, historyVarianceOnly]);

  // Current Shift Combined Records
  const combinedRecords = useMemo(() => {
    if (!report) return [];
    const list: {
      id: string;
      kind: "PAYMENT" | "EXPENSE" | "RECEIPT_VOUCHER" | "DISBURSEMENT_VOUCHER";
      title: string;
      category?: string;
      amount: number;
      isPositive: boolean;
      method: string;
      timestamp: string;
      actor: string;
    }[] = [];

    // Payments
    (report?.records?.payments || []).forEach((p) => {
      list.push({
        id: p.id,
        kind: "PAYMENT",
        title: p.note || `سداد فاتورة #${p.invoiceId || ""}`,
        amount: p.amount,
        isPositive: true,
        method: p.method,
        timestamp: p.createdAt,
        actor: "الاستقبال",
      });
    });

    // Expenses
    (report?.records?.expenses || []).forEach((e) => {
      list.push({
        id: e.id,
        kind: "EXPENSE",
        title: e.description || e.category,
        category: e.category,
        amount: e.amount,
        isPositive: false,
        method: e.paidFromDrawer ? "الخزينة (درج الكاش)" : "حساب الصالة",
        timestamp: e.createdAt,
        actor: e.createdBy?.name || "المشغل",
      });
    });

    // Vouchers
    (report?.records?.vouchers || []).forEach((v) => {
      const isReceipt = v.type === "RECEIPT";
      list.push({
        id: v.id,
        kind: isReceipt ? "RECEIPT_VOUCHER" : "DISBURSEMENT_VOUCHER",
        title: v.reason,
        amount: v.amount,
        isPositive: isReceipt,
        method: v.method,
        timestamp: v.createdAt,
        actor: "الخزينة",
      });
    });

    list.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    if (txFilter === "payments") return list.filter((x) => x.kind === "PAYMENT");
    if (txFilter === "expenses") return list.filter((x) => x.kind === "EXPENSE");
    if (txFilter === "vouchers")
      return list.filter((x) => x.kind === "RECEIPT_VOUCHER" || x.kind === "DISBURSEMENT_VOUCHER");

    return list;
  }, [report, txFilter]);

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4F1] text-[#14181F]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E1E5DF] p-4 md:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-black">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-[20px] font-bold tracking-tight">
                إدارة الوردية والخزينة (Shift & Drawer)
              </h1>
              <span
                className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                  isShiftOpen
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-red-100 text-red-800"
                }`}
              >
                {isShiftOpen ? "الوردية مفتوحة" : "الوردية مغلقة"}
              </span>
            </div>
            <p className="text-[13px] text-[#5B6470]">
              جرد الخزينة النقدية، متابعة المقبوضات والمصروفات، وتسليم العهدة
            </p>
          </div>
        </div>

        {/* User Switcher & Main Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          {/* User Profile / Simulator Switcher */}
          <div className="flex items-center gap-2 bg-[#F2F4F1] px-3 py-1.5 rounded-xl border border-[#E1E5DF]">
            <Users className="h-4 w-4 text-[#5B6470]" />
            <div className="text-[12px]">
              <span className="text-[#5B6470] block text-[10px]">المستخدم الحالي:</span>
              <select
                value={currentUser?.id || "staff_reception"}
                onChange={(e) => handleSwitchStaff(e.target.value)}
                className="bg-transparent font-bold text-[#14181F] focus:outline-none cursor-pointer"
              >
                {allStaffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Shift Actions */}
          {isShiftOpen ? (
            <>
              <Button
                variant="outline"
                onClick={() => setIsReportModalOpen(true)}
                className="text-[13px] font-bold border-[#E1E5DF]"
              >
                <Printer className="h-4 w-4 me-1.5" />
                تقرير الوردية
              </Button>

              <Button
                onClick={() => setIsCloseModalOpen(true)}
                className="bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] text-[13px] font-bold"
              >
                <Lock className="h-4 w-4 me-1.5" />
                إقفال الوردية والتسليم
              </Button>
            </>
          ) : (
            <Button
              onClick={openShiftModal}
              className="bg-[#C6F24E] text-[#14181F] hover:bg-[#b5e03e] text-[13px] font-bold"
            >
              <Unlock className="h-4 w-4 me-1.5" />
              فتح وردية جديدة
            </Button>
          )}

          {isAdmin && openShiftsList.length > 0 && (
            <Button
              variant="outline"
              onClick={() => setIsCloseAllModalOpen(true)}
              className="text-red-700 border-red-300 hover:bg-red-50 text-[13px] font-bold"
            >
              <ShieldAlert className="h-4 w-4 me-1.5" />
              إقفال جميع الورديات (Close All)
            </Button>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 md:p-8 space-y-6 flex-1">
        {/* Closed Shift Alert Banner if applicable */}
        {!isShiftOpen && (
          <div className="p-4 rounded-2xl bg-[#FFF1D6] border border-[#F2C94C] text-[#8A5A00] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-[#8A5A00] text-white flex items-center justify-center font-bold shrink-0">
                <Lock className="h-5 w-5" />
              </div>
              <div>
                <b className="text-[15px] block">لا توجد وردية مفتوحة لهذا الموظف</b>
                <p className="text-[13px] opacity-90">
                  جميع عمليات البيع والتحصيل النقدي وتسجيل المصروفات متوقفة حتى يتم فتح الوردية وتوثيق العهدة
                </p>
              </div>
            </div>
            <Button
              onClick={openShiftModal}
              className="bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] font-bold text-[13px] shrink-0"
            >
              فتح الوردية الآن
            </Button>
          </div>
        )}

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Expected Cash (الكاش المتوقع بالدرج) */}
          <div className="bg-white rounded-2xl border-2 border-[#14181F] p-5 shadow-card flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                الكاش المتوقع بدرج الخزينة (Expected Cash)
              </span>
              <div className="text-[28px] font-mono font-black text-[#14181F] tracking-tight">
                {formatMoney(report?.expectedCash || currentShift?.expectedCash || 0)}
              </div>
            </div>
            <p className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF]">
              العهدة الافتتاحية + المقبوضات - المنصرفات النقدية
            </p>
          </div>

          {/* Card 2: Opening Cash (العهدة الافتتاحية) */}
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                العهدة الافتتاحية (Opening Cash)
              </span>
              <div className="text-[24px] font-mono font-bold text-[#14181F]">
                {formatMoney(currentShift?.openingCash || 0)}
              </div>
            </div>
            <p className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF]">
              المبلغ المسجل في بداية الوردية
            </p>
          </div>

          {/* Card 3: Total Cash In (الوارد النقدي) */}
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                إجمالي الوارد النقدي (Cash In)
              </span>
              <div className="text-[24px] font-mono font-bold text-emerald-800">
                +{formatMoney((report?.cashPayments || 0) + (report?.cashReceiptVouchers || 0))}
              </div>
            </div>
            <div className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF] flex justify-between">
              <span>مبيعات: {formatMoney(report?.cashPayments || 0)}</span>
              <span>سندات: {formatMoney(report?.cashReceiptVouchers || 0)}</span>
            </div>
          </div>

          {/* Card 4: Total Cash Out (المنصرف النقدي) */}
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                إجمالي المنصرف النقدي (Cash Out)
              </span>
              <div className="text-[24px] font-mono font-bold text-red-700">
                -{formatMoney((report?.expensesFromDrawer || 0) + (report?.cashDisbursementVouchers || 0))}
              </div>
            </div>
            <div className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF] flex justify-between">
              <span>مصروفات: {formatMoney(report?.expensesFromDrawer || 0)}</span>
              <span>سندات: {formatMoney(report?.cashDisbursementVouchers || 0)}</span>
            </div>
          </div>
        </div>

        {/* Separate Electronic Payment Rails (Never in drawer) */}
        <div className="p-4 rounded-2xl bg-white border border-[#E1E5DF] flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-subtle">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
              <CreditCard className="h-4 w-4" />
            </div>
            <div>
              <b className="text-[14px] text-[#14181F] block">
                المدفوعات الإلكترونية المحصلة (خارج درج النقدية)
              </b>
              <p className="text-[11px] text-[#5B6470]">
                مبالغ محولة إلكترونياً لحسابات الصالة البنكية أو المحفظة، لا تدخل في جرد الكاش
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-[13px]">
            <div className="flex items-center gap-1.5 bg-[#F2F4F1] px-3 py-1.5 rounded-xl">
              <Smartphone className="h-3.5 w-3.5 text-purple-700" />
              <span className="text-[#5B6470]">إنستاباي:</span>
              <b className="font-mono text-[#14181F]">
                {formatMoney(report?.instapayPayments || 0)}
              </b>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F2F4F1] px-3 py-1.5 rounded-xl">
              <CreditCard className="h-3.5 w-3.5 text-blue-700" />
              <span className="text-[#5B6470]">بطاقات فيزا:</span>
              <b className="font-mono text-[#14181F]">
                {formatMoney(report?.cardPayments || 0)}
              </b>
            </div>

            <div className="flex items-center gap-1.5 bg-[#F2F4F1] px-3 py-1.5 rounded-xl">
              <WalletIcon className="h-3.5 w-3.5 text-emerald-700" />
              <span className="text-[#5B6470]">المحفظة:</span>
              <b className="font-mono text-[#14181F]">
                {formatMoney(report?.walletPayments || 0)}
              </b>
            </div>
          </div>
        </div>

        {/* Navigation Tabs between: Current Shift Records / Open Shifts in Branch / Shift History */}
        <div className="flex items-center gap-2 border-b border-[#E1E5DF] pb-3">
          <button
            type="button"
            onClick={() => setActiveTab("current")}
            className={`px-4 py-2 rounded-xl text-[14px] font-bold transition-colors ${
              activeTab === "current"
                ? "bg-[#14181F] text-white"
                : "bg-white text-[#5B6470] hover:bg-[#E1E5DF]/50"
            }`}
          >
            حركات الوردية الحالية
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("branch")}
            className={`px-4 py-2 rounded-xl text-[14px] font-bold transition-colors relative ${
              activeTab === "branch"
                ? "bg-[#14181F] text-white"
                : "bg-white text-[#5B6470] hover:bg-[#E1E5DF]/50"
            }`}
          >
            <span>ورديات الفرع المفتوحة</span>
            {openShiftsList.length > 0 && (
              <span className="ms-1.5 px-2 py-0.2 bg-[#C6F24E] text-[#14181F] text-[11px] font-black rounded-full">
                {openShiftsList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={`px-4 py-2 rounded-xl text-[14px] font-bold transition-colors ${
              activeTab === "history"
                ? "bg-[#14181F] text-white"
                : "bg-white text-[#5B6470] hover:bg-[#E1E5DF]/50"
            }`}
          >
            سجل الورديات المقفلة
          </button>
        </div>

        {/* TAB 1: Current Shift Records */}
        {activeTab === "current" && (
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-6 shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-bold text-[#14181F]">
                  سجل المعاملات والمدفوعات الحية على الوردية
                </h3>
                <p className="text-[12px] text-[#5B6470]">
                  عرض تفصيلي لكل حركة مالية مسجلة تؤثر على الخزينة
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsAddExpenseOpen(true)}
                  disabled={!isShiftOpen}
                  className="font-bold text-[12px]"
                >
                  <Plus className="h-3.5 w-3.5 me-1" />
                  تسجيل مصروف
                </Button>

                {/* Sub Filters */}
                <div className="flex items-center gap-1 bg-[#F2F4F1] p-1 rounded-xl text-[12px]">
                  <button
                    type="button"
                    onClick={() => setTxFilter("all")}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      txFilter === "all" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxFilter("payments")}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      txFilter === "payments" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                    }`}
                  >
                    مبيعات
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxFilter("expenses")}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      txFilter === "expenses" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                    }`}
                  >
                    مصروفات
                  </button>
                  <button
                    type="button"
                    onClick={() => setTxFilter("vouchers")}
                    className={`px-2.5 py-1 rounded-lg font-bold ${
                      txFilter === "vouchers" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                    }`}
                  >
                    سندات
                  </button>
                </div>
              </div>
            </div>

            {/* Transactions Table */}
            {combinedRecords.length === 0 ? (
              <div className="py-12 text-center text-[#5B6470] text-[13px]">
                لا توجد معاملات مسجلة على هذه الوردية حتى الآن
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#E1E5DF] text-[#5B6470] text-[12px]">
                      <th className="py-2.5 text-start">الوقت</th>
                      <th className="py-2.5 text-start">النوع</th>
                      <th className="py-2.5 text-start">البيان / الوصف</th>
                      <th className="py-2.5 text-start">طريقة السداد</th>
                      <th className="py-2.5 text-start">المسؤول</th>
                      <th className="py-2.5 text-end">القيمة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E5DF]">
                    {combinedRecords.map((r) => (
                      <tr key={r.id} className="hover:bg-[#F2F4F1]/40 transition-colors">
                        <td className="py-2.5 text-[#5B6470] font-mono text-[11px]">
                          {new Date(r.timestamp).toLocaleTimeString("ar-EG", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                              r.kind === "PAYMENT"
                                ? "bg-emerald-100 text-emerald-800"
                                : r.kind === "EXPENSE"
                                ? "bg-red-100 text-red-800"
                                : r.kind === "RECEIPT_VOUCHER"
                                ? "bg-purple-100 text-purple-800"
                                : "bg-amber-100 text-amber-800"
                            }`}
                          >
                            {r.kind === "PAYMENT"
                              ? "سداد فاتورة"
                              : r.kind === "EXPENSE"
                              ? "مصروف تشغيلي"
                              : r.kind === "RECEIPT_VOUCHER"
                              ? "سند قبض"
                              : "سند صرف"}
                          </span>
                        </td>
                        <td className="py-2.5 font-bold text-[#14181F]">{r.title}</td>
                        <td className="py-2.5 text-[#5B6470] text-[12px]">{r.method}</td>
                        <td className="py-2.5 text-[#5B6470] text-[12px]">{r.actor}</td>
                        <td
                          className={`py-2.5 text-end font-mono font-bold ${
                            r.isPositive ? "text-emerald-800" : "text-red-700"
                          }`}
                        >
                          {r.isPositive ? "+" : "-"}
                          {formatMoney(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Open Shifts in Branch */}
        {activeTab === "branch" && (
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-6 shadow-subtle space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-bold text-[#14181F]">
                  الورديات المفتوحة حالياً في الفرع
                </h3>
                <p className="text-[12px] text-[#5B6470]">
                  متابعة حالة خزائن الاستقبال والبار والمدفوعات الحية
                </p>
              </div>

              {isAdmin && openShiftsList.length > 0 && (
                <Button
                  onClick={() => setIsCloseAllModalOpen(true)}
                  className="bg-red-600 hover:bg-red-700 text-white font-bold text-[12px]"
                >
                  <ShieldAlert className="h-4 w-4 me-1.5" />
                  إقفال جميع الورديات المفتوحة (Close All)
                </Button>
              )}
            </div>

            {openShiftsList.length === 0 ? (
              <div className="py-12 text-center text-[#5B6470] text-[13px]">
                لا توجد أي وردية مفتوحة حالياً بالفرع
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#E1E5DF] text-[#5B6470] text-[12px]">
                      <th className="py-2.5 text-start">الموظف / المشغل</th>
                      <th className="py-2.5 text-start">الدور</th>
                      <th className="py-2.5 text-start">وقت الفتح</th>
                      <th className="py-2.5 text-end">العهدة الافتتاحية</th>
                      <th className="py-2.5 text-end">الكاش المتوقع بالدرج</th>
                      <th className="py-2.5 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E5DF]">
                    {openShiftsList.map((s) => {
                      const isOwner = currentUser?.id === s.staffId;
                      const canClose = isAdmin || isOwner;

                      return (
                        <tr key={s.id} className="hover:bg-[#F2F4F1]/40 transition-colors">
                          <td className="py-3 font-bold text-[#14181F]">
                            {s.staff?.name || s.staffId}
                          </td>
                          <td className="py-3 text-[#5B6470]">{s.staff?.role || "موظف"}</td>
                          <td className="py-3 text-[#5B6470] font-mono text-[11px]">
                            {new Date(s.openedAt).toLocaleString("ar-EG")}
                          </td>
                          <td className="py-3 text-end font-mono font-bold">
                            {formatMoney(s.openingCash)}
                          </td>
                          <td className="py-3 text-end font-mono font-black text-emerald-800">
                            {formatMoney(s.expectedCash || s.openingCash)}
                          </td>
                          <td className="py-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleViewShiftReport(s.id)}
                                className="text-[11px] font-bold"
                              >
                                تقرير
                              </Button>
                              <Button
                                size="sm"
                                onClick={async () => {
                                  if (!canClose) {
                                    toast({
                                      title: "غير مصرح",
                                      description: "لا يمكنك إقفال وردية موظف آخر، هذه الصلاحية للمدير فقط",
                                      variant: "error",
                                    });
                                    return;
                                  }
                                  setIsCloseModalOpen(true);
                                }}
                                className={`text-[11px] font-bold ${
                                  canClose
                                    ? "bg-[#14181F] text-[#C6F24E]"
                                    : "bg-gray-100 text-gray-400 cursor-not-allowed"
                                }`}
                              >
                                إقفال وجرد
                              </Button>
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
        )}

        {/* TAB 3: Shift History */}
        {activeTab === "history" && (
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-6 shadow-subtle space-y-4">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
              <div>
                <h3 className="text-[16px] font-bold text-[#14181F]">
                  سجل الورديات المقفلة والجرد
                </h3>
                <p className="text-[12px] text-[#5B6470]">
                  أرشيف الورديات السابقة وفروق الجرد النقدية
                </p>
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-3">
                <select
                  value={historyStaffFilter}
                  onChange={(e) => setHistoryStaffFilter(e.target.value)}
                  className="px-3 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[12px] font-bold text-[#14181F]"
                >
                  <option value="">جميع الموظفين</option>
                  {allStaffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>

                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold text-[#14181F] bg-[#F2F4F1] px-3 py-1.5 rounded-xl border border-[#E1E5DF]">
                  <input
                    type="checkbox"
                    checked={historyVarianceOnly}
                    onChange={(e) => setHistoryVarianceOnly(e.target.checked)}
                    className="rounded text-[#14181F]"
                  />
                  <span>ورديات بها عجز أو زيادة فقط</span>
                </label>
              </div>
            </div>

            {/* History Table */}
            {filteredHistory.length === 0 ? (
              <div className="py-12 text-center text-[#5B6470] text-[13px]">
                لا توجد ورديات تطابق الفلاتر المحددة
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-start text-[13px] border-collapse">
                  <thead>
                    <tr className="border-b border-[#E1E5DF] text-[#5B6470] text-[12px]">
                      <th className="py-2.5 text-start">كود الوردية</th>
                      <th className="py-2.5 text-start">الموظف</th>
                      <th className="py-2.5 text-start">تاريخ الفتح والإقفال</th>
                      <th className="py-2.5 text-end">المتوقع بالدرج</th>
                      <th className="py-2.5 text-end">الفعلي بعد الجرد</th>
                      <th className="py-2.5 text-end">الفارق (العجز/الزيادة)</th>
                      <th className="py-2.5 text-start">أقفل بواسطة</th>
                      <th className="py-2.5 text-center">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E5DF]">
                    {filteredHistory.map((s) => {
                      const variance = s.variance;
                      const hasCount = s.countedCash !== null;

                      return (
                        <tr key={s.id} className="hover:bg-[#F2F4F1]/40 transition-colors">
                          <td className="py-3 font-mono font-bold text-[12px]">{s.id}</td>
                          <td className="py-3 font-bold text-[#14181F]">
                            {s.staff?.name || s.staffId}
                          </td>
                          <td className="py-3 text-[11px] text-[#5B6470] font-mono">
                            <div>{new Date(s.openedAt).toLocaleDateString("ar-EG")}</div>
                            <div className="opacity-75">
                              {new Date(s.openedAt).toLocaleTimeString("ar-EG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                              {" - "}
                              {s.closedAt
                                ? new Date(s.closedAt).toLocaleTimeString("ar-EG", {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : ""}
                            </div>
                          </td>
                          <td className="py-3 text-end font-mono font-bold">
                            {formatMoney(s.expectedCash || 0)}
                          </td>
                          <td className="py-3 text-end font-mono">
                            {hasCount ? formatMoney(s.countedCash!) : "لم يُجرد"}
                          </td>
                          <td className="py-3 text-end font-mono">
                            {hasCount && variance !== null ? (
                              <span
                                className={`inline-block px-2 py-0.5 rounded-lg font-bold text-[11px] ${
                                  variance < 0
                                    ? "bg-red-100 text-red-800"
                                    : variance > 0
                                    ? "bg-emerald-100 text-emerald-800"
                                    : "bg-emerald-50 text-emerald-700"
                                }`}
                              >
                                {variance > 0 && "+"}
                                {formatMoney(variance)}
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#5B6470]">إقفال إداري</span>
                            )}
                          </td>
                          <td className="py-3 text-[12px] text-[#5B6470]">
                            {s.closedBy?.name || "نفس المشغل"}
                          </td>
                          <td className="py-3 text-center">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleViewShiftReport(s.id)}
                              className="text-[11px] font-bold"
                            >
                              <Printer className="h-3.5 w-3.5 me-1" />
                              عرض التقرير
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </main>

      {/* CLOSE SHIFT DIALOG */}
      <CloseShiftDialog
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onSuccess={(closed, rep) => {
          setSelectedReport(rep);
          setIsViewPastReportOpen(true);
        }}
      />

      {/* CURRENT SHIFT REPORT MODAL */}
      <ShiftReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        report={report}
      />

      {/* VIEW PAST SHIFT REPORT MODAL */}
      <ShiftReportModal
        isOpen={isViewPastReportOpen}
        onClose={() => {
          setIsViewPastReportOpen(false);
          setSelectedReport(null);
        }}
        report={selectedReport}
      />

      {/* ADD EXPENSE DIALOG */}
      <AddExpenseDialog
        isOpen={isAddExpenseOpen}
        onClose={() => setIsAddExpenseOpen(false)}
        onSuccess={() => {
          toast({ title: "تم تسجيل المصروف بنجاح", variant: "success" });
          loadReport();
        }}
      />

      {/* ADMIN CLOSE ALL CONFIRMATION DIALOG */}
      <Dialog
        isOpen={isCloseAllModalOpen}
        onClose={() => setIsCloseAllModalOpen(false)}
        title="تأكيد الإقفال الجماعي لجميع الورديات (Close All)"
        description="سيتم إقفال وتجميد جميع الورديات المفتوحة في الفرع حالياً دون جرد فعلي"
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[12px] font-bold flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-600 shrink-0" />
            <span>
              تنبيه: سيتم إقفال {openShiftsList.length} وردية مفتوحة، ولن يُسمح بأي حركات نقدية لاحقة عليها
            </span>
          </div>

          <div>
            <label className="text-[12px] font-bold text-[#14181F] block mb-1">
              ملاحظة الإقفال الإداري (إلزامية):
            </label>
            <input
              type="text"
              value={closeAllNote}
              onChange={(e) => setCloseAllNote(e.target.value)}
              placeholder="مثال: إقفال نهاية اليوم / جرد مسائي من الإدارة..."
              className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-bold"
              required
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E5DF]">
            <Button
              variant="outline"
              onClick={() => setIsCloseAllModalOpen(false)}
              disabled={isSubmittingCloseAll}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmCloseAll}
              isLoading={isSubmittingCloseAll}
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              تأكيد الإقفال الجماعي
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
