"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Layers,
  Search,
  Plus,
  Archive,
  RotateCcw,
  Edit2,
  Eye,
  AlertCircle,
} from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { plansApi } from "../../../features/plans/api";
import { PlanFormSheet } from "../../../features/plans/components/plan-form-sheet";
import { PlanDetailDrawer } from "../../../features/plans/components/plan-detail-drawer";
import { ArchivePlanDialog } from "../../../features/plans/components/archive-plan-dialog";
import { RestorePlanDialog } from "../../../features/plans/components/restore-plan-dialog";
import { Button } from "@gym/ui";
import { useShift } from "../../../lib/shift-context";
import Link from "next/link";
import type { Plan } from "@gym/contracts";

export default function PlansPage() {
  const { currentUser } = useShift();
  const isAdmin = currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN";
  const [plans, setPlans] = useState<Plan[]>([]);
  const [gymDefaultUpfront, setGymDefaultUpfront] = useState<number>(30);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [searchQuery, setSearchQuery] = useState("");
  const [kindFilter, setKindFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedPlanForEdit, setSelectedPlanForEdit] = useState<Plan | null>(null);
  const [selectedPlanForDetail, setSelectedPlanForDetail] = useState<Plan | null>(null);
  const [selectedPlanForArchive, setSelectedPlanForArchive] = useState<Plan | null>(null);
  const [selectedPlanForRestore, setSelectedPlanForRestore] = useState<Plan | null>(null);

  const fetchPlans = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeParam =
        statusFilter === "ACTIVE" ? true : statusFilter === "ARCHIVED" ? false : undefined;
      const data = await plansApi.listPlans({
        kind: kindFilter !== "ALL" ? kindFilter : undefined,
        active: activeParam,
      });
      setPlans(data);
    } catch (err: any) {
      console.error("Error fetching plans:", err);
      setError(err?.message || "فشل في تحميل الباقات");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    plansApi.getGymSettings().then((s) => {
      if (s?.defaultMinUpfrontPercent !== undefined) {
        setGymDefaultUpfront(Number(s.defaultMinUpfrontPercent));
      }
    });
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [kindFilter, statusFilter]);

  // Client search filter
  const filteredPlans = useMemo(() => {
    return plans.filter((p) => {
      const matchSearch =
        !searchQuery.trim() ||
        p.name.toLowerCase().includes(searchQuery.trim().toLowerCase());
      return matchSearch;
    });
  }, [plans, searchQuery]);

  // Group plans by kind
  const groupedPlans = useMemo(() => {
    const gym = filteredPlans.filter((p) => p.kind === "GYM");
    const pt = filteredPlans.filter((p) => p.kind === "PT");
    const cls = filteredPlans.filter((p) => p.kind === "CLASS");
    return { GYM: gym, PT: pt, CLASS: cls };
  }, [filteredPlans]);

  // Summary statistics
  const stats = useMemo(() => {
    const total = plans.length;
    const active = plans.filter((p) => p.isActive).length;
    const archived = plans.filter((p) => !p.isActive).length;
    const gymCount = plans.filter((p) => p.kind === "GYM").length;
    const ptCount = plans.filter((p) => p.kind === "PT").length;
    const classCount = plans.filter((p) => p.kind === "CLASS").length;
    const totalActiveSubscribers = plans.reduce(
      (sum, p) => sum + (p.activeSubscribersCount || 0),
      0
    );
    return { total, active, archived, gymCount, ptCount, classCount, totalActiveSubscribers };
  }, [plans]);

  const handleCreateNew = () => {
    setSelectedPlanForEdit(null);
    setIsFormOpen(true);
  };

  const handleEdit = (plan: Plan) => {
    setSelectedPlanForEdit(plan);
    setIsFormOpen(true);
  };

  const handleDetail = (plan: Plan) => {
    setSelectedPlanForDetail(plan);
  };

  const handleArchiveClick = (plan: Plan) => {
    setSelectedPlanForArchive(plan);
  };

  const handleRestoreClick = (plan: Plan) => {
    setSelectedPlanForRestore(plan);
  };

  const renderKindBadge = (kind: string) => {
    switch (kind) {
      case "GYM":
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-[#14181F] text-[#C6F24E]">
            صالة جيم (GYM)
          </span>
        );
      case "PT":
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-100 text-purple-800">
            تدريب خاص (PT)
          </span>
        );
      case "CLASS":
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800">
            حصص جماعية (CLASS)
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-gray-100 text-gray-800">
            {kind}
          </span>
        );
    }
  };

  const renderStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
        نشطة
      </span>
    ) : (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
        <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
        مؤرشفة
      </span>
    );
  };

  const renderPlansTable = (items: Plan[], sectionTitle: string, kindCode: string) => {
    if (items.length === 0) return null;

    return (
      <div className="bg-white rounded-2xl border border-[#E1E5DF] overflow-hidden shadow-subtle mb-6">
        <div className="p-4 bg-[#F8F9F7] border-b border-[#E1E5DF] flex items-center justify-between">
          <div className="flex items-center gap-2">
            {renderKindBadge(kindCode)}
            <h2 className="text-sm font-bold text-[#14181F]">{sectionTitle}</h2>
            <span className="text-xs text-[#5B6470] font-mono font-bold">({items.length})</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead>
              <tr className="border-b border-[#E1E5DF] bg-white text-[#5B6470] text-[11px] font-bold">
                <th className="py-3 px-4 text-start">اسم الباقة</th>
                <th className="py-3 px-4 text-start">السعر</th>
                <th className="py-3 px-4 text-start">المدة</th>
                <th className="py-3 px-4 text-start">الجلسات / الحصص</th>
                <th className="py-3 px-4 text-start">سياسة التجميد</th>
                <th className="py-3 px-4 text-start">الدفعة الأولى</th>
                <th className="py-3 px-4 text-start">المشتركون النشطون</th>
                <th className="py-3 px-4 text-start">الحالة</th>
                <th className="py-3 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E5DF]">
              {items.map((plan) => {
                const freezeSummary =
                  plan.freezeMaxCount > 0 && plan.freezeMaxTotalDays > 0
                    ? `${plan.freezeMaxTotalDays} يوم على ${plan.freezeMaxCount} مرات`
                    : "غير متاح";

                const upfrontSummary =
                  plan.minUpfrontPercent !== null
                    ? `${plan.minUpfrontPercent}%`
                    : `افتراضي (${gymDefaultUpfront}%)`;

                const sessionsSummary =
                  plan.kind === "CLASS"
                    ? `${plan.sessionsPerWeek || 1}/أسبوع ${
                        plan.totalSessions ? `(إجمالي ${plan.totalSessions})` : ""
                      }`
                    : plan.totalSessions
                    ? `${plan.totalSessions} جلسة`
                    : "غير محدود";

                return (
                  <tr
                    key={plan.id}
                    className={`hover:bg-[#F8F9F7] transition-colors ${
                      !plan.isActive ? "opacity-75 bg-gray-50/50" : ""
                    }`}
                  >
                    <td className="py-3.5 px-4 font-bold text-[#14181F]">
                      <div className="flex items-center gap-2">
                        <span>{plan.name}</span>
                        {plan.grantsFloorAccess && plan.kind === "PT" && (
                          <span
                            className="text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded font-medium"
                            title="تتيح دخول صالة الجيم العامة"
                          >
                            + دخول الصالة
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-black font-mono text-[#14181F] text-sm">
                      {formatMoney(plan.price)}
                    </td>

                    <td className="py-3.5 px-4 font-bold text-[#14181F] font-mono">
                      {plan.durationDays} يوم
                    </td>

                    <td className="py-3.5 px-4 text-[#5B6470] font-medium">
                      {sessionsSummary}
                    </td>

                    <td className="py-3.5 px-4 text-[#5B6470] font-medium">
                      {freezeSummary}
                    </td>

                    <td className="py-3.5 px-4 text-[#5B6470] font-medium">
                      {upfrontSummary}
                    </td>

                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-xs px-2.5 py-1 rounded-lg bg-[#F2F4F1] text-[#14181F]">
                        {plan.activeSubscribersCount || 0} مشترك
                      </span>
                    </td>

                    <td className="py-3.5 px-4">{renderStatusBadge(plan.isActive)}</td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDetail(plan)}
                          title="عرض تفاصيل الباقة والمشتركين"
                          className="p-1.5 rounded-lg text-[#5B6470] hover:text-[#14181F] hover:bg-white border border-transparent hover:border-[#E1E5DF] transition-all"
                        >
                          <Eye className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleEdit(plan)}
                          title="تعديل الباقة"
                          className="p-1.5 rounded-lg text-[#5B6470] hover:text-[#14181F] hover:bg-white border border-transparent hover:border-[#E1E5DF] transition-all"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>

                        {plan.isActive ? (
                          <button
                            type="button"
                            onClick={() => handleArchiveClick(plan)}
                            title="أرشفة الباقة (إخفاؤها من شاشة البيع)"
                            className="p-1.5 rounded-lg text-amber-600 hover:text-amber-800 hover:bg-amber-50 transition-all"
                          >
                            <Archive className="h-4 w-4" />
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRestoreClick(plan)}
                            title="استعادة وتفعيل الباقة"
                            className="p-1.5 rounded-lg text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 transition-all"
                          >
                            <RotateCcw className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  if (currentUser && !isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 pt-16" dir="rtl">
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl space-y-3 shadow-subtle">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
          <h2 className="text-lg font-black text-red-900">غير مصرح بالدخول</h2>
          <p className="text-xs text-red-700 leading-relaxed font-medium">
            صفحة إدارة الباقات والاشتراكات مخصصة لمدير النادي فقط (GYM_ADMIN / SUPER_ADMIN). ليس لحساب الاستقبال صلاحية الوصول أو تعديل الباقات.
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs font-bold border-red-300 hover:bg-red-100">
                العودة لشاشة الدخول الرئيسية
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#14181F] flex items-center gap-2.5">
            <Layers className="h-7 w-7 text-[#14181F]" />
            <span>إدارة الباقات والاشتراكات</span>
          </h1>
          <p className="text-sm text-[#5B6470] mt-1">
            إعداد أسعار وخطط العضوية، التدريب الخاص، الحصص الجماعية وسياسات السداد والتجميد
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="lime"
            onClick={handleCreateNew}
            className="rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm"
          >
            <Plus className="h-4 w-4" />
            <span>إنشاء باقة جديدة</span>
          </Button>
        </div>
      </div>

      {/* Top Stats Counters */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-[#5B6470] block">إجمالي الباقات</span>
          <b className="text-xl font-black text-[#14181F] font-mono mt-1 block">{stats.total}</b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-emerald-700 block">باقات نشطة</span>
          <b className="text-xl font-black text-emerald-800 font-mono mt-1 block">{stats.active}</b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-gray-500 block">باقات مؤرشفة</span>
          <b className="text-xl font-black text-gray-600 font-mono mt-1 block">{stats.archived}</b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-[#14181F] block">صالة جيم (GYM)</span>
          <b className="text-xl font-black text-[#14181F] font-mono mt-1 block">{stats.gymCount}</b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-purple-700 block">تدريب خاص (PT)</span>
          <b className="text-xl font-black text-purple-800 font-mono mt-1 block">{stats.ptCount}</b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-blue-700 block">حصص (CLASS)</span>
          <b className="text-xl font-black text-blue-800 font-mono mt-1 block">{stats.classCount}</b>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="p-4 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute start-3.5 top-3 text-[#5B6470]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث باسم الباقة..."
            className="w-full ps-10 pe-3.5 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-medium text-[#14181F] focus:outline-none focus:border-[#14181F]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#5B6470]">النوع:</span>
            <select
              value={kindFilter}
              onChange={(e) => setKindFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-xs font-bold text-[#14181F] focus:outline-none"
            >
              <option value="ALL">جميع الأنواع</option>
              <option value="GYM">صالة جيم (GYM)</option>
              <option value="PT">تدريب خاص (PT)</option>
              <option value="CLASS">حصص جماعية (CLASS)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-[#5B6470]">الحالة:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-xs font-bold text-[#14181F] focus:outline-none"
            >
              <option value="ALL">الكل</option>
              <option value="ACTIVE">النشطة فقط</option>
              <option value="ARCHIVED">المؤرشفة فقط</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content: Grouped Plans Tables */}
      {isLoading ? (
        <div className="p-16 text-center text-[#5B6470] bg-white rounded-2xl border border-[#E1E5DF] space-y-3">
          <div className="w-8 h-8 border-3 border-[#14181F] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold">جاري تحميل قائمة الباقات...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-700 bg-red-50 rounded-2xl border border-red-200 space-y-2">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto" />
          <p className="text-sm font-bold">{error}</p>
          <Button variant="outline" onClick={fetchPlans} className="mt-2 text-xs">
            إعادة المحاولة
          </Button>
        </div>
      ) : filteredPlans.length === 0 ? (
        <div className="p-12 text-center text-[#5B6470] bg-white rounded-2xl border border-[#E1E5DF] space-y-3">
          <Layers className="h-10 w-10 text-gray-300 mx-auto" />
          <p className="text-base font-bold text-[#14181F]">لم يتم العثور على أي باقات</p>
          <p className="text-xs text-[#5B6470]">
            لا توجد باقات تطابق معايير البحث أو التصفية الحالية.
          </p>
          <Button variant="lime" onClick={handleCreateNew} className="text-xs font-bold rounded-xl mt-2">
            إنشاء أول باقة
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {renderPlansTable(groupedPlans.GYM, "باقات صالة الجيم العامة (GYM)", "GYM")}
          {renderPlansTable(groupedPlans.PT, "باقات التدريب الخاص (PT)", "PT")}
          {renderPlansTable(groupedPlans.CLASS, "باقات الحصص الجماعية (CLASS)", "CLASS")}
        </div>
      )}

      {/* Modals & Drawers */}
      <PlanFormSheet
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setSelectedPlanForEdit(null);
        }}
        onSuccess={() => {
          fetchPlans();
        }}
        planToEdit={selectedPlanForEdit}
      />

      <PlanDetailDrawer
        isOpen={Boolean(selectedPlanForDetail)}
        onClose={() => setSelectedPlanForDetail(null)}
        plan={selectedPlanForDetail}
      />

      <ArchivePlanDialog
        isOpen={Boolean(selectedPlanForArchive)}
        onClose={() => setSelectedPlanForArchive(null)}
        onSuccess={() => {
          fetchPlans();
        }}
        plan={selectedPlanForArchive}
      />

      <RestorePlanDialog
        isOpen={Boolean(selectedPlanForRestore)}
        onClose={() => setSelectedPlanForRestore(null)}
        onSuccess={() => {
          fetchPlans();
        }}
        plan={selectedPlanForRestore}
      />
    </div>
  );
}
