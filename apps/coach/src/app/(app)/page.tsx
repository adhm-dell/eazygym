"use client";

import React, { useState, useEffect } from "react";
import { Badge, Button } from "@gym/ui";
import {
  UserCheck,
  Award,
  Calendar,
  Users,
  Home,
  Coffee,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Clock,
  AlertCircle,
  Dumbbell,
  Wallet,
  CheckCircle,
  XCircle,
  Activity,
  Flame,
  LogOut,
} from "lucide-react";
import { clearStoredAuth } from "../../lib/api";
import { fetchMyCommission, type CoachCommissionData } from "../../features/commission/api";
import { traineesApi, type Trainee } from "../../features/trainees/api";
import { classesApi } from "../../features/classes/api";
import { breaksApi, type CoachBreak } from "../../features/breaks/api";
import { assignmentsApi, type FitnessAssignment } from "../../features/assignments/api";

export default function CoachHomePage() {
  const [activeTab, setActiveTab] = useState<"home" | "trainees" | "classes" | "breaks" | "commission">("home");

  // Live Commission
  const currentDate = new Date();
  const [commYear, setCommYear] = useState<number>(currentDate.getFullYear());
  const [commMonth, setCommMonth] = useState<number>(currentDate.getMonth() + 1);
  const [commData, setCommData] = useState<CoachCommissionData | null>(null);

  // Live Trainees
  const [trainees, setTrainees] = useState<Trainee[]>([]);
  const [selectedTrainee, setSelectedTrainee] = useState<Trainee | null>(null);
  const [traineesLoading, setTraineesLoading] = useState(false);

  // Live Classes
  const [classes, setClasses] = useState<any[]>([]);

  // Live Breaks
  const [breaks, setBreaks] = useState<CoachBreak[]>([]);
  const [activeBreak, setActiveBreak] = useState<CoachBreak | null>(null);
  const [breakTimer, setBreakTimer] = useState<number>(0); // elapsed seconds

  // Live Assignments (Fitness Profile)
  const [assignments, setAssignments] = useState<FitnessAssignment[]>([]);

  // Action status message
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setActionError(msg);
      setTimeout(() => setActionError(null), 4000);
    } else {
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  // Load live data
  const loadInitialData = async () => {
    try {
      const [comm, trList, clsList, brkList, assList] = await Promise.all([
        fetchMyCommission(commYear, commMonth).catch(() => null),
        traineesApi.getMyTrainees().catch(() => []),
        classesApi.getTodayClasses().catch(() => []),
        breaksApi.getBreaks().catch(() => []),
        assignmentsApi.getAssignments().catch(() => []),
      ]);

      if (comm) setCommData(comm);
      if (trList && trList.length > 0) setTrainees(trList);
      if (clsList) setClasses(clsList);
      if (brkList) {
        setBreaks(brkList);
        const cur = brkList.find((b) => b.status === "ACTIVE" || b.status === "PENDING");
        setActiveBreak(cur || null);
      }
      if (assList) setAssignments(assList);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadInitialData();
  }, [commYear, commMonth]);

  // Break Timer Tick
  useEffect(() => {
    if (!activeBreak || activeBreak.status !== "ACTIVE" || !activeBreak.startedAt) {
      setBreakTimer(0);
      return;
    }
    const startMs = new Date(activeBreak.startedAt).getTime();
    const interval = setInterval(() => {
      const elapsedSec = Math.floor((Date.now() - startMs) / 1000);
      setBreakTimer(elapsedSec);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  // Handlers
  const handleRequestBreak = async () => {
    try {
      const res = await breaksApi.requestBreak(20);
      setActiveBreak(res);
      showFeedback("تم إرسال طلب الاستراحة إلى الاستقبال");
      await loadInitialData();
    } catch (err: any) {
      showFeedback(err.message || "تعذر طلب الاستراحة (ربما يوجد مدرب آخر في استراحة)", true);
    }
  };

  const handleEndBreak = async () => {
    if (!activeBreak) return;
    try {
      await breaksApi.endBreak(activeBreak.id);
      setActiveBreak(null);
      showFeedback("تم إنهاء الاستراحة والعودة للعمل بنجاح");
      await loadInitialData();
    } catch (err: any) {
      showFeedback(err.message || "تعذر إنهاء الاستراحة", true);
    }
  };

  const handleAcceptAssignment = async (id: string) => {
    try {
      await assignmentsApi.acceptAssignment(id);
      showFeedback("تم قبول المتدرب الجديد بنجاح وإضافته إلى قائمتك");
      await loadInitialData();
    } catch (err: any) {
      showFeedback(err.message || "تعذر قبول المتدرب", true);
    }
  };

  const handleRejectAssignment = async (id: string) => {
    const reason = prompt("يرجى كتابة سبب الاعتذار عن المتدرب:");
    if (!reason) return;
    try {
      await assignmentsApi.rejectAssignment(id, reason);
      showFeedback("تم الاعتذار عن المتدرب وإعادته إلى قائمة الانتظار");
      await loadInitialData();
    } catch (err: any) {
      showFeedback(err.message || "تعذر رفض المتدرب", true);
    }
  };

  const handleLogPTSession = async (trainee: Trainee) => {
    try {
      await traineesApi.logSession({
        type: "PT",
        startTime: new Date().toISOString(),
        durationMinutes: 60,
        participant: {
          memberId: trainee.memberId,
          subscriptionId: trainee.subscription?.id,
          source: "PT",
        },
      });
      showFeedback(`تم خصم جلسة بنجاح للمتدرب: ${trainee.member.name}`);
      await loadInitialData();
    } catch (err: any) {
      showFeedback(err.message || "فشل تسجيل الجلسة", true);
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

  // Format break countdown
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen bg-[#E5E9E3] flex justify-center items-center sm:py-6" dir="rtl">
      <div className="w-full max-w-[420px] min-h-screen sm:min-h-[860px] bg-[#F2F4F1] flex flex-col justify-between sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-[#14181F] overflow-hidden">
        {/* Mobile Header & Body */}
        <div className="flex-1 p-4 flex flex-col gap-3.5 overflow-y-auto">
          {/* Top greeting */}
          <header className="pt-1 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-[#5B6470] font-medium">بوابة المدرب (Phase 08)</p>
              <h1 className="text-[20px] font-bold text-[#14181F] tracking-tight">{coachName}</h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-white border border-[#E1E5DF] px-2.5 py-1 rounded-full text-xs font-semibold text-[#14181F]">
                <Calendar className="h-3.5 w-3.5 text-[#5B6470]" />
                <span>{commMonth} / {commYear}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  clearStoredAuth();
                  window.location.href = "/login";
                }}
                className="bg-white border border-red-200 text-red-600 hover:bg-red-50 p-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors"
                title="تسجيل الخروج والعودة لصفحة الدخول"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {/* Feedback Banners */}
          {actionSuccess && (
            <div className="p-2.5 rounded-xl bg-[#EDF7ED] border border-[#BDE5BD] text-[#1B7F4B] text-xs font-bold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}
          {actionError && (
            <div className="p-2.5 rounded-xl bg-[#FDF2F2] border border-[#F8B4B4] text-[#B3261E] text-xs font-bold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{actionError}</span>
            </div>
          )}

          {/* ==================== TAB 1: HOME ==================== */}
          {activeTab === "home" && (
            <>
              {/* Active Break Banner if ongoing */}
              {activeBreak && (
                <div
                  className={`p-3 rounded-2xl border text-xs font-bold flex items-center justify-between ${
                    activeBreak.status === "ACTIVE"
                      ? breakTimer > 20 * 60
                        ? "bg-[#FDF2F2] border-[#B3261E] text-[#B3261E] animate-pulse"
                        : "bg-[#FFF9E6] border-[#D97706] text-[#D97706]"
                      : "bg-[#F2F4F1] border-[#E1E5DF] text-[#5B6470]"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Coffee className="h-4 w-4" />
                    <div>
                      <span>
                        {activeBreak.status === "ACTIVE"
                          ? `أنت في استراحة (${formatTime(breakTimer)})`
                          : "طلب الاستراحة معلق لدى الاستقبال..."}
                      </span>
                      {breakTimer > 20 * 60 && (
                        <span className="block text-[10px] font-bold">تجاوزت الـ 20 دقيقة! يرجى العودة للصالة.</span>
                      )}
                    </div>
                  </div>
                  {activeBreak.status === "ACTIVE" && (
                    <Button size="sm" variant="default" onClick={handleEndBreak} className="text-xs h-7 rounded-lg">
                      إنهاء
                    </Button>
                  )}
                </div>
              )}

              {/* Pending Member Assignments Inbox */}
              {assignments.length > 0 && (
                <section className="bg-white border-2 border-[#C6F24E] rounded-[16px] p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#14181F] flex items-center gap-1.5">
                      <Flame className="h-4 w-4 text-[#C6F24E]" />
                      <span>متدربين جدد بحاجة لموافقتك ({assignments.length})</span>
                    </span>
                    <Badge variant="w">جديد</Badge>
                  </div>
                  {assignments.map((ass) => (
                    <div key={ass.id} className="p-2.5 rounded-xl bg-[#F2F4F1] flex items-center justify-between text-xs">
                      <div>
                        <p className="font-bold text-[#14181F]">{ass.member.name}</p>
                        <p className="text-[11px] text-[#5B6470]">جلسة قياس بدني مجانية</p>
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAcceptAssignment(ass.id)}
                          className="px-2.5 py-1 bg-[#14181F] text-white rounded-lg font-bold text-xs hover:bg-black cursor-pointer"
                        >
                          قبول
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectAssignment(ass.id)}
                          className="px-2 py-1 bg-white text-[#B3261E] border border-[#E1E5DF] rounded-lg text-xs hover:bg-red-50 cursor-pointer"
                        >
                          اعتذار
                        </button>
                      </div>
                    </div>
                  ))}
                </section>
              )}

              {/* Hero Commission Card */}
              <section className="bg-[#14181F] text-white rounded-[18px] p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-[12px] text-[#C9CFD6] font-medium">العمولة المستحقة لشهر {commMonth}</span>
                  <Award className="h-4 w-4 text-[#C6F24E]" />
                </div>
                <b className="text-[30px] font-black block my-1 tabular-nums">
                  {commissionAmount.toLocaleString()} ج.م
                </b>
                <div className="flex items-center justify-between text-[12px] text-white/90">
                  <span>المحصل: {collectedRevenue.toLocaleString()} ج.م</span>
                  <span className="font-bold text-[#C6F24E]">شريحة {tierPercent}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-[#3A4350] rounded-full mt-2 overflow-hidden">
                  <div
                    className="h-full bg-[#C6F24E] rounded-full transition-all duration-300"
                    style={{
                      width: nextTier
                        ? `${Math.min(100, Math.round((collectedRevenue / nextTier.minRevenue) * 100))}%`
                        : "100%",
                    }}
                  />
                </div>
                <p className="text-[11px] text-[#C9CFD6] mt-1.5 font-medium">
                  {nextTier
                    ? `متبقي ${nextTier.neededRevenue.toLocaleString()} ج.م للوصول لشريحة ${nextTier.percent}%`
                    : "وصلت لأعلى شريحة عمولة هذا الشهر"}
                </p>
              </section>

              {/* Today's Private Sessions */}
              <section className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-[#14181F]">جلسات اليوم (PT)</h3>
                  <span className="text-[11px] text-[#5B6470]">{trainees.length} متدرب</span>
                </div>
                <div className="space-y-1.5">
                  {trainees.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-xl bg-[#F2F4F1] text-xs">
                      <div>
                        <p className="font-bold text-[#14181F]">{t.member.name}</p>
                        <p className="text-[10px] text-[#5B6470]">
                          باقي {t.subscription?.sessionsRemaining ?? 6} جلسات
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleLogPTSession(t)}
                        className="px-2.5 py-1 bg-[#C6F24E] text-[#14181F] rounded-lg font-bold text-[11px] hover:bg-[#b5e03e] cursor-pointer"
                      >
                        خصم جلسة
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Quick Break Button */}
              {!activeBreak && (
                <button
                  type="button"
                  onClick={handleRequestBreak}
                  className="w-full bg-white border border-[#E1E5DF] hover:bg-[#F2F4F1] text-[#14181F] font-bold text-xs p-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Coffee className="h-4 w-4 text-[#D97706]" />
                  <span>طلب استراحة سريعة (20 دقيقة)</span>
                </button>
              )}
            </>
          )}

          {/* ==================== TAB 2: TRAINEES ==================== */}
          {activeTab === "trainees" && (
            <div className="space-y-3">
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-xs font-bold text-[#14181F]">قائمة المتدربين المخصصين لك</h3>
                  <Badge variant="default" className="text-xs font-bold bg-[#14181F] text-white">
                    {trainees.length} متدرب
                  </Badge>
                </div>

                <div className="space-y-2">
                  {trainees.length === 0 ? (
                    <p className="text-xs text-center text-[#5B6470] py-6">لا يوجد متدربون مخصصون لك حالياً</p>
                  ) : (
                    trainees.map((t) => (
                      <div
                        key={t.id}
                        onClick={() => setSelectedTrainee(selectedTrainee?.id === t.id ? null : t)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer ${
                          selectedTrainee?.id === t.id
                            ? "bg-[#C6F24E]/10 border-[#C6F24E]"
                            : "bg-[#F2F4F1] border-[#E1E5DF] hover:bg-[#EAEAEA]"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs font-bold text-[#14181F]">{t.member.name}</p>
                            <p className="text-[11px] text-[#5B6470]">كود: {t.member.code} · هاتف: {t.member.phone}</p>
                          </div>
                          <Badge variant="g">
                            {t.subscription?.sessionsRemaining ?? 6} جلسات
                          </Badge>
                        </div>

                        {/* Expanded details */}
                        {selectedTrainee?.id === t.id && (
                          <div className="mt-3 pt-2 border-t border-[#E1E5DF] text-xs space-y-2">
                            <div className="grid grid-cols-2 gap-2 text-[11px]">
                              <div>
                                <span className="text-[#5B6470] block">الباقة:</span>
                                <span className="font-bold">{t.subscription?.planName || "PT 12 جلسة"}</span>
                              </div>
                              <div>
                                <span className="text-[#5B6470] block">الأيام المتبقية:</span>
                                <span className="font-bold">{t.subscription?.daysRemaining ?? 21} يوم</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleLogPTSession(t);
                              }}
                              className="w-full mt-2 py-2 bg-[#14181F] text-[#C6F24E] font-bold rounded-lg hover:bg-black transition-colors"
                            >
                              تسجيل حضور وخصم 1 جلسة PT
                            </button>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: CLASSES ==================== */}
          {activeTab === "classes" && (
            <div className="space-y-3">
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <h3 className="text-xs font-bold text-[#14181F] mb-3">حصص اللياقة الجماعية لليوم</h3>
                <div className="space-y-2">
                  {classes.length === 0 ? (
                    <div className="space-y-2">
                      <div className="p-3 bg-[#F2F4F1] rounded-xl border border-[#E1E5DF]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#14181F]">Cross Training & Core</span>
                          <Badge variant="g">18:00</Badge>
                        </div>
                        <p className="text-[11px] text-[#5B6470] mt-1">القاعة الرئيسية · 12 مشترك مسجل</p>
                      </div>
                      <div className="p-3 bg-[#F2F4F1] rounded-xl border border-[#E1E5DF]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#14181F]">HIIT Fat Burn</span>
                          <Badge variant="w">20:00</Badge>
                        </div>
                        <p className="text-[11px] text-[#5B6470] mt-1">قاعة الفتنس · 8 مشتركين مسجلين</p>
                      </div>
                    </div>
                  ) : (
                    classes.map((cls) => (
                      <div key={cls.id} className="p-3 bg-[#F2F4F1] rounded-xl border border-[#E1E5DF]">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-[#14181F]">{cls.classTemplate?.name || "حصة جماعية"}</span>
                          <Badge variant="default">{cls.startTime}</Badge>
                        </div>
                        <p className="text-[11px] text-[#5B6470] mt-1">الحالة: {cls.status}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 4: BREAKS & SHIFTS ==================== */}
          {activeTab === "breaks" && (
            <div className="space-y-3">
              {/* Break Request Card */}
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5 space-y-3">
                <h3 className="text-xs font-bold text-[#14181F] flex items-center gap-1.5">
                  <Coffee className="h-4 w-4 text-[#D97706]" />
                  <span>إدارة الاستراحات اليومية</span>
                </h3>

                {activeBreak ? (
                  <div className="p-3 bg-[#FFF9E6] border border-[#D97706] rounded-xl text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-[#D97706]">
                      <span>الحالة: {activeBreak.status}</span>
                      {activeBreak.status === "ACTIVE" && (
                        <span className="font-mono text-sm">{formatTime(breakTimer)}</span>
                      )}
                    </div>
                    {activeBreak.status === "ACTIVE" && (
                      <Button onClick={handleEndBreak} variant="default" className="w-full font-bold">
                        إنهاء الاستراحة والعودة
                      </Button>
                    )}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleRequestBreak}
                    className="w-full bg-[#14181F] text-[#C6F24E] font-bold text-xs p-3 rounded-xl hover:bg-black transition-colors"
                  >
                    طلب استراحة (20 دقيقة)
                  </button>
                )}

                <div className="text-[11px] text-[#5B6470] leading-relaxed bg-[#F2F4F1] p-2.5 rounded-xl">
                  <b>قواعد الاستراحة:</b> حد أقصى 2 استراحة يومياً، مدة الاستراحة 20 دقيقة، ولا يمكن خروج مدربين في نفس الوقت.
                </div>
              </div>

              {/* Weekly Shift View */}
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <h3 className="text-xs font-bold text-[#14181F] mb-2 flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  <span>جدول الورديات الأسبوعي</span>
                </h3>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-[#F2F4F1]">
                    <span>السبت - الأربعاء (مسائي)</span>
                    <span className="font-bold">14:00 - 22:00</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-[#F2F4F1]">
                    <span>الخميس (صباحي)</span>
                    <span className="font-bold">08:00 - 16:00</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-[#EAEAEA] text-[#5B6470]">
                    <span>الجمعة</span>
                    <span className="font-bold">إجازة أسبوعية</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 5: COMMISSION ==================== */}
          {activeTab === "commission" && (
            <div className="space-y-3">
              {/* Month Selector Bar */}
              <div className="flex items-center justify-between bg-white border border-[#E1E5DF] rounded-xl p-2">
                <button
                  type="button"
                  onClick={() => setCommMonth(commMonth === 1 ? 12 : commMonth - 1)}
                  className="p-1.5 hover:bg-[#F2F4F1] rounded-lg transition-colors cursor-pointer text-[#14181F]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="text-xs font-bold text-[#14181F]">
                  كشف عمولات شهر: {commMonth} / {commYear}
                </div>
                <button
                  type="button"
                  onClick={() => setCommMonth(commMonth === 12 ? 1 : commMonth + 1)}
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

              {/* Milestones Schedule Table */}
              <section className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <h4 className="text-xs font-bold text-[#14181F] mb-2 flex items-center gap-1.5">
                  <Dumbbell className="h-3.5 w-3.5" />
                  <span>محطات عمولة التدريب الشخصي</span>
                </h4>

                {!commData?.entries || commData.entries.length === 0 ? (
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

        {/* 5-item Bottom Navigation Bar */}
        <nav className="grid grid-cols-5 bg-white border-t border-[#E1E5DF] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`py-2.5 px-1 text-center text-[11px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === "home" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Home className="h-4 w-4" />
            <span>الرئيسية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trainees")}
            className={`py-2.5 px-1 text-center text-[11px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === "trainees" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>متدربيني</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("classes")}
            className={`py-2.5 px-1 text-center text-[11px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === "classes" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>الحصص</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("breaks")}
            className={`py-2.5 px-1 text-center text-[11px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
              activeTab === "breaks" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Coffee className="h-4 w-4" />
            <span>الاستراحة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("commission")}
            className={`py-2.5 px-1 text-center text-[11px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 transition-colors ${
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
