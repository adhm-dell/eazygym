"use client";

import React, { useState, useEffect } from "react";
import { Badge } from "@gym/ui";
import {
  UserCheck,
  Award,
  Calendar,
  Users,
  Home,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  Dumbbell,
  Wallet,
} from "lucide-react";
import { fetchMyCommission, type CoachCommissionData } from "../../features/commission/api";

export default function CoachHomePage() {
  const [activeTab, setActiveTab] = useState<"home" | "trainees" | "classes" | "commission">("home");
  const [sessionRegistered, setSessionRegistered] = useState(false);

  // Commission live state
  const currentDate = new Date();
  const [commYear, setCommYear] = useState<number>(currentDate.getFullYear());
  const [commMonth, setCommMonth] = useState<number>(currentDate.getMonth() + 1);
  const [commData, setCommData] = useState<CoachCommissionData | null>(null);
  const [commLoading, setCommLoading] = useState<boolean>(false);

  const loadCommission = async (year: number, month: number) => {
    setCommLoading(true);
    try {
      const data = await fetchMyCommission(year, month);
      setCommData(data);
    } catch {
      // Fallback
    } finally {
      setCommLoading(false);
    }
  };

  useEffect(() => {
    loadCommission(commYear, commMonth);
  }, [commYear, commMonth]);

  const handlePrevMonth = () => {
    if (commMonth === 1) {
      setCommYear(commYear - 1);
      setCommMonth(12);
    } else {
      setCommMonth(commMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (commMonth === 12) {
      setCommYear(commYear + 1);
      setCommMonth(1);
    } else {
      setCommMonth(commMonth + 1);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "PAID":
        return <Badge variant="g">مدفوع</Badge>;
      case "EARNED":
        return <Badge variant="g">مستحق</Badge>;
      case "PENDING":
        return <Badge variant="w">معلق</Badge>;
      case "VOID":
        return <Badge variant="r">ملغي</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const coachName = commData?.coach?.name || "كابتن أحمد";
  const commissionAmount = commData?.commissionAmount ?? 3100;
  const collectedRevenue = commData?.collectedRevenue ?? 12000;
  const tierPercent = commData?.currentTier?.percent ?? 50;
  const nextTier = commData?.nextTier;
  const baseSalary = commData?.coach?.baseSalary ?? 8000;

  return (
    <div className="min-h-screen bg-[#E5E9E3] flex justify-center items-center sm:py-6" dir="rtl">
      <div className="w-full max-w-[420px] min-h-screen sm:min-h-[860px] bg-[#F2F4F1] flex flex-col justify-between sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-[#14181F] overflow-hidden">
        {/* Mobile Header & Body */}
        <div className="flex-1 p-4 sm:p-5 flex flex-col gap-3.5 overflow-y-auto">
          {/* Top greeting */}
          <header className="pt-1 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-[#5B6470] font-medium">مرحباً بك مجدداً</p>
              <h1 className="text-[22px] font-bold text-[#14181F] tracking-tight">{coachName}</h1>
            </div>
            <div className="flex items-center gap-1.5 bg-white border border-[#E1E5DF] px-2.5 py-1 rounded-full text-xs font-semibold text-[#14181F]">
              <Calendar className="h-3.5 w-3.5 text-[#5B6470]" />
              <span>{commMonth} / {commYear}</span>
            </div>
          </header>

          {/* ==================== TAB 1: HOME ==================== */}
          {activeTab === "home" && (
            <>
              {/* Hero Commission Card */}
              <section className="bg-[#14181F] text-white rounded-[18px] p-5 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] text-[#C9CFD6] font-medium">العمولة المستحقة لشهر {commMonth}</span>
                  <Award className="h-5 w-5 text-[#C6F24E]" />
                </div>
                <b className="text-[34px] font-black block my-1 tabular-nums">
                  {commissionAmount.toLocaleString()} ج.م
                </b>
                <div className="flex items-center justify-between text-[13px] text-white/90">
                  <span>المحصل: {collectedRevenue.toLocaleString()} ج.م</span>
                  <span className="font-bold text-[#C6F24E]">شريحة {tierPercent}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2.5 bg-[#3A4350] rounded-full mt-2.5 overflow-hidden">
                  <div
                    className="h-full bg-[#C6F24E] rounded-full transition-all duration-300"
                    style={{
                      width: nextTier
                        ? `${Math.min(100, Math.round((collectedRevenue / nextTier.minRevenue) * 100))}%`
                        : "100%",
                    }}
                  />
                </div>
                <p className="text-[12px] text-[#C9CFD6] mt-2 font-medium">
                  {nextTier
                    ? `متبقي ${nextTier.neededRevenue.toLocaleString()} ج.م للوصول لشريحة ${nextTier.percent}%`
                    : "وصلت لأعلى شريحة عمولة هذا الشهر"}
                </p>
              </section>

              {/* Today's Private Sessions */}
              <section className="bg-white border border-[#E1E5DF] rounded-[16px] p-4">
                <h3 className="text-sm font-bold text-[#14181F] mb-1">جلسات اليوم (PT)</h3>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-2.5 py-2.5 border-t border-[#E1E5DF]">
                    <span className="font-semibold text-[#14181F] flex-1 text-xs">محمد أحمد</span>
                    <span className="text-xs text-[#5B6470] tabular-nums">17:00</span>
                    <Badge variant="g">باقي 6</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2.5 py-2.5 border-t border-[#E1E5DF]">
                    <span className="font-semibold text-[#14181F] flex-1 text-xs">نور حسن</span>
                    <span className="text-xs text-[#5B6470] tabular-nums">18:30</span>
                    <Badge variant="w">باقي 1</Badge>
                  </div>
                </div>
              </section>

              {/* Expiring Trainees */}
              <section className="bg-white border border-[#E1E5DF] rounded-[16px] p-4">
                <h3 className="text-sm font-bold text-[#14181F] mb-1">متدربون ينتهي اشتراكهم</h3>
                <div className="flex flex-col">
                  <div className="flex items-center justify-between gap-2.5 py-2.5 border-t border-[#E1E5DF]">
                    <span className="font-semibold text-[#14181F] flex-1 text-xs">محمد أحمد</span>
                    <Badge variant="w">3 أيام</Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2.5 py-2.5 border-t border-[#E1E5DF]">
                    <span className="font-semibold text-[#14181F] flex-1 text-xs">هاني علي</span>
                    <Badge variant="w">6 أيام</Badge>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSessionRegistered(true)}
                  className="w-full mt-3 bg-[#C6F24E] text-[#14181F] hover:bg-[#b5e03e] font-bold text-xs p-3 rounded-xl min-h-[44px] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <UserCheck className="h-4 w-4" />
                  <span>{sessionRegistered ? "تم تسجيل الجلسة ✓" : "تسجيل جلسة سريعة"}</span>
                </button>
              </section>
            </>
          )}

          {/* ==================== TAB 2: TRAINEES ==================== */}
          {activeTab === "trainees" && (
            <div className="space-y-3">
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-4">
                <h3 className="text-sm font-bold text-[#14181F] mb-2">قائمة المشتركين والمتدربين</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-[#F2F4F1] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#14181F]">محمد أحمد</p>
                      <p className="text-[11px] text-[#5B6470]">باقة PT 12 جلسة (كود: 100245)</p>
                    </div>
                    <Badge variant="g">نشط</Badge>
                  </div>
                  <div className="p-3 bg-[#F2F4F1] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#14181F]">نور حسن</p>
                      <p className="text-[11px] text-[#5B6470]">باقة PT 24 جلسة (كود: 100246)</p>
                    </div>
                    <Badge variant="w">جلسة متبقية</Badge>
                  </div>
                  <div className="p-3 bg-[#F2F4F1] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-[#14181F]">هاني علي</p>
                      <p className="text-[11px] text-[#5B6470]">اشتراك سنوي VIP (كود: 100247)</p>
                    </div>
                    <Badge variant="g">نشط</Badge>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: CLASSES ==================== */}
          {activeTab === "classes" && (
            <div className="space-y-3">
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-4">
                <h3 className="text-sm font-bold text-[#14181F] mb-2">جدول حصص اللياقة الجماعية</h3>
                <div className="space-y-2">
                  <div className="p-3 bg-[#F2F4F1] rounded-xl border border-[#E1E5DF]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#14181F]">حصة Cross Training</span>
                      <span className="text-[11px] text-[#5B6470]">18:00 - 19:00</span>
                    </div>
                    <p className="text-[11px] text-[#5B6470] mt-1">القاعة الرئيسية · 12 مشترك مسجل</p>
                  </div>
                  <div className="p-3 bg-[#F2F4F1] rounded-xl border border-[#E1E5DF]">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[#14181F]">حصة HIIT & Cardio</span>
                      <span className="text-[11px] text-[#5B6470]">20:00 - 21:00</span>
                    </div>
                    <p className="text-[11px] text-[#5B6470] mt-1">قاعة الفتنس · 8 مشتركين مسجلين</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: COMMISSION (FULL B08 VIEW) ==================== */}
          {activeTab === "commission" && (
            <div className="space-y-3">
              {/* Month Selector Bar */}
              <div className="flex items-center justify-between bg-white border border-[#E1E5DF] rounded-xl p-2">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 hover:bg-[#F2F4F1] rounded-lg transition-colors cursor-pointer text-[#14181F]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="text-xs font-bold text-[#14181F]">
                  كشف عمولات شهر: {commMonth} / {commYear}
                </div>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 hover:bg-[#F2F4F1] rounded-lg transition-colors cursor-pointer text-[#14181F]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>

              {/* Commission Hero KPI */}
              <section className="bg-[#14181F] text-white rounded-[18px] p-4 shadow-sm">
                <div className="flex items-center justify-between text-xs text-[#C9CFD6]">
                  <span>إجمالي العمولة المحتسبة</span>
                  <Award className="h-4 w-4 text-[#C6F24E]" />
                </div>
                <div className="text-3xl font-black text-[#C6F24E] my-1 tabular-nums">
                  {commissionAmount.toLocaleString()} ج.م
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-xs">
                  <div>
                    <span className="text-[#C9CFD6] text-[11px] block">المحصل الفعلي (PT)</span>
                    <span className="font-bold tabular-nums">{collectedRevenue.toLocaleString()} ج.م</span>
                  </div>
                  <div>
                    <span className="text-[#C9CFD6] text-[11px] block">نسبة الشريحة الحالية</span>
                    <span className="font-bold text-[#C6F24E]">{tierPercent}%</span>
                  </div>
                </div>

                {/* Next tier progress */}
                <div className="mt-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between text-[11px] mb-1">
                    <span className="text-[#C9CFD6]">
                      {nextTier
                        ? `الهدف التالي: شريحة ${nextTier.percent}% (${nextTier.minRevenue.toLocaleString()} ج.م)`
                        : "الحد الأقصى للشرائح"}
                    </span>
                    <span className="font-bold text-[#C6F24E]">
                      {nextTier ? `متبقي ${nextTier.neededRevenue.toLocaleString()} ج.م` : "مكتمل 100%"}
                    </span>
                  </div>
                  <div className="h-2 bg-[#3A4350] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#C6F24E] rounded-full transition-all duration-300"
                      style={{
                        width: nextTier
                          ? `${Math.min(100, Math.round((collectedRevenue / nextTier.minRevenue) * 100))}%`
                          : "100%",
                      }}
                    />
                  </div>
                </div>
              </section>

              {/* Salary & Payout Summary */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-white border border-[#E1E5DF] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#5B6470] text-[11px] mb-1">
                    <Wallet className="h-3.5 w-3.5" />
                    <span>الراتب الأساسي</span>
                  </div>
                  <span className="text-sm font-bold text-[#14181F] tabular-nums">
                    {baseSalary.toLocaleString()} ج.م
                  </span>
                </div>
                <div className="bg-[#C6F24E]/15 border border-[#C6F24E] rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-[#14181F] text-[11px] mb-1 font-semibold">
                    <TrendingUp className="h-3.5 w-3.5" />
                    <span>إجمالي الصافي المقدر</span>
                  </div>
                  <span className="text-sm font-black text-[#14181F] tabular-nums">
                    {(baseSalary + commissionAmount).toLocaleString()} ج.م
                  </span>
                </div>
              </div>

              {/* Milestones Timeline */}
              <section className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold text-[#14181F] flex items-center gap-1.5">
                    <Dumbbell className="h-3.5 w-3.5 text-[#14181F]" />
                    <span>محطات عمولة التدريب الشخصي</span>
                  </h4>
                  <span className="text-[10px] text-[#5B6470]">
                    {commData?.entries?.length || 0} محطة
                  </span>
                </div>

                {commLoading ? (
                  <div className="py-8 text-center text-xs text-[#5B6470]">جاري تحميل المحطات...</div>
                ) : !commData?.entries || commData.entries.length === 0 ? (
                  <div className="py-6 text-center text-xs text-[#5B6470] bg-[#F2F4F1] rounded-xl">
                    لا توجد محطات عمولة مستحقة في هذا الشهر
                  </div>
                ) : (
                  <div className="space-y-2">
                    {commData.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="p-2.5 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF] flex flex-col gap-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#14181F]">
                            {entry.member?.name || "مشترك PT"}
                          </span>
                          {getStatusBadge(entry.status)}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[#5B6470]">
                          <span>
                            {entry.plan?.name || "باقة تدريب"} (محطة #{entry.milestoneIndex})
                          </span>
                          <span className="tabular-nums">
                            {new Date(entry.dueDate).toLocaleDateString("ar-EG")}
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-[#E1E5DF] text-xs font-semibold">
                          <span className="text-[#5B6470]">
                            المحصل: {entry.allocatedBase?.toLocaleString()} ج.م (حصة {Math.round(entry.shareBps / 100)}%)
                          </span>
                          <span className="text-[#14181F] font-bold">
                            {Math.round((entry.allocatedBase * (entry.shareBps / 10000) * (tierPercent / 100))).toLocaleString()} ج.م
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>

        {/* 4-item Bottom Navigation Bar */}
        <nav className="grid grid-cols-4 bg-white border-t border-[#E1E5DF] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`py-3 px-1 text-center text-[12px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "home" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Home className="h-4 w-4" />
            <span>الرئيسية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trainees")}
            className={`py-3 px-1 text-center text-[12px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "trainees" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>متدربيني</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("classes")}
            className={`py-3 px-1 text-center text-[12px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "classes" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>الحصص</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("commission")}
            className={`py-3 px-1 text-center text-[12px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "commission" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Award className="h-4 w-4" />
            <span>عمولتي</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
