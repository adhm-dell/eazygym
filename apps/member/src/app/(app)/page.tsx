"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  memberApi,
  switchMember,
  getOfflineMember,
  saveOfflineMember,
  clearStoredAuth,
  type StoredOfflineMember,
} from "../../lib/api";
import { formatMoney } from "../../lib/money";
import {
  QrCode,
  Calendar,
  Snowflake,
  Wallet,
  Dumbbell,
  AlertTriangle,
  CheckCircle2,
  Wifi,
  WifiOff,
  LogOut,
  ChevronDown,
  ChevronUp,
  Sparkles,
  CalendarDays,
  RotateCcw,
} from "lucide-react";

export default function MemberPortalPage() {
  const router = useRouter();

  // Navigation tab
  const [activeTab, setActiveTab] = useState<"home" | "subscriptions" | "freeze" | "wallet" | "classes">("home");

  // State
  const [member, setMember] = useState<any>(null);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [wallet, setWallet] = useState<{ balance: number; transactions: any[] }>({ balance: 0, transactions: [] });
  const [todayClasses, setTodayClasses] = useState<any[]>([]);
  const [classSchedules, setClassSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [freezeDays, setFreezeDays] = useState(7);
  const [freezeReason, setFreezeReason] = useState("ظروف سفر");
  const [freezeLoading, setFreezeLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; isError?: boolean } | null>(null);
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  // Test accounts
  const testMembers = [
    { name: "محمد أحمد", phone: "01011122233", code: "100245", role: "نشط (جيم + كابتن)" },
    { name: "محمود حسن", phone: "01012345672", code: "100202", role: "ينتهي خلال 3 أيام" },
    { name: "زياد محمود", phone: "01012345674", code: "100404", role: "اشتراك مجمد (Frozen)" },
    { name: "كريم عادل", phone: "01012345675", code: "100505", role: "عليه قسط متأخر 500 ج.م" },
  ];

  // Load data
  const loadMemberData = async () => {
    setLoading(true);
    setActionMessage(null);

    try {
      // 1. Fetch Profile
      const meRes = await memberApi.getMe().catch((e) => {
        console.warn("Online fetch failed, checking offline cache", e);
        return null;
      });

      if (!meRes || !meRes.member) {
        // Fallback to offline storage
        const cached = getOfflineMember();
        if (cached) {
          setIsOffline(true);
          setMember(cached);
          setLoading(false);
          return;
        }
      }

      setIsOffline(!navigator.onLine);
      const m = meRes.member;
      setMember(m);

      // 2. Fetch Subscriptions
      const subs = await memberApi.getSubscriptions().catch(() => []);
      setSubscriptions(subs);

      // 3. Fetch Wallet
      const wal = await memberApi.getWallet(m.id).catch(() => ({ balance: m.walletBalance || 0, transactions: [] }));
      setWallet(wal);

      // 4. Fetch Classes
      const classes = await memberApi.getTodayClasses().catch(() => []);
      setTodayClasses(classes);

      const schedules = await memberApi.getClassSchedules().catch(() => []);
      setClassSchedules(schedules);

      // 5. Save offline snapshot
      const activeSub = subs.find((s) => s.status === "ACTIVE") || subs[0];
      const offlineSnapshot: StoredOfflineMember = {
        id: m.id,
        name: m.name,
        code: m.code,
        phone: m.phone,
        status: (activeSub?.status as any) || "ACTIVE",
        statusTextAr: getStatusBadgeText(activeSub?.status || "ACTIVE"),
        daysLeft: activeSub?.daysLeft ?? 30,
        primaryPlanName: activeSub?.plan?.name || "اشتراك جيم",
        walletBalance: wal.balance,
        lastUpdated: new Date().toISOString(),
      };
      saveOfflineMember(offlineSnapshot);
    } catch (err: any) {
      console.error(err);
      const cached = getOfflineMember();
      if (cached) {
        setIsOffline(true);
        setMember(cached);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMemberData();

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const handleSwitch = async (phone: string) => {
    setShowSwitchMenu(false);
    setLoading(true);
    try {
      await switchMember(phone);
      await loadMemberData();
    } catch (e: any) {
      setActionMessage({ text: e.message || "فشل التبديل", isError: true });
    }
  };

  const handleFreeze = async (subId: string) => {
    setFreezeLoading(true);
    setActionMessage(null);
    try {
      await memberApi.freezeSubscription(subId, freezeDays, freezeReason);
      setActionMessage({ text: `تم تجميد اشتراكك بنجاح لمدة ${freezeDays} أيام` });
      await loadMemberData();
    } catch (e: any) {
      setActionMessage({ text: e.message || "تعذر تجميد الاشتراك", isError: true });
    } finally {
      setFreezeLoading(false);
    }
  };

  const handleUnfreeze = async (subId: string) => {
    setFreezeLoading(true);
    setActionMessage(null);
    try {
      await memberApi.unfreezeSubscription(subId);
      setActionMessage({ text: "تم فك تجميد الاشتراك وإعادة تفعيله بنجاح!" });
      await loadMemberData();
    } catch (e: any) {
      setActionMessage({ text: e.message || "تعذر فك التجميد", isError: true });
    } finally {
      setFreezeLoading(false);
    }
  };

  function getStatusBadge(status: string) {
    switch (status) {
      case "ACTIVE":
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#E3F5EA] text-[#1B7F4B]">اشتراكك ساري</span>;
      case "FROZEN":
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-blue-100 text-blue-800">اشتراك مجمد</span>;
      case "EXPIRED":
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#FDE7E4] text-[#B3261E]">منتهي - يرجى التجديد</span>;
      case "SUSPENDED_UNPAID":
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#FDE7E4] text-[#B3261E]">موقوف لعدم السداد</span>;
      default:
        return <span className="px-2.5 py-1 text-[11px] font-bold rounded-lg bg-[#FFF1D6] text-[#8A5A00]">{status}</span>;
    }
  }

  function getStatusBadgeText(status: string) {
    if (status === "ACTIVE") return "اشتراكك ساري";
    if (status === "FROZEN") return "اشتراك مجمد";
    if (status === "EXPIRED") return "منتهي";
    if (status === "SUSPENDED_UNPAID") return "موقوف لعدم السداد";
    return status;
  }

  const primarySub = subscriptions.find((s) => s.status === "ACTIVE") || subscriptions[0];
  const isOverdue = primarySub && primarySub.remaining > 0;

  return (
    <div className="min-h-screen bg-[#E5E9E3] flex justify-center items-center sm:py-6 selection:bg-[#C6F24E]">
      {/* Mobile Shell Frame */}
      <div className="w-full max-w-[412px] min-h-screen sm:min-h-[860px] bg-[#F2F4F1] flex flex-col justify-between sm:rounded-[40px] sm:shadow-2xl sm:border-[8px] sm:border-[#14181F] overflow-hidden relative">
        
        {/* Top Floating App Bar */}
        <div className="bg-[#14181F] text-white p-4 pt-5 pb-4 shrink-0 flex items-center justify-between shadow-md z-30">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-[#C6F24E] text-[#14181F] flex items-center justify-center font-black text-sm">
              EG
            </div>
            <div>
              <b className="text-[15px] text-[#C6F24E] font-bold tracking-tight block leading-tight">
                EazyGym
              </b>
              <span className="text-[10px] text-[#C9CFD6]">بوابة الأعضاء الذكية</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Offline/Online Indicator */}
            {isOffline ? (
              <span className="flex items-center gap-1 text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                <WifiOff className="h-3 w-3" />
                <span>دون إنترنت (Offline)</span>
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                <Wifi className="h-3 w-3" />
                <span>متصل بالـ DB</span>
              </span>
            )}

            {/* Quick Switch Dropdown */}
            <button
              type="button"
              onClick={() => setShowSwitchMenu(!showSwitchMenu)}
              className="text-[11px] bg-white/10 hover:bg-white/20 text-[#C6F24E] px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer"
            >
              <span>تبديل</span>
              {showSwitchMenu ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* Logout Button */}
            <button
              type="button"
              onClick={() => {
                clearStoredAuth();
                window.location.href = "/login";
              }}
              className="text-[11px] bg-white/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 p-1.5 rounded-lg font-bold flex items-center transition-colors cursor-pointer"
              title="تسجيل الخروج والعودة لشاشة الدخول"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Dropdown Menu for Quick Switch between Seeded Members */}
        {showSwitchMenu && (
          <div className="absolute top-[64px] left-3 right-3 bg-[#14181F] text-white border border-[#262D38] rounded-2xl shadow-2xl p-3 z-40 space-y-2 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <span className="text-xs font-bold text-[#C6F24E] flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                اختر عضو تجريبي لاختبار النظام:
              </span>
              <button
                type="button"
                onClick={() => {
                  clearStoredAuth();
                  window.location.href = "/login";
                }}
                className="text-[11px] text-red-400 hover:text-red-300 flex items-center gap-1 cursor-pointer font-bold"
              >
                <LogOut className="h-3 w-3" />
                تسجيل خروج
              </button>
            </div>
            <div className="space-y-1.5 max-h-[260px] overflow-y-auto">
              {testMembers.map((m) => (
                <button
                  key={m.phone}
                  type="button"
                  onClick={() => handleSwitch(m.phone)}
                  className={`w-full text-right p-2 rounded-xl text-xs transition-colors flex items-center justify-between cursor-pointer ${
                    member?.phone === m.phone
                      ? "bg-[#C6F24E] text-[#14181F] font-bold"
                      : "bg-[#262D38]/60 hover:bg-[#262D38] text-white"
                  }`}
                >
                  <div>
                    <b>{m.name}</b>
                    <span className="block text-[10px] opacity-75">كود: {m.code}</span>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded font-bold bg-black/20">
                    {m.role}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Action Alert Banner */}
        {actionMessage && (
          <div
            className={`p-3 mx-4 mt-3 rounded-xl text-xs font-medium flex items-center justify-between shadow-sm animate-in fade-in ${
              actionMessage.isError
                ? "bg-[#FDE7E4] border border-red-200 text-[#B3261E]"
                : "bg-[#E3F5EA] border border-emerald-200 text-[#1B7F4B]"
            }`}
          >
            <span>{actionMessage.text}</span>
            <button
              type="button"
              onClick={() => setActionMessage(null)}
              className="text-xs font-bold px-1.5 py-0.5 rounded hover:bg-black/10"
            >
              ✕
            </button>
          </div>
        )}

        {/* Scrollable Main Body Content */}
        <div className="flex-1 p-4 pb-24 overflow-y-auto space-y-4">
          
          {/* 1. HOME TAB */}
          {activeTab === "home" && (
            <div className="space-y-3.5">
              {/* Member Greeting Card */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#5B6470] font-medium">أهلاً بك مجدداً</p>
                  <h1 className="text-[22px] font-bold text-[#14181F] tracking-tight">
                    {member?.name || "محمد أحمد"}
                  </h1>
                </div>
                {getStatusBadge(primarySub?.status || "ACTIVE")}
              </div>

              {/* Offline Pass Notice */}
              {isOffline && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-[11px] flex items-center gap-2">
                  <WifiOff className="h-4 w-4 shrink-0 text-amber-600" />
                  <span>أنت تتصفح في وضع عدم الاتصال. رمز الـ QR وبيانات عضويتك جاهزة للمسح في الاستقبال.</span>
                </div>
              )}

              {/* Big Access QR Code Card (Offline Shell) */}
              <section className="bg-white border-2 border-[#14181F] rounded-3xl p-5 flex flex-col items-center text-center shadow-md relative overflow-hidden">
                <div className="absolute top-3 right-3 text-[10px] font-bold text-emerald-700 bg-[#E3F5EA] px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>رمز دخول فوري</span>
                </div>

                <p className="text-[12px] font-bold text-[#5B6470] mb-2">
                  امسح الرمز على جهاز الاستقبال
                </p>

                {/* Vector QR Graphic */}
                <div className="p-3 bg-white border border-[#E1E5DF] rounded-2xl shadow-inner my-1">
                  <svg
                    width="160"
                    height="160"
                    viewBox="0 0 21 21"
                    role="img"
                    aria-label={`رمز QR لدخول العضو ${member?.code || "100245"}`}
                    className="shrink-0"
                  >
                    <rect width="21" height="21" fill="#fff" />
                    <g fill="#14181F">
                      {/* Standard QR Corner Markers */}
                      <path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" />
                      <path d="M9 1h2v2H9zM9 5h3v2H9zM1 9h2v2H1zM5 9h3v3H5zM10 9h2v2h-2zM14 10h3v2h-3zM18 9h2v3h-2zM9 14h3v2H9zM14 14h2v3h-2zM17 17h3v3h-3zM10 18h3v2h-3z" />
                    </g>
                    <g fill="#fff">
                      <path d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z" />
                    </g>
                    <g fill="#14181F">
                      <path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2z" />
                    </g>
                  </svg>
                </div>

                <div className="mt-3">
                  <span className="text-[11px] text-[#5B6470] font-medium block">كود العضو</span>
                  <b className="text-[32px] font-mono font-black text-[#14181F] tracking-wider tabular-nums leading-none">
                    {member?.code || "100245"}
                  </b>
                </div>

                <div className="mt-2 text-[11px] text-[#5B6470]">
                  جاهز للمسح دائماً · يعمل حتى عند انقطاع الإنترنت
                </div>
              </section>

              {/* Primary Active Membership Card */}
              {primarySub ? (
                <section className="bg-white border border-[#E1E5DF] rounded-2xl p-4 shadow-subtle space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <b className="text-[15px] font-bold text-[#14181F] block">
                        {primarySub.plan?.name || "اشتراك رئيسي"}
                      </b>
                      <span className="text-[11px] text-[#5B6470]">
                        ينتهي في {new Date(primarySub.endDate).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                    <span className="text-xs font-mono font-bold bg-[#F2F4F1] px-2.5 py-1 rounded-lg text-[#14181F]">
                      متبقي {primarySub.daysLeft} يوم
                    </span>
                  </div>

                  {/* Days Progress Bar */}
                  <div className="h-2.5 bg-[#E1E5DF] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#14181F] rounded-full transition-all"
                      style={{
                        width: `${Math.min(100, Math.max(10, Math.round(((primarySub.durationDays - primarySub.daysLeft) / primarySub.durationDays) * 100)))}%`,
                      }}
                    />
                  </div>

                  {/* Overdue Alert Box */}
                  {primarySub.remaining > 0 && (
                    <div className="p-2.5 rounded-xl bg-[#FDE7E4] border border-red-200 text-[#8F1F18] text-xs flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-bold">
                        <AlertTriangle className="h-4 w-4 shrink-0 text-[#B3261E]" />
                        <span>متبقي عليك قسط: {formatMoney(primarySub.remaining)}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-80">يرجى السداد</span>
                    </div>
                  )}
                </section>
              ) : (
                <div className="bg-white border border-[#E1E5DF] rounded-2xl p-6 text-center text-sm text-[#5B6470]">
                  لا يوجد اشتراك نشط حالياً. توجه للاستقبال للاشتراك.
                </div>
              )}

              {/* PT Session & Coach Card (if has PT) */}
              {subscriptions.find((s) => s.kind === "PT") && (
                <section className="bg-white border border-[#E1E5DF] rounded-2xl p-4 shadow-subtle space-y-2">
                  {(() => {
                    const ptSub = subscriptions.find((s) => s.kind === "PT");
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="h-8 w-8 rounded-lg bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-bold">
                              <Dumbbell className="h-4 w-4" />
                            </div>
                            <div>
                              <b className="text-xs font-bold text-[#14181F] block">
                                {ptSub?.plan?.name || "تدريب خاص (PT)"}
                              </b>
                              <span className="text-[10px] text-[#5B6470]">
                                الكابتن: {ptSub?.activeCoach?.name || "كابتن أحمد حسن"}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-emerald-700 bg-[#E3F5EA] px-2 py-0.5 rounded-md">
                            {ptSub?.sessionsLeft} جلسات متبقية
                          </span>
                        </div>

                        {/* Sessions Bar */}
                        <div className="h-2 bg-[#E1E5DF] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-600 rounded-full"
                            style={{
                              width: `${Math.round(((ptSub?.totalSessions - ptSub?.sessionsLeft) / ptSub?.totalSessions) * 100)}%`,
                            }}
                          />
                        </div>
                      </>
                    );
                  })()}
                </section>
              )}

              {/* Today's Next Group Class */}
              <section className="bg-white border border-[#E1E5DF] rounded-2xl p-4 shadow-subtle space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-[#14181F]">
                    <CalendarDays className="h-4 w-4 text-[#C6F24E] fill-[#14181F]" />
                    <span>حصص اللياقة اليومية (Today):</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("classes")}
                    className="text-[11px] text-[#5B6470] hover:text-[#14181F] font-bold"
                  >
                    عرض الجدول
                  </button>
                </div>

                {todayClasses.length > 0 ? (
                  <div className="p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF] flex items-center justify-between">
                    <div>
                      <b className="text-xs text-[#14181F] block">{todayClasses[0].name}</b>
                      <span className="text-[10px] text-[#5B6470]">
                        الوقت: {todayClasses[0].startTime} - {todayClasses[0].endTime}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold bg-[#14181F] text-[#C6F24E] px-2 py-1 rounded-lg">
                      متاحة للحضور
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-[#5B6470] py-1">لا توجد حصص مجدولة لباقي اليوم.</p>
                )}
              </section>
            </div>
          )}

          {/* 2. SUBSCRIPTIONS TAB */}
          {activeTab === "subscriptions" && (
            <div className="space-y-3.5">
              <h2 className="text-lg font-bold text-[#14181F]">سجل اشتراكاتي</h2>

              {subscriptions.map((s) => (
                <div key={s.id} className="bg-white border border-[#E1E5DF] rounded-2xl p-4 shadow-subtle space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <b className="text-[15px] font-bold text-[#14181F] block">{s.plan?.name}</b>
                      <span className="text-[11px] text-[#5B6470]">
                        من {new Date(s.startDate).toLocaleDateString("ar-EG")} إلى{" "}
                        {new Date(s.endDate).toLocaleDateString("ar-EG")}
                      </span>
                    </div>
                    {getStatusBadge(s.status)}
                  </div>

                  {/* Progress info */}
                  <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-[#E1E5DF]">
                    <div className="bg-[#F2F4F1] p-2 rounded-xl">
                      <span className="text-[10px] text-[#5B6470] block">الأيام المتبقية:</span>
                      <b className="text-sm font-mono text-[#14181F]">{s.daysLeft} يوم</b>
                    </div>
                    <div className="bg-[#F2F4F1] p-2 rounded-xl">
                      <span className="text-[10px] text-[#5B6470] block">رصيد التجميد:</span>
                      <b className="text-sm font-mono text-[#14181F]">
                        {s.freezeRemainingDays} يوم ({s.freezeRemainingCount} مرات)
                      </b>
                    </div>
                  </div>

                  {s.totalSessions !== null && (
                    <div className="flex items-center justify-between text-xs bg-emerald-50 text-emerald-900 p-2 rounded-xl">
                      <span>جلسات التدريب:</span>
                      <b>
                        {s.sessionsLeft} متبقية من {s.totalSessions}
                      </b>
                    </div>
                  )}

                  {/* Overdue / Balance */}
                  <div className="flex items-center justify-between text-xs pt-1">
                    <span className="text-[#5B6470]">سعر الاشتراك: {formatMoney(s.price)}</span>
                    {s.remaining > 0 ? (
                      <b className="text-[#B3261E]">متبقي: {formatMoney(s.remaining)}</b>
                    ) : (
                      <b className="text-emerald-700">مدفوع بالكامل ✓</b>
                    )}
                  </div>

                  {/* Quick Freeze trigger */}
                  {s.status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("freeze")}
                      className="w-full mt-1 bg-[#14181F] hover:bg-[#262D38] text-white py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Snowflake className="h-3.5 w-3.5 text-[#C6F24E]" />
                      <span>طلب تجميد هذا الاشتراك</span>
                    </button>
                  )}
                  {s.status === "FROZEN" && (
                    <button
                      type="button"
                      onClick={() => handleUnfreeze(s.id)}
                      disabled={freezeLoading}
                      className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>{freezeLoading ? "جاري الفك..." : "فك التجميد الآن (Unfreeze)"}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* 3. FREEZE TAB */}
          {activeTab === "freeze" && (
            <div className="space-y-3.5">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center font-bold">
                  <Snowflake className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[#14181F]">تجميد الاشتراك (Freeze)</h2>
                  <p className="text-[11px] text-[#5B6470]">وقف الاشتراك مؤقتاً وترحيل تاريخ الانتهاء</p>
                </div>
              </div>

              {primarySub ? (
                <div className="bg-white border border-[#E1E5DF] rounded-2xl p-4 shadow-subtle space-y-4">
                  <div>
                    <b className="text-sm font-bold text-[#14181F] block">{primarySub.plan?.name}</b>
                    <span className="text-[11px] text-[#5B6470]">
                      الرصيد المتاح: {primarySub.freezeRemainingDays} يوم تجميد (متبقي{" "}
                      {primarySub.freezeRemainingCount} مرات)
                    </span>
                  </div>

                  {/* Eligibility check */}
                  {primarySub.status === "FROZEN" ? (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-blue-900 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Snowflake className="h-4 w-4 text-blue-600" />
                        <span>هذا الاشتراك مجمد حالياً!</span>
                      </div>
                      <p className="text-[11px] opacity-80 leading-relaxed">
                        يمكنك فك التجميد واستئناف الاشتراك في أي وقت. وسيتم ترحيل تاريخ نهاية الاشتراك بقدر الأيام
                        المجمدة.
                      </p>
                      <button
                        type="button"
                        onClick={() => handleUnfreeze(primarySub.id)}
                        disabled={freezeLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-xl font-bold text-xs cursor-pointer"
                      >
                        {freezeLoading ? "جاري فك التجميد..." : "فك التجميد واستئناف الاشتراك الآن"}
                      </button>
                    </div>
                  ) : primarySub.remaining > 0 ? (
                    <div className="p-3 bg-[#FDE7E4] border border-red-200 rounded-xl text-[#B3261E] text-xs space-y-1">
                      <b className="block">غير متاح للتجميد (يوجد قسط متأخر)</b>
                      <p className="text-[11px] opacity-80">
                        لا يمكن تقديم طلب تجميد لوجود مديونية مستحقة قدرها {formatMoney(primarySub.remaining)}.
                        يرجى السداد أولاً في الاستقبال.
                      </p>
                    </div>
                  ) : primarySub.freezeRemainingDays <= 0 || primarySub.freezeRemainingCount <= 0 ? (
                    <div className="p-3 bg-[#FFF1D6] border border-amber-200 rounded-xl text-[#8A5A00] text-xs">
                      <b>استنفذت الحد الأقصى لأيام التجميد في خطتك.</b>
                    </div>
                  ) : (
                    /* Freeze Form */
                    <div className="space-y-3 pt-2 border-t border-[#E1E5DF]">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[#14181F] block">
                          اختر عدد أيام التجميد:
                        </label>
                        <div className="flex items-center gap-2">
                          {[3, 7, 14, 21]
                            .filter((d) => d <= primarySub.freezeRemainingDays)
                            .map((days) => (
                              <button
                                key={days}
                                type="button"
                                onClick={() => setFreezeDays(days)}
                                className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                                  freezeDays === days
                                    ? "bg-[#14181F] text-[#C6F24E] border-[#14181F]"
                                    : "bg-[#F2F4F1] text-[#14181F] border-[#E1E5DF] hover:bg-white"
                                }`}
                              >
                                {days} أيام
                              </button>
                            ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-bold text-[#5B6470] block">سبب التجميد:</label>
                        <select
                          value={freezeReason}
                          onChange={(e) => setFreezeReason(e.target.value)}
                          className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl p-2.5 text-xs text-[#14181F] focus:outline-none"
                        >
                          <option value="ظروف سفر">ظروف سفر</option>
                          <option value="وعكة صحية أو إصابة">وعكة صحية أو إصابة</option>
                          <option value="امتحانات أو دراسة">امتحانات أو دراسة</option>
                          <option value="ظروف عمل">ظروف عمل</option>
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleFreeze(primarySub.id)}
                        disabled={freezeLoading}
                        className="w-full bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] py-3 rounded-xl font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 disabled:opacity-50"
                      >
                        <Snowflake className="h-4 w-4" />
                        <span>{freezeLoading ? "جاري المعالجة..." : `تأكيد تجميد الاشتراك لـ ${freezeDays} أيام`}</span>
                      </button>
                    </div>
                  )}

                  {/* Past Freezes History */}
                  {primarySub.freezes && primarySub.freezes.length > 0 && (
                    <div className="pt-3 border-t border-[#E1E5DF] space-y-2">
                      <b className="text-xs font-bold text-[#14181F] block">سجل التجميدات السابقة:</b>
                      <div className="space-y-1.5">
                        {primarySub.freezes.map((f: any) => (
                          <div
                            key={f.id}
                            className="p-2 rounded-xl bg-[#F2F4F1] text-[11px] flex items-center justify-between"
                          >
                            <div>
                              <span className="font-bold text-[#14181F] block">
                                {f.reason || "تجميد اشتراك"}
                              </span>
                              <span className="text-[10px] text-[#5B6470]">
                                من {new Date(f.startedAt).toLocaleDateString("ar-EG")}
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700">
                              {f.endedAt ? "مكتمل" : "نشط حالياً"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-[#E1E5DF] rounded-2xl p-6 text-center text-sm text-[#5B6470]">
                  لا يوجد اشتراك نشط يمكن تجميده حالياً.
                </div>
              )}
            </div>
          )}

          {/* 4. WALLET TAB */}
          {activeTab === "wallet" && (
            <div className="space-y-3.5">
              <h2 className="text-lg font-bold text-[#14181F]">محفظتي وسجل المعاملات</h2>

              {/* Wallet Hero Card */}
              <div className="bg-[#14181F] text-white rounded-3xl p-5 shadow-lg space-y-3">
                <div className="flex items-center justify-between text-xs text-[#C9CFD6]">
                  <span>رصيد المحفظة المتاح (E-Wallet)</span>
                  <Wallet className="h-4 w-4 text-[#C6F24E]" />
                </div>
                <div className="text-[32px] font-mono font-black text-[#C6F24E] leading-none">
                  {formatMoney(wallet.balance)}
                </div>
                <p className="text-[11px] text-[#C9CFD6]">
                  يمكنك استخدام رصيد المحفظة لشراء منتجات البار وتجديد الاشتراكات مباشرة.
                </p>
              </div>

              {/* Transactions Ledger */}
              <div className="bg-white border border-[#E1E5DF] rounded-2xl p-4 shadow-subtle space-y-3">
                <b className="text-xs font-bold text-[#14181F] block">سجل الحركات المالية:</b>
                {wallet.transactions && wallet.transactions.length > 0 ? (
                  <div className="space-y-2">
                    {wallet.transactions.map((tx: any) => (
                      <div
                        key={tx.id}
                        className="p-2.5 rounded-xl bg-[#F2F4F1] flex items-center justify-between text-xs"
                      >
                        <div>
                          <b className="text-[#14181F] block">{tx.description || tx.type}</b>
                          <span className="text-[10px] text-[#5B6470]">
                            {new Date(tx.createdAt).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-emerald-800">
                          +{formatMoney(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#5B6470] py-2 text-center">
                    لا توجد حركات مالية مسجلة حتى الآن.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* 5. CLASSES TAB */}
          {activeTab === "classes" && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-[#14181F]">جدول الحصص الأسبوعي</h2>
                  <p className="text-[11px] text-[#5B6470]">مواعيد حصص اللياقة الجماعية بالصالة</p>
                </div>
                <Calendar className="h-5 w-5 text-[#14181F]" />
              </div>

              {/* Class Schedules List */}
              <div className="space-y-2.5">
                {classSchedules.map((cs) => {
                  const daysAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
                  return (
                    <div
                      key={cs.id}
                      className="bg-white border border-[#E1E5DF] rounded-2xl p-3.5 shadow-subtle flex items-center justify-between"
                    >
                      <div className="space-y-0.5">
                        <b className="text-xs font-bold text-[#14181F] block">{cs.name}</b>
                        <div className="text-[11px] text-[#5B6470] flex items-center gap-2">
                          <span className="font-bold text-emerald-700">{daysAr[cs.dayOfWeek] || "يومياً"}</span>
                          <span>·</span>
                          <span className="font-mono">
                            {cs.startTime} - {cs.endTime}
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold bg-[#E3F5EA] text-[#1B7F4B] px-2 py-1 rounded-lg">
                        سعة {cs.capacity || 20} متدرب
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Fixed Navigation Bar (Phone-first Mobile Nav) */}
        <nav className="absolute bottom-0 left-0 right-0 bg-[#14181F] text-white p-2 px-3 flex items-center justify-around rounded-t-3xl border-t border-white/10 shadow-2xl z-20">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === "home" ? "bg-[#262D38] text-[#C6F24E]" : "text-[#C9CFD6] hover:text-white"
            }`}
          >
            <QrCode className="h-4 w-4" />
            <span>كود الدخول</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("subscriptions")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === "subscriptions" ? "bg-[#262D38] text-[#C6F24E]" : "text-[#C9CFD6] hover:text-white"
            }`}
          >
            <Dumbbell className="h-4 w-4" />
            <span>اشتراكاتي</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("freeze")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === "freeze" ? "bg-[#262D38] text-[#C6F24E]" : "text-[#C9CFD6] hover:text-white"
            }`}
          >
            <Snowflake className="h-4 w-4" />
            <span>التجميد</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("wallet")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === "wallet" ? "bg-[#262D38] text-[#C6F24E]" : "text-[#C9CFD6] hover:text-white"
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>المحفظة</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("classes")}
            className={`flex flex-col items-center gap-1 py-1.5 px-3 rounded-2xl text-[11px] font-bold transition-all cursor-pointer ${
              activeTab === "classes" ? "bg-[#262D38] text-[#C6F24E]" : "text-[#C9CFD6] hover:text-white"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>الحصص</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
