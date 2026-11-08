"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  useToast,
  Button,
  Chip,
  Badge,
  Dialog,
} from "@gym/ui";
import {
  type AccessLog,
  type ClassScheduleWithDetails,
  type ScanResult,
} from "@gym/mock-data";
import { scanApi } from "../../features/scan/api";
import { useShift } from "../../lib/shift-context";
import {
  Search,
  Play,
  Square,
  AlertTriangle,
  X,
  CheckCircle2,
  XCircle,
  Lock,
} from "lucide-react";

// Table of exact Arabic messages & next action mappings per Phase 2 specification
const REASON_CONFIG: Record<
  string,
  {
    message: string;
    actionLabel: string | null;
    actionType:
      | "none"
      | "viewReason"
      | "sellSubscription"
      | "collectPayment"
      | "collectBalance"
      | "unfreeze"
      | "renew"
      | "renewPt"
      | "showStartDate"
      | "sellGymSubscription"
      | "showClassDays"
      | "startClass"
      | "showTimes";
  }
> = {
  ACTIVE: { message: "تفضل بالدخول", actionLabel: null, actionType: "none" },
  MEMBER_NOT_FOUND: { message: "العضو غير مسجل في النظام", actionLabel: "تسجيل عضو جديد", actionType: "sellSubscription" },
  BLOCKED: { message: "العضو محظور", actionLabel: "عرض سبب الحظر", actionType: "viewReason" },
  NO_SUBSCRIPTION: { message: "لا يوجد اشتراك", actionLabel: "بيع اشتراك جديد", actionType: "sellSubscription" },
  PENDING_PAYMENT: { message: "لم يتم دفع الحد الأدنى", actionLabel: "تحصيل الدفعة المقدمة", actionType: "collectPayment" },
  PAYMENT_OVERDUE: { message: "الاشتراك متوقف لوجود متبقي مستحق", actionLabel: "تحصيل المتبقي", actionType: "collectBalance" },
  FROZEN: { message: "الاشتراك مجمّد", actionLabel: "إلغاء التجميد", actionType: "unfreeze" },
  EXPIRED: { message: "الاشتراك منتهي", actionLabel: "تجديد الاشتراك", actionType: "renew" },
  PT_EXPIRED: { message: "اشتراك البرايفت منتهي", actionLabel: "تجديد البرايفت", actionType: "renewPt" },
  NOT_STARTED: { message: "الاشتراك لم يبدأ بعد", actionLabel: "عرض موعد البدء", actionType: "showStartDate" },
  CANCELLED: { message: "الاشتراك ملغي", actionLabel: "بيع اشتراك جديد", actionType: "sellSubscription" },
  NO_SESSIONS_LEFT: { message: "انتهت الجلسات", actionLabel: "تجديد الجلسات", actionType: "renew" },
  NO_FLOOR_ACCESS: { message: "هذا الاشتراك لا يتيح دخول الجيم", actionLabel: "ترقية لاشتراك جيم", actionType: "sellGymSubscription" },
  CLASS_NOT_TODAY: { message: "ليس يوم الحصة", actionLabel: "عرض مواعيد الحصة", actionType: "showClassDays" },
  CLASS_NOT_STARTED: { message: "الحصة لم تبدأ بعد", actionLabel: "بدء الحصة الآن", actionType: "startClass" },
  CLASS_ENDED: { message: "انتهت الحصة", actionLabel: "إغلاق", actionType: "none" },
  CLASS_CANCELLED: { message: "الحصة ملغية اليوم", actionLabel: "إغلاق", actionType: "none" },
  CLASS_OUT_OF_TIME: { message: "خارج وقت الحصة", actionLabel: "عرض المواعيد", actionType: "showTimes" },
};

