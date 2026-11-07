"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  DollarSign,
  Plus,
  Search,
  Ban,
  ShieldAlert,
} from "lucide-react";
import { useToast, Button, Dialog } from "@gym/ui";
import { useShift } from "../../../lib/shift-context";
import { shiftApi } from "../../../features/shift/api";
import { formatMoney } from "../../../lib/money";
import { AddExpenseDialog } from "../../../features/shift/components/add-expense-dialog";
import type { Expense } from "@gym/mock-data";

export default function ExpensesPage() {
  const { toast } = useToast();
  const { shift: currentShift, isOpen: isShiftOpen, currentUser } = useShift();

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [shiftFilter, setShiftFilter] = useState<"all" | "current">("current");
  const [drawerOnly, setDrawerOnly] = useState(false);

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedExpenseToVoid, setSelectedExpenseToVoid] = useState<Expense | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [isVoiding, setIsVoiding] = useState(false);

  const isAdmin = currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN";

  const loadExpenses = async () => {
    setIsLoading(true);
    try {
      const list = await shiftApi.listExpenses();
      setExpenses(list);
    } catch (err: any) {
      toast({ title: "خطأ في تحميل المصروفات", description: err.message, variant: "error" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, [currentShift?.id]);

  // Handle Void Expense
  const handleConfirmVoid = async () => {
    if (!selectedExpenseToVoid) return;
    if (!voidReason.trim()) {
      toast({ title: "بيانات ناقصة", description: "يرجى كتابة سبب الإلغاء بوضوح", variant: "warning" });
      return;
    }
    setIsVoiding(true);
    try {
      await shiftApi.voidExpense(selectedExpenseToVoid.id, voidReason.trim(), currentUser?.id);
      toast({
        title: "تم إلغاء المصروف بنجاح",
        description: `تم إبطال قيد المصروف #${selectedExpenseToVoid.id} وتعديل الخزينة إن كانت مفتوحة`,
        variant: "info",
      });
      setSelectedExpenseToVoid(null);
      setVoidReason("");
      await loadExpenses();
    } catch (err: any) {
      toast({ title: "تعذر إلغاء المصروف", description: err.message, variant: "error" });
    } finally {
      setIsVoiding(false);
    }
  };

  // Filtered Expenses
  const filteredExpenses = useMemo(() => {
    return expenses.filter((e) => {
      if (shiftFilter === "current" && currentShift && e.shiftId !== currentShift.id) {
        return false;
      }
      if (selectedCategory && e.category !== selectedCategory) {
        return false;
      }
      if (drawerOnly && !e.paidFromDrawer) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const desc = (e.description || "").toLowerCase();
        const cat = e.category.toLowerCase();
        if (!desc.includes(q) && !cat.includes(q)) return false;
      }
      return true;
    });
  }, [expenses, shiftFilter, currentShift, selectedCategory, drawerOnly, searchQuery]);

  // Stats Calculations
  const activeExpenses = expenses.filter((e) => !e.voidedAt);
  const totalAmount = activeExpenses.reduce((sum, e) => sum + e.amount, 0);
  const drawerAmount = activeExpenses
    .filter((e) => e.paidFromDrawer)
    .reduce((sum, e) => sum + e.amount, 0);
  const nonDrawerAmount = totalAmount - drawerAmount;

  const currentShiftActiveExpenses = activeExpenses.filter(
    (e) => currentShift && e.shiftId === currentShift.id
  );
  const currentShiftDrawerAmount = currentShiftActiveExpenses
    .filter((e) => e.paidFromDrawer)
    .reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4F1] text-[#14181F]">
      {/* Top Header */}
      <header className="bg-white border-b border-[#E1E5DF] p-4 md:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-black">
            <DollarSign className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">
              المصروفات التشغيلية (Expenses)
            </h1>
            <p className="text-[13px] text-[#5B6470]">
              تسجيل ومتابعة المصروفات اليومية ومصروفات درج الخزينة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <Button
            onClick={() => setIsAddModalOpen(true)}
            disabled={!isShiftOpen}
            className="bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] font-bold text-[13px] w-full md:w-auto"
          >
            <Plus className="h-4 w-4 me-1.5" />
            تسجيل مصروف جديد
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="p-4 md:p-8 space-y-6 flex-1">
        {/* Closed Shift warning if applicable */}
        {!isShiftOpen && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-[13px] font-bold flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-700" />
            <span>
              الوردية الحالية مغلقة. يتطلب تسجيل المصروفات وجود وردية مفتوحة لربطها بالخزينة.
            </span>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                مصروفات الوردية الحالية (الدرج)
              </span>
              <div className="text-[24px] font-mono font-black text-red-700">
                {formatMoney(currentShiftDrawerAmount)}
              </div>
            </div>
            <p className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF]">
              يتم خصمها تلقائياً من كاش الدرج المتوقع
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                إجمالي المصروفات من الخزائن (Drawer)
              </span>
              <div className="text-[24px] font-mono font-bold text-[#14181F]">
                {formatMoney(drawerAmount)}
              </div>
            </div>
            <p className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF]">
              مجموع المنصرف النقدي من ورديات الاستقبال
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                مصروفات عامة وبنكية (Non-Drawer)
              </span>
              <div className="text-[24px] font-mono font-bold text-[#5B6470]">
                {formatMoney(nonDrawerAmount)}
              </div>
            </div>
            <p className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF]">
              صيانة وفواتير مدفوعة من حساب الصالة
            </p>
          </div>

          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-5 shadow-subtle flex flex-col justify-between">
            <div>
              <span className="text-[12px] font-bold text-[#5B6470] block mb-1">
                إجمالي المصروفات النشطة
              </span>
              <div className="text-[24px] font-mono font-black text-[#14181F]">
                {formatMoney(totalAmount)}
              </div>
            </div>
            <p className="text-[11px] text-[#5B6470] mt-3 pt-2 border-t border-[#E1E5DF]">
              {activeExpenses.length} بنود مصروفات نشطة
            </p>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4 shadow-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="h-4 w-4 absolute start-3 top-1/2 -translate-y-1/2 text-[#5B6470]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="بحث في البيان أو التصنيف..."
              className="w-full ps-9 pe-4 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[12px] font-bold text-[#14181F]"
            >
              <option value="">جميع التصنيفات</option>
              <option value="نظافة وضيافة">نظافة وضيافة</option>
              <option value="صيانة وإصلاحات">صيانة وإصلاحات</option>
              <option value="مطبوعات وأدوات مكتبية">مطبوعات وأدوات مكتبية</option>
              <option value="مياه ومشروبات">مياه ومشروبات</option>
              <option value="أخرى">أخرى</option>
            </select>

            <div className="flex items-center gap-1 bg-[#F2F4F1] p-1 rounded-xl text-[12px]">
              <button
                type="button"
                onClick={() => setShiftFilter("current")}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  shiftFilter === "current" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                }`}
              >
                الوردية الحالية
              </button>
              <button
                type="button"
                onClick={() => setShiftFilter("all")}
                className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                  shiftFilter === "all" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                }`}
              >
                كل السجل
              </button>
            </div>

            <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold text-[#14181F] bg-[#F2F4F1] px-3 py-2 rounded-xl border border-[#E1E5DF]">
              <input
                type="checkbox"
                checked={drawerOnly}
                onChange={(e) => setDrawerOnly(e.target.checked)}
                className="rounded text-[#14181F]"
              />
              <span>من الخزينة فقط</span>
            </label>
          </div>
        </div>

        {/* Expenses DataTable */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle overflow-hidden">
          {isLoading ? (
            <div className="py-16 text-center text-[#5B6470] font-bold text-[14px]">
              جاري تحميل جدول المصروفات...
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div className="py-16 text-center text-[#5B6470] text-[13px]">
              لا توجد مصروفات تطابق خيارات البحث
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-start text-[13px] border-collapse">
                <thead className="bg-[#F2F4F1] text-[#5B6470] text-[12px]">
                  <tr>
                    <th className="py-3 px-4 text-start">التاريخ والوقت</th>
                    <th className="py-3 px-4 text-start">التصنيف</th>
                    <th className="py-3 px-4 text-start">البيان والتفاصيل</th>
                    <th className="py-3 px-4 text-start">مصدر الدفع</th>
                    <th className="py-3 px-4 text-start">المسؤول</th>
                    <th className="py-3 px-4 text-start">رقم الوردية</th>
                    <th className="py-3 px-4 text-end">المبلغ</th>
                    <th className="py-3 px-4 text-center">الحالة / إجراء</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E5DF]">
                  {filteredExpenses.map((exp) => {
                    const isVoided = Boolean(exp.voidedAt);

                    return (
                      <tr
                        key={exp.id}
                        className={`hover:bg-[#F2F4F1]/30 transition-colors ${
                          isVoided ? "opacity-60 bg-gray-50 line-through" : ""
                        }`}
                      >
                        <td className="py-3 px-4 text-[#5B6470] font-mono text-[11px] whitespace-nowrap">
                          <div>{new Date(exp.createdAt).toLocaleDateString("ar-EG")}</div>
                          <div className="opacity-75">
                            {new Date(exp.createdAt).toLocaleTimeString("ar-EG", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-bold whitespace-nowrap">
                          <span className="inline-block px-2.5 py-0.5 rounded-lg bg-[#F2F4F1] text-[#14181F] text-[11px]">
                            {exp.category}
                          </span>
                        </td>
                        <td className="py-3 px-4 font-medium text-[#14181F] max-w-xs">
                          <div>{exp.description || "بدون بيان تفصيلي"}</div>
                          {isVoided && exp.voidReason && (
                            <div className="text-[11px] text-red-600 no-underline font-normal mt-0.5">
                              ملغي: {exp.voidReason}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {exp.paidFromDrawer ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                              درج الخزينة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                              حساب الصالة
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-[#5B6470] text-[12px] whitespace-nowrap">
                          {exp.createdBy?.name || exp.createdById}
                        </td>
                        <td className="py-3 px-4 text-[#5B6470] font-mono text-[11px] whitespace-nowrap">
                          #{exp.shiftId}
                        </td>
                        <td className="py-3 px-4 text-end font-mono font-black text-red-700 text-[14px] whitespace-nowrap">
                          -{formatMoney(exp.amount)}
                        </td>
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          {isVoided ? (
                            <span className="inline-block px-2 py-0.5 rounded-lg text-[10px] font-bold bg-gray-200 text-gray-700">
                              ملغي
                            </span>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                if (!isAdmin) {
                                  toast({
                                    title: "غير مصرح",
                                    description: "إلغاء المصروفات التشغيلية صلاحية خاصة بمدير الصالة فقط",
                                    variant: "error",
                                  });
                                  return;
                                }
                                setSelectedExpenseToVoid(exp);
                              }}
                              className={`text-[11px] font-bold ${
                                isAdmin
                                  ? "text-red-700 border-red-300 hover:bg-red-50"
                                  : "text-gray-400 border-gray-200 cursor-not-allowed"
                              }`}
                            >
                              <Ban className="h-3 w-3 me-1" />
                              إلغاء المصروف
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* ADD EXPENSE DIALOG */}
      <AddExpenseDialog
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={() => {
          toast({ title: "تم تسجيل المصروف بنجاح", variant: "success" });
          loadExpenses();
        }}
      />

      {/* ADMIN VOID EXPENSE MODAL */}
      <Dialog
        isOpen={Boolean(selectedExpenseToVoid)}
        onClose={() => {
          setSelectedExpenseToVoid(null);
          setVoidReason("");
        }}
        title="إلغاء قيد مصروف تشغيلي"
        description="سيتم إبطال المصروف وتسجيل سبب الإلغاء وتعديل الخزينة"
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          {selectedExpenseToVoid && (
            <div className="p-3 bg-[#F2F4F1] rounded-xl text-[12px] space-y-1">
              <div className="flex justify-between">
                <span className="text-[#5B6470]">بند المصروف:</span>
                <b>{selectedExpenseToVoid.category}</b>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6470]">المبلغ:</span>
                <b className="font-mono text-red-700">
                  {formatMoney(selectedExpenseToVoid.amount)}
                </b>
              </div>
              <div className="flex justify-between">
                <span className="text-[#5B6470]">البيان:</span>
                <span>{selectedExpenseToVoid.description || "بدون بيان"}</span>
              </div>
            </div>
          )}

          <div>
            <label className="text-[12px] font-bold text-[#14181F] block mb-1">
              سبب الإلغاء (إلزامي):
            </label>
            <input
              type="text"
              value={voidReason}
              onChange={(e) => setVoidReason(e.target.value)}
              placeholder="مثال: تسجيل مكرر بالخطأ / تم استرجاع المبلغ للمورد..."
              className="w-full px-3.5 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-bold"
              required
              autoFocus
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#E1E5DF]">
            <Button
              variant="outline"
              onClick={() => {
                setSelectedExpenseToVoid(null);
                setVoidReason("");
              }}
              disabled={isVoiding}
            >
              تراجع
            </Button>
            <Button
              onClick={handleConfirmVoid}
              isLoading={isVoiding}
              className="bg-red-600 text-white hover:bg-red-700 font-bold"
            >
              تأكيد الإلغاء
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
