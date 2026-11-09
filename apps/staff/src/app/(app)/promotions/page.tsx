"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  Tag,
  Plus,
  Search,
  Percent,
  Coins,
  Calendar,
  Layers,
  AlertCircle,
  RefreshCw,
  Clock,
  CheckCircle2,
  XCircle,
  Edit,
  Power,
  Sparkles,
  ShoppingBag,
  TrendingDown,
} from "lucide-react";
import { Button } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import {
  promotionsApi,
  type Promotion,
  type PromotionUsage,
} from "../../../features/promotions/api";
import { PromotionFormDialog } from "../../../features/promotions/components/promotion-form-dialog";
import { DeactivatePromotionDialog } from "../../../features/promotions/components/deactivate-promotion-dialog";

export default function PromotionsPage() {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";

  // Data state
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [usages, setUsages] = useState<Record<string, PromotionUsage>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "RUNNING" | "SCHEDULED" | "EXPIRED" | "INACTIVE">("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "PERCENT" | "FIXED">("ALL");

  // Dialog states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPromotion, setEditingPromotion] = useState<Promotion | null>(null);

  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);

  // Fetch promotions and their usage stats
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await promotionsApi.listPromotions();
      setPromotions(data);

      // Fetch usage stats for each promotion in parallel
      const usageResults: Record<string, PromotionUsage> = {};
      await Promise.all(
        data.map(async (promo) => {
          try {
            const usage = await promotionsApi.getPromotionUsage(promo.id);
            usageResults[promo.id] = usage;
          } catch {
            // fallback if usage fails
            usageResults[promo.id] = {
              promotionId: promo.id,
              promotionName: promo.name,
              redemptionsCount: 0,
              totalDiscount: 0,
            };
          }
        })
      );
      setUsages(usageResults);
    } catch (err: any) {
      setLoadError(
        err?.response?.data?.message ||
          err?.message ||
          (isRtl ? "تعذر تحميل العروض الترويجية" : "Failed to load promotions")
      );
    } finally {
      setIsLoading(false);
    }
  }, [isRtl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Helper to compute validity status
  const getValidityStatus = useCallback((promo: Promotion) => {
    if (!promo.isActive) return "INACTIVE";
    const now = new Date();
    if (promo.startsAt && new Date(promo.startsAt) > now) return "SCHEDULED";
    if (promo.endsAt && new Date(promo.endsAt) < now) return "EXPIRED";
    return "RUNNING";
  }, []);

  // Summary statistics
  const stats = useMemo(() => {
    const total = promotions.length;
    let active = 0;
    let running = 0;
    let scheduled = 0;
    let expired = 0;
    let totalDiscount = 0;

    promotions.forEach((p) => {
      if (p.isActive) active++;
      const status = getValidityStatus(p);
      if (status === "RUNNING") running++;
      else if (status === "SCHEDULED") scheduled++;
      else if (status === "EXPIRED") expired++;

      const usage = usages[p.id];
      if (usage) {
        totalDiscount += usage.totalDiscount;
      }
    });

    return { total, active, running, scheduled, expired, totalDiscount };
  }, [promotions, usages, getValidityStatus]);

  // Filtered promotions
  const filteredPromotions = useMemo(() => {
    return promotions.filter((promo) => {
      // Search by name or code
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = promo.name.toLowerCase().includes(query);
        const matchesCode = promo.code ? promo.code.toLowerCase().includes(query) : false;
        if (!matchesName && !matchesCode) return false;
      }

      // Status filter
      if (statusFilter !== "ALL") {
        const status = getValidityStatus(promo);
        if (status !== statusFilter) return false;
      }

      // Type filter
      if (typeFilter !== "ALL") {
        if (promo.type !== typeFilter) return false;
      }

      return true;
    });
  }, [promotions, searchQuery, statusFilter, typeFilter, getValidityStatus]);

  const handleOpenCreate = () => {
    setEditingPromotion(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (promo: Promotion) => {
    setEditingPromotion(promo);
    setIsFormOpen(true);
  };

  const handleOpenDeactivate = (promo: Promotion) => {
    setSelectedPromotion(promo);
    setIsDeactivateOpen(true);
  };

  const handleFormSuccess = () => {
    fetchData();
  };

  const handleDeactivateSuccess = () => {
    fetchData();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs font-bold text-[#5B6470] mb-1">
            <Tag className="h-4 w-4 text-[#C6F24E]" />
            <span>{isRtl ? "إدارة الصالة والفرع" : "Branch Operations"}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#14181F] tracking-tight">
            {t("promotionsManagement.title") || "إدارة العروض والخصومات"}
          </h1>
          <p className="text-sm text-[#5B6470] mt-1">
            {t("promotionsManagement.description") ||
              "إعداد حملات الخصم، أكواد الكوبونات الترويجية، ومتابعة معدل الاستخدام والمبيعات"}
          </p>
        </div>

        <Button
          onClick={handleOpenCreate}
          className="bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F] font-bold rounded-xl gap-2 shadow-sm shrink-0"
        >
          <Plus className="h-4 w-4" />
          <span>{t("promotionsManagement.createPromotion") || "إنشاء عرض جديد"}</span>
        </Button>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="bg-white p-4 rounded-2xl border border-[#E1E5DF] shadow-sm">
          <span className="text-xs font-medium text-[#5B6470] block">
            {t("promotionsManagement.totalPromotions") || "إجمالي العروض"}
          </span>
          <b className="text-2xl font-black text-[#14181F] mt-1 block">{stats.total}</b>
          <span className="text-[11px] text-[#5B6470] mt-0.5 block">
            {stats.active} {t("promotionsManagement.active") || "مفعل"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E1E5DF] shadow-sm">
          <span className="text-xs font-medium text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{t("promotionsManagement.runningNow") || "جارية الآن"}</span>
          </span>
          <b className="text-2xl font-black text-emerald-950 mt-1 block">{stats.running}</b>
          <span className="text-[11px] text-emerald-700/80 mt-0.5 block">
            {isRtl ? "متاحة فوراً بالكاشير" : "Available in POS"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E1E5DF] shadow-sm">
          <span className="text-xs font-medium text-sky-700 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{t("promotionsManagement.scheduledUpcoming") || "مجدولة قادمة"}</span>
          </span>
          <b className="text-2xl font-black text-sky-950 mt-1 block">{stats.scheduled}</b>
          <span className="text-[11px] text-sky-700/80 mt-0.5 block">
            {isRtl ? "تبدأ في تاريخ محدد" : "Starts on set date"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E1E5DF] shadow-sm">
          <span className="text-xs font-medium text-amber-700 flex items-center gap-1">
            <XCircle className="h-3.5 w-3.5" />
            <span>{t("promotionsManagement.expiredCount") || "منتهية"}</span>
          </span>
          <b className="text-2xl font-black text-amber-950 mt-1 block">{stats.expired}</b>
          <span className="text-[11px] text-amber-700/80 mt-0.5 block">
            {isRtl ? "تجاوزت تاريخ الصلاحية" : "Passed end date"}
          </span>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-[#E1E5DF] shadow-sm col-span-2 sm:col-span-1">
          <span className="text-xs font-medium text-[#14181F] flex items-center gap-1">
            <TrendingDown className="h-3.5 w-3.5 text-emerald-600" />
            <span>{t("promotionsManagement.totalDiscountGiven") || "إجمالي الخصم"}</span>
          </span>
          <b className="text-xl font-black text-[#14181F] mt-1 block font-mono">
            {(stats.totalDiscount / 100).toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-xs font-bold text-[#5B6470]">
              {t("promotionsManagement.egp") || "ج.م"}
            </span>
          </b>
          <span className="text-[11px] text-[#5B6470] mt-0.5 block">
            {isRtl ? "مجموع الخصومات الفعلية" : "All granted discounts"}
          </span>
        </div>
      </div>

      {/* Toolbar: Search & Filters */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-[#E1E5DF] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <Search className="h-4 w-4 absolute start-3 top-3 text-[#5B6470]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              t("promotionsManagement.searchPlaceholder") || "بحث باسم العرض أو كود الخصم..."
            }
            className="w-full h-10 ps-9 pe-3 rounded-xl border border-[#E1E5DF] text-xs sm:text-sm bg-[#F2F4F1]/50 focus:bg-white focus:outline-none focus:border-[#C6F24E] focus:ring-2 focus:ring-[#C6F24E]/20 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute end-3 top-2.5 text-gray-400 hover:text-gray-600 text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filter Pills & Selects */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Status Select */}
          <div className="flex items-center rounded-xl bg-[#F2F4F1] p-1 border border-[#E1E5DF] text-xs font-semibold">
            {(
              [
                { key: "ALL", label: t("promotionsManagement.allStatuses") || "الكل" },
                { key: "RUNNING", label: t("promotionsManagement.running") || "جاري" },
                { key: "SCHEDULED", label: t("promotionsManagement.scheduled") || "مجدول" },
                { key: "EXPIRED", label: t("promotionsManagement.expired") || "منتهي" },
                { key: "INACTIVE", label: t("promotionsManagement.inactive") || "معطل" },
              ] as const
            ).map((item) => (
              <button
                key={item.key}
                onClick={() => setStatusFilter(item.key)}
                className={`px-2.5 py-1 rounded-lg transition-all ${
                  statusFilter === item.key
                    ? "bg-white text-[#14181F] shadow-sm font-bold"
                    : "text-[#5B6470] hover:text-[#14181F]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Type Select */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as any)}
            className="h-9 px-3 rounded-xl border border-[#E1E5DF] bg-[#F2F4F1] text-xs font-semibold text-[#14181F] focus:outline-none focus:border-[#C6F24E]"
          >
            <option value="ALL">{t("promotionsManagement.allTypes") || "جميع الأنواع"}</option>
            <option value="PERCENT">{t("promotionsManagement.percent") || "نسبة مئوية (%)"}</option>
            <option value="FIXED">{t("promotionsManagement.fixed") || "مبلغ ثابت (ج.م)"}</option>
          </select>

          {/* Refresh Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="h-9 px-2.5 rounded-xl border-[#E1E5DF] text-[#5B6470] hover:text-[#14181F]"
            title={isRtl ? "تحديث البيانات" : "Refresh"}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {/* Main Content Viewport */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-12 text-center space-y-3">
          <div className="h-8 w-8 border-2 border-[#14181F] border-t-[#C6F24E] rounded-full animate-spin mx-auto" />
          <p className="text-sm font-medium text-[#5B6470]">
            {isRtl ? "جاري تحميل العروض الترويجية..." : "Loading promotions..."}
          </p>
        </div>
      ) : loadError ? (
        <div className="bg-red-50 rounded-2xl border border-red-200 p-8 text-center space-y-3">
          <AlertCircle className="h-8 w-8 text-red-500 mx-auto" />
          <h3 className="font-bold text-red-800">{isRtl ? "تعذر تحميل البيانات" : "Failed to load"}</h3>
          <p className="text-xs text-red-600 max-w-md mx-auto">{loadError}</p>
          <Button
            onClick={fetchData}
            variant="outline"
            size="sm"
            className="rounded-xl border-red-300 text-red-700 font-bold"
          >
            {isRtl ? "إعادة المحاولة" : "Try again"}
          </Button>
        </div>
      ) : filteredPromotions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-12 text-center space-y-3 shadow-sm">
          <div className="h-12 w-12 rounded-2xl bg-[#F2F4F1] text-[#5B6470] mx-auto flex items-center justify-center font-bold">
            <Tag className="h-6 w-6" />
          </div>
          <h3 className="font-bold text-lg text-[#14181F]">
            {t("promotionsManagement.noPromotionsFound") || "لم يتم العثور على عروض ترويجية"}
          </h3>
          <p className="text-xs text-[#5B6470] max-w-md mx-auto">
            {searchQuery || statusFilter !== "ALL" || typeFilter !== "ALL"
              ? isRtl
                ? "لا توجد نتائج تطابق معايير البحث والفلترة المحددة. جرب تغيير كلمات البحث أو مسح الفلاتر."
                : "No promotions match the specified search and filter criteria."
              : t("promotionsManagement.noPromotionsDesc") ||
                "ابدأ بإنشاء أول حملة خصم أو كود ترويجي لتنشيط المبيعات وجذب المشتركين."}
          </p>
          <Button
            onClick={handleOpenCreate}
            className="bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F] font-bold rounded-xl gap-2 mt-2"
          >
            <Plus className="h-4 w-4" />
            <span>{t("promotionsManagement.createPromotion") || "إنشاء عرض جديد"}</span>
          </Button>
        </div>
      ) : (
        /* Promotions Table / Grid */
        <div className="bg-white rounded-2xl border border-[#E1E5DF] shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-start text-xs sm:text-sm">
              <thead className="bg-[#F8F9F8] border-b border-[#E1E5DF] text-[#5B6470] font-bold">
                <tr>
                  <th className="py-3.5 px-4 text-start font-bold">
                    {t("promotionsManagement.promotionName") || "العرض والكود"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-bold">
                    {t("promotionsManagement.value") || "قيمة الخصم"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-bold">
                    {t("promotionsManagement.validity") || "الصلاحية"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-bold">
                    {t("promotionsManagement.itemKinds") || "البنود المشمولة"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-bold">
                    {t("promotionsManagement.usageStats") || "الاستخدام"}
                  </th>
                  <th className="py-3.5 px-4 text-start font-bold">
                    {t("promotionsManagement.totalDiscountGiven") || "إجمالي الخصم"}
                  </th>
                  <th className="py-3.5 px-4 text-end font-bold">
                    {t("promotionsManagement.actions") || "إجراءات"}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E1E5DF]">
                {filteredPromotions.map((promo) => {
                  const status = getValidityStatus(promo);
                  const usage = usages[promo.id];
                  const redemptionsCount = usage ? usage.redemptionsCount : 0;
                  const totalDiscountPiasters = usage ? usage.totalDiscount : 0;

                  return (
                    <tr
                      key={promo.id}
                      className="hover:bg-[#F2F4F1]/40 transition-colors group"
                    >
                      {/* Name & Code */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <span className="font-bold text-[#14181F] block text-sm">
                            {promo.name}
                          </span>
                          <div className="flex items-center gap-2">
                            {promo.code ? (
                              <span className="inline-flex items-center gap-1 font-mono text-[11px] font-bold bg-[#14181F] text-[#C6F24E] px-2 py-0.5 rounded-md">
                                <Tag className="h-3 w-3" />
                                <span>{promo.code}</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-[#5B6470] italic">
                                {isRtl ? "خصم تلقائي (بدون كود)" : "Automatic (no code)"}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Value & Type */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-black text-[#14181F] text-sm flex items-center gap-1">
                            {promo.type === "PERCENT" ? (
                              <>
                                <span className="font-mono text-base">{promo.value}%</span>
                                <span className="text-xs font-normal text-[#5B6470]">
                                  {isRtl ? "نسبة مئوية" : "Percent"}
                                </span>
                              </>
                            ) : (
                              <>
                                <span className="font-mono text-base">
                                  {(promo.value / 100).toFixed(2)}
                                </span>
                                <span className="text-xs font-normal text-[#5B6470]">
                                  {t("promotionsManagement.egp") || "ج.م"}
                                </span>
                              </>
                            )}
                          </div>
                          {promo.type === "PERCENT" && promo.maxDiscount != null && (
                            <span className="text-[10px] text-[#5B6470] block">
                              {isRtl ? "سقف الخصم:" : "Max:"}{" "}
                              {(promo.maxDiscount / 100).toFixed(0)} ج.م
                            </span>
                          )}
                          {promo.minSubtotal != null && (
                            <span className="text-[10px] text-[#5B6470] block">
                              {isRtl ? "حد أدنى للسلة:" : "Min subtotal:"}{" "}
                              {(promo.minSubtotal / 100).toFixed(0)} ج.م
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Validity & Status Badge */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {status === "RUNNING" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
                              <span>{t("promotionsManagement.running") || "جاري الآن"}</span>
                            </span>
                          )}
                          {status === "SCHEDULED" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-100 text-sky-800">
                              <Clock className="h-3 w-3" />
                              <span>{t("promotionsManagement.scheduled") || "مجدول"}</span>
                            </span>
                          )}
                          {status === "EXPIRED" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                              <span>{t("promotionsManagement.expired") || "منتهي"}</span>
                            </span>
                          )}
                          {status === "INACTIVE" && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-gray-100 text-gray-700">
                              <span>{t("promotionsManagement.inactive") || "معطل"}</span>
                            </span>
                          )}

                          <div className="text-[11px] text-[#5B6470] font-mono">
                            {promo.startsAt || promo.endsAt ? (
                              <span>
                                {promo.startsAt
                                  ? new Date(promo.startsAt).toLocaleDateString(
                                      isRtl ? "ar-EG" : "en-US",
                                      { month: "short", day: "numeric" }
                                    )
                                  : "..."}{" "}
                                -{" "}
                                {promo.endsAt
                                  ? new Date(promo.endsAt).toLocaleDateString(
                                      isRtl ? "ar-EG" : "en-US",
                                      { month: "short", day: "numeric", year: "numeric" }
                                    )
                                  : isRtl
                                  ? "مستمر"
                                  : "Ongoing"}
                              </span>
                            ) : (
                              <span>{t("promotionsManagement.permanent") || "دائم"}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Item Kinds & Scope */}
                      <td className="py-3.5 px-4">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {promo.itemKinds && promo.itemKinds.length > 0 ? (
                            promo.itemKinds.map((k) => (
                              <span
                                key={k}
                                className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[#F2F4F1] text-[#262D38] border border-[#E1E5DF]"
                              >
                                {k === "SUBSCRIPTION"
                                  ? "اشتراكات"
                                  : k === "SERVICE"
                                  ? "خدمات"
                                  : "منتجات"}
                              </span>
                            ))
                          ) : (
                            <span className="text-[11px] text-[#5B6470]">
                              {t("promotionsManagement.allItemKinds") || "جميع البنود"}
                            </span>
                          )}
                          {promo.planIds && promo.planIds.length > 0 && (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                              {promo.planIds.length} باقات مخصصة
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-[#14181F] text-xs">
                            <span>{redemptionsCount}</span>
                            <span className="text-[#5B6470] font-normal">
                              {" "}
                              / {promo.maxUses != null ? promo.maxUses : "∞"}
                            </span>
                          </div>
                          {promo.perMemberLimit != null && (
                            <span className="text-[10px] text-[#5B6470] block">
                              {promo.perMemberLimit}{" "}
                              {isRtl ? "لكل مشترك" : "/ member"}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Total Discount Given */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-[#14181F] text-xs">
                          {(totalDiscountPiasters / 100).toFixed(2)}{" "}
                          <span className="text-[10px] text-[#5B6470]">
                            {t("promotionsManagement.egp") || "ج.م"}
                          </span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-end">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(promo)}
                            className="h-8 px-2.5 text-xs font-semibold rounded-lg border-[#E1E5DF] text-[#14181F] hover:bg-[#F2F4F1] gap-1"
                          >
                            <Edit className="h-3.5 w-3.5 text-[#5B6470]" />
                            <span>{t("promotionsManagement.editPromotion") || "تعديل"}</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDeactivate(promo)}
                            className={`h-8 px-2.5 text-xs font-semibold rounded-lg border gap-1 transition-colors ${
                              promo.isActive
                                ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                                : "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            }`}
                          >
                            <Power className="h-3.5 w-3.5" />
                            <span>
                              {promo.isActive
                                ? (t("promotionsManagement.deactivatePromotion") || "تعطيل")
                                : (t("promotionsManagement.reactivatePromotion") || "تفعيل")}
                            </span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create / Edit Dialog */}
      <PromotionFormDialog
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSuccess={handleFormSuccess}
        promotionToEdit={editingPromotion}
      />

      {/* Deactivate / Reactivate Dialog */}
      <DeactivatePromotionDialog
        isOpen={isDeactivateOpen}
        onClose={() => setIsDeactivateOpen(false)}
        onSuccess={handleDeactivateSuccess}
        promotion={selectedPromotion}
      />
    </div>
  );
}