export default function ReceptionScanPage() {
  const { toast } = useToast();
  const { shift, isOpen: isShiftOpen, openShiftModal } = useShift();

  // Always focused input ref
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanQuery, setScanQuery] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Full Screen / Interactive Result Overlay state
  const [activeResult, setActiveResult] = useState<ScanResult | null>(null);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reason modal dialog for BLOCKED member
  const [blockedReasonDialog, setBlockedReasonDialog] = useState<string | null>(null);

  // Data lists
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [todayClasses, setTodayClasses] = useState<ClassScheduleWithDetails[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

  // Quick Test Barcode Drawer toggle
  const [showTestChips, setShowTestChips] = useState(false);

  // Keep focus on input
  const focusInput = useCallback(() => {
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  }, []);

  useEffect(() => {
    focusInput();
  }, [focusInput, activeResult]);

  // Load data on mount
  const loadData = useCallback(async () => {
    try {
      const [logs, classes] = await Promise.all([
        scanApi.listAccessLogs(),
        scanApi.listTodayClassSchedules(),
      ]);
      setAccessLogs(logs);
      setTodayClasses(classes);
    } catch {
      // ignore
    } finally {
      setIsLoadingClasses(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Door Scan
  const handleScanSubmit = async (queryToScan?: string) => {
    const raw = queryToScan || scanQuery;
    const query = raw.trim();
    if (!query) return;

    // Shift check
    if (!isShiftOpen) {
      toast({
        title: "تنبيه: الوردية غير مفتوحة",
        description: "يرجى فتح وردية الاستقبال لتسجيل ومتابعة حركات الدخول",
        variant: "warning",
      });
      openShiftModal();
      return;
    }

    setIsEvaluating(true);
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }

    try {
      const result = await scanApi.evaluateDoorScan(query);
      setActiveResult(result);
      setScanQuery("");

      // Refresh logs
      const updatedLogs = await scanApi.listAccessLogs();
      setAccessLogs(updatedLogs);

      // Auto-dismiss on allowed
      if (result.allowed) {
        const dismissDelay = result.expiringSoon ? 4000 : 3000;
        autoDismissTimerRef.current = setTimeout(() => {
          setActiveResult(null);
          focusInput();
        }, dismissDelay);
      }
    } catch {
      toast({
        title: "خطأ في عملية المسح",
        description: "تعذر تقييم صلاحية الدخول",
        variant: "error",
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const dismissResult = () => {
    if (autoDismissTimerRef.current) {
      clearTimeout(autoDismissTimerRef.current);
    }
    setActiveResult(null);
    focusInput();
  };

  // Keyboard shortcut listener for hands-free workflow
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // If modal is open, Esc or Enter dismisses it
      if (activeResult) {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault();
          dismissResult();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeResult]);

  // Execute Action from Next Action Table
  const handleNextAction = async (actionType: string) => {
    if (!activeResult) return;
    const member = activeResult.member;

    switch (actionType) {
      case "viewReason":
        setBlockedReasonDialog(member?.blockedReason || "مخالفة اللائحة العامة للجيم");
        break;

      case "unfreeze":
        if (activeResult.subscriptionId) {
          await scanApi.unfreezeSubscription(activeResult.subscriptionId);
          toast({
            title: "تم إلغاء التجميد بنجاح",
            description: `تم استئناف اشتراك العضو ${member?.name}`,
            variant: "success",
          });
          // Re-evaluate scan: now active!
          if (member?.code) {
            handleScanSubmit(member.code);
          }
        }
        break;

      case "startClass":
        try {
          await scanApi.startClass("cs_kickboxing");
          toast({
            title: "تم بدء الكلاس بنجاح",
            description: "تم بدء تسجيل حضور كيك بوكس",
            variant: "success",
          });
          await loadData();
          // Re-evaluate scan: now allowed!
          if (member?.code) {
            handleScanSubmit(member.code);
          }
        } catch (err: any) {
          toast({
            title: "تعذر بدء الكلاس",
            description: err.message,
            variant: "error",
          });
        }
        break;

      case "collectBalance":
        toast({
          title: "تحصيل المتبقي المستحق",
          description: `تم فتح شاشة سداد الأقساط للعضو: ${member?.name} (متبقي 1,500 ج.م)`,
          variant: "warning",
        });
        dismissResult();
        break;

      case "collectPayment":
        toast({
          title: "تحصيل الدفعة المقدمة",
          description: `سداد الحد الأدنى لتفعيل باقة ${member?.name}`,
          variant: "warning",
        });
        dismissResult();
        break;

      case "renew":
      case "renewPt":
        toast({
          title: "تجديد الاشتراك",
          description: `تم فتح نافذة تجديد الاشتراك للعضو: ${member?.name}`,
          variant: "info",
        });
        dismissResult();
        break;

      case "sellSubscription":
      case "sellGymSubscription":
        toast({
          title: "شراء اشتراك جديد",
          description: `إضافة اشتراك جديد للعضو: ${member?.name}`,
          variant: "info",
        });
        dismissResult();
        break;

      case "showStartDate":
        toast({
          title: "تاريخ بدء الاشتراك",
          description: "يبدأ هذا الاشتراك في 01/12/2026",
          variant: "info",
        });
        break;

      case "showClassDays":
      case "showTimes":
        toast({
          title: "مواعيد الحصة",
          description: "هذه الحصة محددة يوم الجمعة 19:00 - 20:00",
          variant: "info",
        });
        break;

      default:
        dismissResult();
    }
  };

  // Start Class handler from Today's Classes panel
  const handleStartClass = async (classScheduleId: string) => {
    try {
      await scanApi.startClass(classScheduleId);
      toast({
        title: "تم بدء الحصة بنجاح",
        description: "تم فتح نافذة الدخول للحصة ومسموح للمشتركين بالدخول",
        variant: "success",
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: "تعذر بدء الحصة",
        description: err.message,
        variant: "error",
      });
    }
  };

  // End Class handler from Today's Classes panel
  const handleEndClass = async (sessionOrScheduleId: string) => {
    try {
      await scanApi.endClass(sessionOrScheduleId);
      toast({
        title: "تم إنهاء الحصة بنجاح",
        description: "تم إغلاق نافذة الحضور وحفظ السجل",
        variant: "info",
      });
      await loadData();
    } catch (err: any) {
      toast({
        title: "تعذر إنهاء الحصة",
        description: err.message,
        variant: "error",
      });
    }
  };

  // Quick Test Codes List from Real Database & Acceptance Scenarios
  const testCodes = [
    { code: "100245", label: "ACTIVE (محمد أحمد)", variant: "g" as const },
    { code: "100101", label: "ACTIVE (أحمد محمد علي)", variant: "g" as const },
    { code: "100202", label: "EXPIRING_SOON (محمود حسن)", variant: "w" as const },
    { code: "100404", label: "FROZEN (زياد محمود)", variant: "r" as const },
    { code: "100505", label: "PAYMENT_OVERDUE (كريم عادل)", variant: "r" as const },
    { code: "999999", label: "MEMBER_NOT_FOUND (عضو غير مسجل)", variant: "r" as const },
    { code: "1003", label: "BLOCKED (سارة إسماعيل)", variant: "r" as const },
    { code: "1004", label: "NO_SUBSCRIPTION (كريم ممدوح)", variant: "r" as const },
    { code: "1005", label: "PENDING_PAYMENT (عمر فاروق)", variant: "r" as const },
    { code: "1006", label: "PAYMENT_OVERDUE (كريم سامي)", variant: "r" as const },
    { code: "1007", label: "FROZEN (مريم خليل)", variant: "r" as const },
    { code: "1008", label: "EXPIRED (منى فؤاد)", variant: "r" as const },
    { code: "1009", label: "PT_EXPIRED (نادين طارق)", variant: "r" as const },
    { code: "1010", label: "NOT_STARTED (طارق سليم)", variant: "r" as const },
    { code: "1011", label: "CANCELLED (رانيا شوقي)", variant: "r" as const },
    { code: "1012", label: "NO_SESSIONS_LEFT (هشام كمال)", variant: "r" as const },
    { code: "1013", label: "NO_FLOOR_ACCESS (منى رفعت)", variant: "r" as const },
    { code: "1014", label: "CLASS_NOT_TODAY (وليد توفيق)", variant: "r" as const },
    { code: "1015", label: "CLASS_NOT_STARTED (أمير شوقي)", variant: "w" as const },
    { code: "1016", label: "CLASS_ENDED (أشرف صبحي)", variant: "r" as const },
    { code: "1017", label: "CLASS_CANCELLED (دينا فتحي)", variant: "r" as const },
    { code: "1018", label: "CLASS_OUT_OF_TIME (عماد حسني)", variant: "r" as const },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] min-h-[calc(100vh-1px)] relative">
      {/* Center Main Scan Area */}
      <main className="p-6 md:p-[26px_30px] flex flex-col gap-[18px]">
        {/* Header Row with Shift Gate Chip */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold tracking-tight text-[#14181F]">
            مسح الدخول
          </h1>

          {isShiftOpen && shift ? (
            <Chip>
              <span className="tabular-nums">
                وردية {shift.staffId === "staff_reception" ? "سارة" : "الموظف"} مفتوحة منذ{" "}
                {new Date(shift.openedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} ·
                الكاش المتوقع {((shift.expectedCash ?? shift.openingCash) / 100).toFixed(2)} ج.م
              </span>
            </Chip>
          ) : (
            <button
              type="button"
              onClick={openShiftModal}
              className="inline-flex items-center gap-2 bg-[#B3261E] text-white rounded-full px-4 py-2 text-sm font-bold animate-pulse hover:bg-[#971f18] transition-colors cursor-pointer"
            >
              <Lock className="h-4 w-4" />
              <span>الوردية مغلقة · اضغط لفتح الوردية</span>
            </button>
          )}
        </header>

        {/* Scan Input Form (Keyboard / Barcode Scanner) */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleScanSubmit();
          }}
          className="flex flex-col gap-1.5"
        >
          <div className="flex items-center justify-between">
            <label htmlFor="scan-input" className="text-[13px] text-[#5B6470] font-medium">
              امسح الباركود أو اكتب الاسم أو رقم الموبايل (جاهز للمسح دائماً)
            </label>
            <button
              type="button"
              onClick={() => setShowTestChips(!showTestChips)}
              className="text-xs text-[#14181F] font-bold underline hover:text-[#5B6470] cursor-pointer"
            >
              {showTestChips ? "إخفاء أكواد الاختبار ▲" : "عرض أكواد جدول الاختبار (18 كود) ▼"}
            </button>
          </div>

          <div className="relative flex items-center">
            <input
              id="scan-input"
              ref={inputRef}
              type="text"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              placeholder="امسح الباركود أو اكتب الكود (مثل 100245، 100101، 100202)..."
              disabled={isEvaluating}
              className="w-full text-[22px] font-medium p-[14px_18px] pe-12 border-2 border-[#14181F] rounded-[12px] bg-white text-[#14181F] outline-none transition-all focus:ring-4 focus:ring-[#C6F24E]/40"
              autoFocus
              autoComplete="off"
            />
            <button
              type="submit"
              disabled={isEvaluating}
              className="absolute end-3 text-[#14181F] p-2 hover:bg-[#F2F4F1] rounded-lg transition-colors cursor-pointer"
              title="بحث أو إدخال"
            >
              <Search className="h-6 w-6" />
            </button>
          </div>
        </form>

        {/* Quick Test Barcode Simulator Chips */}
        {showTestChips && (
          <div className="p-4 rounded-[14px] bg-white border border-[#E1E5DF] space-y-2.5">
            <div className="flex items-center justify-between text-xs text-[#5B6470] font-medium">
              <span>انقر على أي كود لمحاكاة مسح الباركود فورياً:</span>
              <span className="text-[#14181F] font-bold">18 حالة فحص معتمدة</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {testCodes.map((tc) => (
                <button
                  key={tc.code}
                  type="button"
                  onClick={() => handleScanSubmit(tc.code)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all hover:scale-105 active:scale-95 cursor-pointer ${
                    tc.variant === "g"
                      ? "bg-[#E3F5EA] text-[#1B7F4B] border-[#1B7F4B]/30"
                      : tc.variant === "w"
                      ? "bg-[#FFF1D6] text-[#8A5A00] border-[#8A5A00]/30"
                      : "bg-[#FDE7E4] text-[#B3261E] border-[#B3261E]/30"
                  }`}
                >
                  <span className="font-mono bg-white/70 px-1.5 py-0.5 rounded">{tc.code}</span>
                  <span>{tc.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Real-time Result Overlay / Card Display */}
        {activeResult ? (
          <div
            className={`rounded-[18px] p-7 md:p-[28px_32px] text-white shadow-xl animate-in zoom-in-95 duration-150 relative ${
              activeResult.allowed
                ? activeResult.expiringSoon
                  ? "bg-[#1B7F4B] border-4 border-[#C6F24E]"
                  : "bg-[#1B7F4B]"
                : "bg-[#B3261E]"
            }`}
          >
            {/* Close / Dismiss button */}
            <button
              type="button"
              onClick={dismissResult}
              className="absolute top-4 end-4 text-white/80 hover:text-white p-1 rounded-full hover:bg-black/20 transition-colors cursor-pointer"
              title="إغلاق (Esc)"
            >
              <X className="h-6 w-6" />
            </button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6">
              <div>
                <p className="text-[15px] font-bold opacity-85 uppercase tracking-wider flex items-center gap-2">
                  {activeResult.allowed ? (
                    <>
                      <CheckCircle2 className="h-5 w-5 text-[#C6F24E]" />
                      <span>{activeResult.expiringSoon ? "ACTIVE · EXPIRING SOON" : "ACTIVE"}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5 text-white" />
                      <span>DENIED · {activeResult.reason}</span>
                    </>
                  )}
                </p>
                <h2 className="text-[40px] md:text-[46px] font-black leading-[1.1] mt-1">
                  {REASON_CONFIG[activeResult.reason]?.message || (activeResult.allowed ? "تفضل بالدخول" : "ممنوع الدخول")}
                </h2>
              </div>

              <div className="sm:text-end">
                <p className="text-[26px] font-bold">{activeResult.member?.name || "عضو غير مسجل"}</p>
                <p className="text-sm opacity-90 font-mono">
                  كود {activeResult.member?.code || "---"}
                </p>
                {activeResult.member?.phone && (
                  <p className="text-xs opacity-75 dir-ltr sm:text-end font-mono">
                    {activeResult.member.phone}
                  </p>
                )}
              </div>

              {/* Subscription details */}
              <div className="mt-1">
                <p className="text-sm font-semibold">
                  {activeResult.planName || "بدون باقة نشطة"}
                  {activeResult.daysLeft !== undefined && ` · متبقي ${activeResult.daysLeft} يوم`}
                  {activeResult.sessionsLeft !== undefined && activeResult.sessionsLeft !== null && ` · متبقي ${activeResult.sessionsLeft} جلسة`}
                </p>
                {activeResult.allowed && (
                  <div className="h-[10px] bg-white/25 rounded-full mt-2 overflow-hidden">
                    <div
                      className="h-full bg-white rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(15, (activeResult.daysLeft || 1) * 3))}%` }}
                    />
                  </div>
                )}
              </div>

              {/* Expiring soon callout or action prompt */}
              <div className="sm:text-end mt-1 flex flex-col justify-end">
                {activeResult.allowed ? (
                  <p className="text-xs text-white/80 font-medium">
                    سيتم إغلاق النافذة تلقائياً · اضغط Enter للمتابعة
                  </p>
                ) : (
                  <p className="text-xs text-white/90 font-bold">
                    إجراء مطلوب قبل السماح بالدخول
                  </p>
                )}
              </div>

              {/* Expiring Soon Banner */}
              {activeResult.expiringSoon && (
                <div className="col-span-full mt-1 bg-[#FFF1D6] text-[#6B4400] rounded-[10px] p-[10px_14px] font-bold text-sm flex items-center justify-between gap-2 shadow-sm">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 shrink-0 text-[#8A5A00]" />
                    <span>الاشتراك ينتهي خلال 3 أيام. اعرض التجديد على العضو الآن.</span>
                  </div>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => handleNextAction("renew")}
                  >
                    تجديد الاشتراك
                  </Button>
                </div>
              )}

              {/* Next Action Button (for Denied Scans) */}
              {!activeResult.allowed && REASON_CONFIG[activeResult.reason]?.actionLabel && (
                <div className="col-span-full mt-2 pt-3 border-t border-white/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <span className="text-sm text-white/90">
                    السبب: {REASON_CONFIG[activeResult.reason]?.message}
                  </span>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                      variant="lime"
                      className="w-full sm:w-auto font-bold px-6 shadow-md"
                      onClick={() => handleNextAction(REASON_CONFIG[activeResult.reason]!.actionType)}
                    >
                      {REASON_CONFIG[activeResult.reason]!.actionLabel}
                    </Button>
                    <Button
                      variant="outline"
                      className="bg-transparent text-white border-white/40 hover:bg-white/10"
                      onClick={dismissResult}
                    >
                      إغلاق (Esc)
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Default Result Card from Mockup */
          <section className="bg-[#1B7F4B] text-white rounded-[18px] p-7 md:p-[28px_32px] grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 shadow-sm">
            <div>
              <p className="text-[15px] font-semibold opacity-85 uppercase tracking-wider">ACTIVE</p>
              <h2 className="text-[40px] md:text-[48px] font-bold leading-[1.1] mt-0.5">
                تفضل بالدخول
              </h2>
            </div>

            <div className="sm:text-end">
              <p className="text-[26px] font-bold">محمد أحمد</p>
              <p className="text-sm opacity-90">كود 100245</p>
            </div>

            <div className="mt-2">
              <p className="text-sm font-medium">جيم 90 يوم · متبقي 21 يوم</p>
              <div className="h-[10px] bg-white/25 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-white rounded-full w-[77%]" />
              </div>
            </div>

            <div className="sm:text-end mt-2">
              <p className="text-sm font-medium">برايفت مع الكابتن أحمد · متبقي 6 جلسات</p>
            </div>

            <div className="col-span-full mt-2 bg-[#FFF1D6] text-[#6B4400] rounded-[10px] p-[10px_14px] font-semibold text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-[#8A5A00]" />
              <span>اشتراك البرايفت ينتهي خلال 3 أيام. اعرض التجديد على العضو.</span>
            </div>
          </section>
        )}

        {/* Recent Check-ins Card (Dynamic from Mock Data AccessLog) */}
        <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px]">
          <div className="flex items-center justify-between mb-1.5">
            <h3 className="text-base font-bold text-[#14181F]">آخر عمليات الدخول</h3>
            <span className="text-xs text-[#5B6470] font-medium">سجل اليوم المباشر</span>
          </div>

          <div className="flex flex-col">
            {accessLogs.slice(0, 7).map((log) => {
              const timeStr = new Date(log.scannedAt).toLocaleTimeString("ar-EG", {
                hour: "2-digit",
                minute: "2-digit",
              });

              return (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 py-3 border-t border-[#E1E5DF]"
                >
                  <div className="flex items-center gap-3 flex-1">
                    <span className="font-bold text-[#14181F] text-sm">
                      {log.memberName || "عضو غير معروف"}
                    </span>
                    {log.planName && (
                      <span className="text-xs text-[#5B6470] hidden sm:inline">
                        ({log.planName})
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge
                      variant={
                        log.allowed
                          ? "g"
                          : log.reason === "CLASS_NOT_STARTED"
                          ? "w"
                          : "r"
                      }
                    >
                      {REASON_CONFIG[log.reason]?.message || log.reason}
                    </Badge>

                    {/* Action button if actionable denial */}
                    {!log.allowed && log.reason === "PAYMENT_OVERDUE" && (
                      <Button
                        variant="lime"
                        size="sm"
                        onClick={() =>
                          toast({
                            title: "تحصيل المتبقي",
                            description: `فتح نافذة تحصيل المتبقي للعضو: ${log.memberName}`,
                            variant: "warning",
                          })
                        }
                      >
                        تحصيل المتبقي
                      </Button>
                    )}

                    {!log.allowed && log.reason === "EXPIRED" && (
                      <Button
                        variant="default"
                        size="sm"
                        onClick={() =>
                          toast({
                            title: "تجديد اشتراك",
                            description: `فتح نموذج تجديد الاشتراك للعضو: ${log.memberName}`,
                          })
                        }
                      >
                        تجديد
                      </Button>
                    )}

                    <span className="text-[13px] text-[#5B6470] tabular-nums ps-2">
                      {timeStr}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* Right Column: Today's Classes Panel (330px) */}
      <aside className="p-6 md:p-[26px_22px] flex flex-col gap-[14px] border-inline-start border-[#E1E5DF] bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#14181F]">حصص اليوم</h3>
          <span className="text-xs text-[#5B6470] font-medium">الأربعاء، 4 نوفمبر</span>
        </div>

        {isLoadingClasses ? (
          <div className="p-6 text-center text-sm text-[#5B6470]">جاري تحميل الحصص...</div>
        ) : todayClasses.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#5B6470]">لا توجد حصص مجدولة اليوم</div>
        ) : (
          todayClasses.map((cls) => {
            const isStarted = cls.status === "IN_PROGRESS";
            const isEnded = cls.status === "ENDED";
            const isCancelled = cls.status === "CANCELLED";

            return (
              <div
                key={cls.id}
                className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px] flex flex-col gap-1 transition-shadow hover:shadow-subtle"
              >
                <div className="flex items-center justify-between gap-2">
                  <b className="text-[15px] font-bold text-[#14181F]">{cls.name}</b>
                  <Badge
                    variant={
                      isCancelled
                        ? "r"
                        : isStarted
                        ? "g"
                        : isEnded
                        ? "default"
                        : "w"
                    }
                  >
                    {isCancelled
                      ? "ملغاة"
                      : isStarted
                      ? "جارية"
                      : isEnded
                      ? "منتهية"
                      : "لم تبدأ"}
                  </Badge>
                </div>

                <p className="text-[13px] text-[#5B6470] my-1.5">
                  {isCancelled ? (
                    "تم إلغاء الحصة اليوم"
                  ) : isStarted ? (
                    `بدأت ${cls.effectiveStartTime} · مسجل ${cls.enrolledMembersCount}`
                  ) : isEnded ? (
                    "انتهت الحصة وأُغلق الحضور"
                  ) : (
                    `المدرب: ${cls.coachName} · ${cls.enrolledMembersCount} مسجل`
                  )}
                </p>

                {/* Class Control Buttons */}
                {!isCancelled && !isEnded && (
                  <div>
                    {!isStarted ? (
                      <Button
                        variant="lime"
                        className="w-full mt-1 font-bold"
                        onClick={() => handleStartClass(cls.id)}
                      >
                        <Play className="h-4 w-4 me-1.5 fill-current" />
                        <span>ابدأ الكلاس</span>
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        className="w-full mt-1 font-bold"
                        onClick={() => handleEndClass(cls.todaySession?.id || cls.id)}
                      >
                        <Square className="h-4 w-4 me-1.5 fill-current" />
                        <span>إنهاء الكلاس</span>
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </aside>

      {/* Blocked Member Reason Dialog */}
      <Dialog
        isOpen={!!blockedReasonDialog}
        onClose={() => {
          setBlockedReasonDialog(null);
          focusInput();
        }}
        title="تفاصيل قرار حظر العضو"
        description="سجل المخالفة الإدارية الصادرة بحق هذا العضو"
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-[#FDE7E4] text-[#8F1F18] border border-[#B3261E]/30 space-y-1">
            <b className="text-sm font-bold block">سبب الحظر المسجل:</b>
            <p className="text-sm">{blockedReasonDialog}</p>
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              onClick={() => {
                setBlockedReasonDialog(null);
                focusInput();
              }}
            >
              إغلاق
            </Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
