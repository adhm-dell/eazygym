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
  Plus,
} from "lucide-react";
import { clearStoredAuth, getStoredUser } from "../../lib/api";
import { fetchMyCommission, type CoachCommissionData } from "../../features/commission/api";
import { traineesApi, type Trainee } from "../../features/trainees/api";
import { classesApi } from "../../features/classes/api";
import { breaksApi, type CoachBreak } from "../../features/breaks/api";
import { assignmentsApi, type FitnessAssignment } from "../../features/assignments/api";
import { shiftsApi, type CoachShift } from "../../features/shifts/api";
import { sessionsApi, type CoachSession } from "../../features/sessions/api";
import { assessmentsApi, type FitnessAssessment } from "../../features/assessments/api";
import { WeeklyShiftsCard } from "../../features/shifts/components/weekly-shifts-card";
import { SessionAttendanceDialog } from "../../features/sessions/components/session-attendance-dialog";
import { InBodyTrendChart } from "../../features/assessments/components/inbody-trend-chart";
import { AddAssessmentDialog } from "../../features/assessments/components/add-assessment-dialog";
import { RejectAssignmentDialog } from "../../features/assignments/components/reject-assignment-dialog";

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

  // Trainee InBody Assessments
  const [traineeAssessments, setTraineeAssessments] = useState<FitnessAssessment[]>([]);
  const [isAddAssessmentOpen, setIsAddAssessmentOpen] = useState(false);

  // Live Classes & Coach Sessions
  const [classes, setClasses] = useState<any[]>([]);
  const [sessions, setSessions] = useState<CoachSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<CoachSession | null>(null);
  const [isAttendanceOpen, setIsAttendanceOpen] = useState(false);

  // Live Shifts
  const [shifts, setShifts] = useState<CoachShift[]>([]);
  const [shiftsLoading, setShiftsLoading] = useState(false);

  // Live Breaks
  const [breaks, setBreaks] = useState<CoachBreak[]>([]);
  const [activeBreak, setActiveBreak] = useState<CoachBreak | null>(null);
  const [breakTimer, setBreakTimer] = useState<number>(0);
  const [breakReasonInput, setBreakReasonInput] = useState<string>("استراحة صلاة وغداء");

  // Live Assignments (Fitness Profile)
  const [assignments, setAssignments] = useState<FitnessAssignment[]>([]);
  const [pastAssignments, setPastAssignments] = useState<FitnessAssignment[]>([]);
  const [rejectingAssignment, setRejectingAssignment] = useState<FitnessAssignment | null>(null);
  const [isAcceptingId, setIsAcceptingId] = useState<string | null>(null);
  const [showPastAssignments, setShowPastAssignments] = useState(false);

  // Action status message
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const showFeedback = (msg: string, isError = false) => {
    if (isError) {
      setActionError(msg);
      setTimeout(() => setActionError(null), 4500);
    } else {
      setActionSuccess(msg);
      setTimeout(() => setActionSuccess(null), 4000);
    }
  };

  const storedUser = typeof window !== "undefined" ? getStoredUser() : null;
  const currentCoachId = storedUser?.id || commData?.coach?.id || "staff_coach";

  // Load live data
  const loadInitialData = async () => {
    try {
      const [comm, trList, clsList, brkRes, assList, allAssList, sessList, shfList] = await Promise.all([
        fetchMyCommission(commYear, commMonth).catch(() => null),
        traineesApi.getMyTrainees().catch(() => []),
        classesApi.getTodayClasses().catch(() => []),
        breaksApi.getBreaks().catch(() => ({ breaks: [], activeBreak: null })),
        assignmentsApi.getAssignments("PENDING").catch(() => []),
        assignmentsApi.getAllAssignments().catch(() => []),
        sessionsApi.getMySessions().catch(() => []),
        shiftsApi.getMyShifts().catch(() => []),
      ]);

      if (comm) setCommData(comm);
      if (trList && trList.length > 0) setTrainees(trList);
      if (clsList) setClasses(clsList);
      if (brkRes) {
        setBreaks(brkRes.breaks || []);
        setActiveBreak(brkRes.activeBreak || null);
      }
      if (assList) setAssignments(assList);
      if (allAssList) {
        setPastAssignments(allAssList.filter((a) => a.status !== "PENDING"));
      }
      if (sessList) setSessions(sessList);
      if (shfList) setShifts(shfList);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadInitialData();
    const interval = setInterval(loadInitialData, 20000); // 20s live update
    return () => clearInterval(interval);
  }, [commYear, commMonth]);

  // Load trainee assessments when selecting trainee
  const handleSelectTrainee = async (t: Trainee) => {
    if (selectedTrainee?.id === t.id) {
      setSelectedTrainee(null);
      setTraineeAssessments([]);
      return;
    }
    setSelectedTrainee(t);
    try {
      const items = await assessmentsApi.getAssessments(t.memberId);
      setTraineeAssessments(items || []);
    } catch {
      setTraineeAssessments([]);
    }
  };

  const refreshTraineeAssessments = async () => {
    if (!selectedTrainee) return;
    try {
      const items = await assessmentsApi.getAssessments(selectedTrainee.memberId);
      setTraineeAssessments(items || []);
      showFeedback("تم تحديث سجل القياسات البدنية بنجاح");
    } catch (err: any) {
      showFeedback(err.message || "فشل جلب القياسات", true);
    }
  };

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
      const res = await breaksApi.requestBreak(currentCoachId, breakReasonInput);
      setActiveBreak(res);
      showFeedback("تم إرسال طلب الاستراحة إلى الإدارة بنجاح وفي انتظار الاعتماد");
      await loadInitialData();
    } catch (err: any) {
      const msg = err.response?.message || err.message || "تعذر طلب الاستراحة";
      let translated = msg;
      if (msg.includes("ANOTHER_COACH_ON_BREAK")) translated = "يوجد مدرب آخر في استراحة حالياً، لا يسمح بخروج أكثر من مدرب في نفس الوقت";
      else if (msg.includes("NOT_ON_SHIFT")) translated = "أنت لست في مناوبة عمل نشطة الآن حسب جدول الورديات";
      else if (msg.includes("DAILY_LIMIT_REACHED")) translated = "تم استهلاك الحد الأقصى للاستراحات اليومية المسموح بها";
      else if (msg.includes("COACH_ALREADY_ON_BREAK")) translated = "لديك استراحة جارية بالفعل";
      showFeedback(translated, true);
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
    setIsAcceptingId(id);
    try {
      await assignmentsApi.acceptAssignment(id);
      showFeedback("تم قبول المتدرب الجديد بنجاح وإضافته إلى قائمتك ومنح حصة التوجيه المجانية");
      await loadInitialData();
    } catch (err: any) {
      showFeedback(err.message || "تعذر قبول المتدرب", true);
    } finally {
      setIsAcceptingId(null);
    }
  };

  const handleQuickCreateAndAttendPTSession = async (trainee: Trainee) => {
    try {
      const now = new Date();
      const end = new Date(now.getTime() + 60 * 60 * 1000);
      // Create session
      const session = await sessionsApi.createSession({
        coachId: currentCoachId,
        type: "PRIVATE",
        startTime: now.toISOString(),
        endTime: end.toISOString(),
        notes: `جلسة خاصة للمتدرب: ${trainee.member?.name || "متدرب"}`,
      });

      // Add participant
      await sessionsApi.addParticipant(session.id, {
        memberId: trainee.memberId,
        source: trainee.subscription ? "PT_LINKED" : "FREE_GRANT",
        subscriptionId: trainee.subscription?.id || null,
      });

      // Open attendance modal for confirmation
      setSelectedSession({
        ...session,
        participants: [
          {
            id: `p-${Date.now()}`,
            sessionId: session.id,
            memberId: trainee.memberId,
            source: trainee.subscription ? "PT_LINKED" : "FREE_GRANT",
            subscriptionId: trainee.subscription?.id || null,
            attended: true,
            member: trainee.member,
          },
        ],
      });
      setIsAttendanceOpen(true);
    } catch (err: any) {
      showFeedback(err.message || "فشل تجهيز الجلسة", true);
    }
  };

  const coachName = commData?.coach?.name || storedUser?.name || "كابتن أحمد";
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
      <div className="w-full max-w-[440px] min-h-screen sm:min-h-[860px] bg-[#F2F4F1] flex flex-col justify-between sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-[#14181F] overflow-hidden">
        {/* Mobile Header & Body */}
        <div className="flex-1 p-4 flex flex-col gap-3.5 overflow-y-auto">
          {/* Top greeting */}
          <header className="pt-1 flex items-center justify-between">
            <div>
              <p className="text-[12px] text-[#5B6470] font-medium">بوابة المدرب · PowerCore</p>
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
                title="تسجيل الخروج"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </header>

          {/* Feedback Toasts */}
          {actionSuccess && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{actionSuccess}</span>
            </div>
          )}

          {actionError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
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
                          : "طلب الاستراحة معلق لدى الإدارة..."}
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

              {/* Member Assignments Inbox (Always visible) */}
              <section className="bg-white border-2 border-[#C6F24E] rounded-[18px] p-4 space-y-3 shadow-sm text-start">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#14181F] flex items-center gap-1.5">
                    <Flame className="h-4 w-4 text-amber-500" />
                    <span>متدربين جدد بحاجة لموافقتك ({assignments.length})</span>
                  </span>
                  {assignments.length > 0 ? (
                    <Badge variant="lime">جديد</Badge>
                  ) : (
                    <span className="text-[10px] text-[#5B6470] font-medium">محدث تلقائياً</span>
                  )}
                </div>

                {assignments.length === 0 ? (
                  <div className="p-4 text-center text-[#5B6470] bg-[#F8FAF6] rounded-xl border border-dashed border-[#E1E5DF]">
                    <p className="text-xs font-medium">لا توجد طلبات جديدة حالياً</p>
                    <span className="text-[10px] text-[#5B6470] mt-0.5 block">
                      سيصلك تنبيه فوري عند قيام الاستقبال ببيع اشتراك وتدوير المتدرب إلى دورك
                    </span>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {assignments.map((ass) => (
                      <div
                        key={ass.id}
                        className="p-3 rounded-xl bg-[#F8FAF6] border border-[#E1E5DF] space-y-2 text-xs"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-sm text-[#14181F]">
                              {ass.member?.name || "عضو جديد"}
                            </p>
                            <p className="text-[11px] text-[#5B6470]">
                              {ass.member?.phone ? `${ass.member.phone} · ` : ""}
                              الباقة:{" "}
                              <span className="font-bold text-[#14181F]">
                                {ass.planName || "اشتراك جديد"}
                              </span>
                            </p>
                          </div>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 shrink-0">
                            في انتظارك
                          </span>
                        </div>

                        {/* Goals / Injuries / Medical notes if present */}
                        {(ass.goals || ass.medicalConditions || ass.injuries || ass.notes) && (
                          <div className="p-2 bg-white rounded-lg border border-[#E1E5DF] text-[11px] space-y-1">
                            {ass.goals && (
                              <p className="text-[#14181F]">
                                <strong className="text-[#5B6470]">الهدف:</strong> {ass.goals}
                              </p>
                            )}
                            {ass.medicalConditions && (
                              <p className="text-amber-800">
                                <strong>حالة صحية:</strong> {ass.medicalConditions}
                              </p>
                            )}
                            {ass.injuries && (
                              <p className="text-red-700">
                                <strong>إصابات:</strong> {ass.injuries}
                              </p>
                            )}
                            {ass.notes && (
                              <p className="text-[#5B6470]">
                                <strong>ملاحظات:</strong> {ass.notes}
                              </p>
                            )}
                          </div>
                        )}

                        {/* Free sessions info + actions */}
                        <div className="flex items-center justify-between pt-1 border-t border-[#E1E5DF]/60">
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded">
                            🎁 سيحصل على {ass.freeSessionsCount || 1} جلسة مجانية عند القبول
                          </span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isAcceptingId === ass.id}
                              onClick={() => handleAcceptAssignment(ass.id)}
                              className="px-3 py-1 bg-[#14181F] text-[#C6F24E] rounded-lg font-bold text-xs hover:bg-black disabled:opacity-50 cursor-pointer"
                            >
                              {isAcceptingId === ass.id ? "جاري..." : "قبول"}
                            </button>
                            <button
                              type="button"
                              disabled={isAcceptingId === ass.id}
                              onClick={() => setRejectingAssignment(ass)}
                              className="px-2.5 py-1 bg-white text-[#B3261E] border border-[#E1E5DF] rounded-lg text-xs font-semibold hover:bg-red-50 disabled:opacity-50 cursor-pointer"
                            >
                              اعتذار
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Past Requests History Accordion / Section */}
                {pastAssignments.length > 0 && (
                  <div className="pt-2 border-t border-[#E1E5DF]">
                    <button
                      type="button"
                      onClick={() => setShowPastAssignments(!showPastAssignments)}
                      className="text-[11px] text-[#5B6470] font-bold flex items-center justify-between w-full hover:text-[#14181F] cursor-pointer"
                    >
                      <span>سجل طلبات التدريب السابقة ({pastAssignments.length})</span>
                      <span>{showPastAssignments ? "إخفاء ▲" : "عرض ▼"}</span>
                    </button>

                    {showPastAssignments && (
                      <div className="mt-2 space-y-1.5">
                        {pastAssignments.map((pa) => (
                          <div
                            key={pa.id}
                            className="p-2 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-[11px]"
                          >
                            <div>
                              <span className="font-bold text-[#14181F]">
                                {pa.member?.name || "عضو"}
                              </span>
                              <span className="text-gray-500 text-[10px] block">
                                {pa.planName} ·{" "}
                                {new Date(pa.createdAt).toLocaleDateString("ar-EG")}
                              </span>
                              {pa.rejectionReason && (
                                <span className="text-[10px] text-red-600 block">
                                  سبب الاعتذار: {pa.rejectionReason}
                                </span>
                              )}
                            </div>
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                pa.status === "ACCEPTED"
                                  ? "bg-emerald-100 text-emerald-800"
                                  : pa.status === "REJECTED"
                                  ? "bg-red-100 text-red-800"
                                  : "bg-gray-200 text-gray-700 line-through"
                              }`}
                            >
                              {pa.status === "ACCEPTED"
                                ? "مقبول"
                                : pa.status === "REJECTED"
                                ? "معتذر عنه"
                                : "مستبدل"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </section>

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

              {/* Today's Private Sessions Quick Attendance */}
              <section className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold text-[#14181F] flex items-center gap-1">
                    <Dumbbell className="w-4 h-4 text-[#14181F]" />
                    <span>جلسات التدريب الخاص (PT)</span>
                  </h3>
                  <span className="text-[11px] text-[#5B6470]">{trainees.length} متدرب</span>
                </div>
                <div className="space-y-1.5">
                  {trainees.slice(0, 3).map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-2 rounded-xl bg-[#F2F4F1] text-xs">
                      <div>
                        <p className="font-bold text-[#14181F]">{t.member?.name || "متدرب"}</p>
                        <p className="text-[10px] text-[#5B6470]">
                          باقي {t.subscription?.sessionsRemaining ?? 6} جلسات
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleQuickCreateAndAttendPTSession(t)}
                        className="px-2.5 py-1 bg-[#C6F24E] text-[#14181F] rounded-lg font-bold text-[11px] hover:bg-[#b5e03e] cursor-pointer"
                      >
                        تسجيل حضور
                      </button>
                    </div>
                  ))}
                </div>
              </section>

              {/* Weekly Shifts Overview */}
              <WeeklyShiftsCard shifts={shifts} isLoading={shiftsLoading} />

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

          {/* ==================== TAB 2: TRAINEES & ASSESSMENTS ==================== */}
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
                    trainees.map((t) => {
                      const isExpanded = selectedTrainee?.id === t.id;
                      return (
                        <div
                          key={t.id}
                          className={`p-3 rounded-xl border transition-all ${
                            isExpanded
                              ? "bg-white border-[#14181F] shadow-sm"
                              : "bg-[#F2F4F1] border-[#E1E5DF] hover:bg-[#EAEAEA]"
                          }`}
                        >
                          <div
                            onClick={() => handleSelectTrainee(t)}
                            className="flex items-center justify-between cursor-pointer"
                          >
                            <div>
                              <p className="text-xs font-bold text-[#14181F]">{t.member?.name || "متدرب"}</p>
                              <p className="text-[11px] text-[#5B6470]">كود: {t.member?.code || "-"} · هاتف: {t.member?.phone || "-"}</p>
                            </div>
                            <Badge variant={isExpanded ? "lime" : "g"}>
                              {t.subscription?.sessionsRemaining ?? 6} جلسات
                            </Badge>
                          </div>

                          {/* Expanded details with InBody Trend Chart */}
                          {isExpanded && (
                            <div className="mt-3 pt-3 border-t border-[#E1E5DF] text-xs space-y-3">
                              <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#F2F4F1] p-2.5 rounded-xl">
                                <div>
                                  <span className="text-[#5B6470] block">الباقة:</span>
                                  <span className="font-bold">{t.subscription?.planName || "PT 12 جلسة"}</span>
                                </div>
                                <div>
                                  <span className="text-[#5B6470] block">الأيام المتبقية:</span>
                                  <span className="font-bold">{t.subscription?.daysRemaining ?? 21} يوم</span>
                                </div>
                              </div>

                              {/* InBody Trend & Metrics */}
                              <InBodyTrendChart
                                assessments={traineeAssessments}
                                onOpenAddModal={() => setIsAddAssessmentOpen(true)}
                              />

                              <button
                                type="button"
                                onClick={() => handleQuickCreateAndAttendPTSession(t)}
                                className="w-full py-2 bg-[#14181F] text-[#C6F24E] font-bold rounded-lg hover:bg-black transition-colors"
                              >
                                بدء جلسة وتسجيل حضور
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== TAB 3: CLASSES & SESSIONS ==================== */}
          {activeTab === "classes" && (
            <div className="space-y-3">
              {/* Scheduled Coach Sessions (Attendance Screen) */}
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#14181F] flex items-center gap-1.5">
                    <Dumbbell className="w-4 h-4 text-[#14181F]" />
                    <span>جلسات اليوم وسجل الحضور (Sessions Attendance)</span>
                  </h3>
                  <Badge variant="lime">{sessions.length} جلسة</Badge>
                </div>

                <div className="space-y-2">
                  {sessions.length === 0 ? (
                    <div className="text-center py-6 text-xs text-[#5B6470] bg-[#F2F4F1] rounded-xl">
                      لا توجد جلسات مجدولة مسجلة لك اليوم. يمكنك بدء جلسة وتسجيل الحضور مباشرة من قائمة المتدربين.
                    </div>
                  ) : (
                    sessions.map((s) => (
                      <div
                        key={s.id}
                        className="p-3 bg-[#F9FAF8] rounded-xl border border-[#E1E5DF] flex items-center justify-between text-xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#14181F]">
                              {s.type === "PRIVATE" ? "جلسة خاصة (PT)" : "حصة تدريب جماعي"}
                            </span>
                            <Badge
                              variant={
                                s.status === "COMPLETED"
                                  ? "g"
                                  : s.status === "NO_SHOW"
                                  ? "w"
                                  : s.status === "CANCELLED"
                                  ? "r"
                                  : "default"
                              }
                            >
                              {s.status === "SCHEDULED" ? "مجدولة" : s.status === "COMPLETED" ? "مكتملة" : s.status === "NO_SHOW" ? "غياب (No-Show)" : "ملغية"}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-[#5B6470] mt-1 font-mono">
                            {new Date(s.startTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                            {" - "}
                            {new Date(s.endTime).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                            {" · "}
                            {s.participants.length} مشتركين
                          </p>
                        </div>

                        {s.status === "SCHEDULED" && (
                          <Button
                            variant="lime"
                            size="sm"
                            onClick={() => {
                              setSelectedSession(s);
                              setIsAttendanceOpen(true);
                            }}
                            className="font-bold text-xs"
                          >
                            تسجيل الحضور
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Group Fitness Classes */}
              <div className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5">
                <h3 className="text-xs font-bold text-[#14181F] mb-3 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#5B6470]" />
                  <span>حصص اللياقة البدنية الجماعية</span>
                </h3>
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
                      <span>الحالة: {activeBreak.status === "ACTIVE" ? "في استراحة حالياً" : "طلب الاستراحة معلق"}</span>
                      {activeBreak.status === "ACTIVE" && (
                        <span className="font-mono text-sm">{formatTime(breakTimer)}</span>
                      )}
                    </div>
                    {activeBreak.status === "ACTIVE" && (
                      <Button onClick={handleEndBreak} variant="default" className="w-full font-bold">
                        إنهاء الاستراحة والعودة للعمل
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div>
                      <label className="text-[11px] text-[#5B6470] block mb-1">سبب الاستراحة</label>
                      <input
                        type="text"
                        value={breakReasonInput}
                        onChange={(e) => setBreakReasonInput(e.target.value)}
                        placeholder="سبب الاستراحة..."
                        className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-xs focus:outline-none focus:border-[#14181F]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleRequestBreak}
                      className="w-full bg-[#14181F] text-[#C6F24E] font-bold text-xs p-3 rounded-xl hover:bg-black transition-colors cursor-pointer"
                    >
                      طلب استراحة (20 دقيقة)
                    </button>
                  </div>
                )}

                <div className="text-[11px] text-[#5B6470] leading-relaxed bg-[#F2F4F1] p-2.5 rounded-xl">
                  <b>قواعد الاستراحة:</b> حد أقصى 2 استراحة يومياً، مدة الاستراحة 20 دقيقة، ولا يمكن خروج مدربين في نفس الوقت.
                </div>
              </div>

              {/* Dynamic Weekly Shifts Card */}
              <WeeklyShiftsCard shifts={shifts} isLoading={shiftsLoading} />
            </div>
          )}

          {/* ==================== TAB 5: COMMISSION ==================== */}
          {activeTab === "commission" && (
            <div className="space-y-3">
              <section className="bg-white border border-[#E1E5DF] rounded-[16px] p-3.5 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-[#14181F]">حسابات العمولة والتارجت</h3>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setCommMonth((m) => (m === 1 ? 12 : m - 1))}
                      className="p-1 hover:bg-[#F2F4F1] rounded cursor-pointer"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                    <span className="text-xs font-bold px-2">شهر {commMonth}</span>
                    <button
                      type="button"
                      onClick={() => setCommMonth((m) => (m === 12 ? 1 : m + 1))}
                      className="p-1 hover:bg-[#F2F4F1] rounded cursor-pointer"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="p-3 bg-[#F2F4F1] rounded-xl">
                    <span className="text-[11px] text-[#5B6470] block">الراتب الأساسي</span>
                    <b className="text-sm font-bold text-[#14181F]">{baseSalary.toLocaleString()} ج.م</b>
                  </div>
                  <div className="p-3 bg-[#C6F24E]/20 border border-[#C6F24E] rounded-xl">
                    <span className="text-[11px] text-[#5B6470] block">إجمالي الدخل المتوقع</span>
                    <b className="text-sm font-bold text-[#14181F]">{(baseSalary + commissionAmount).toLocaleString()} ج.م</b>
                  </div>
                </div>
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
            <span>الجلسات</span>
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

      {/* Session Attendance Dialog */}
      <SessionAttendanceDialog
        isOpen={isAttendanceOpen}
        onClose={() => {
          setIsAttendanceOpen(false);
          setSelectedSession(null);
        }}
        session={selectedSession}
        onSuccess={(msg) => {
          showFeedback(msg);
          loadInitialData();
        }}
      />

      {/* Add Assessment Dialog */}
      {selectedTrainee && (
        <AddAssessmentDialog
          isOpen={isAddAssessmentOpen}
          onClose={() => setIsAddAssessmentOpen(false)}
          memberId={selectedTrainee.memberId}
          memberName={selectedTrainee.member?.name || "المتدرب"}
          onSuccess={refreshTraineeAssessments}
        />
      )}

      {/* Reject Assignment Modal */}
      <RejectAssignmentDialog
        isOpen={!!rejectingAssignment}
        onClose={() => setRejectingAssignment(null)}
        assignment={rejectingAssignment}
        onSuccess={(msg) => {
          showFeedback(msg);
          loadInitialData();
        }}
      />
    </div>
  );
}
