"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
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
} from "@gym/contracts";
import { scanApi } from "../../features/scan/api";
import { useShift } from "../../lib/shift-context";
import { http } from "../../lib/api";
import { QuickSubscribeDialog } from "../../features/scan/components/quick-subscribe-dialog";
import { CreateMemberDialog } from "../../features/members/components/create-member-dialog";
import { CollectBalanceDialog } from "../../features/members/components/collect-balance-dialog";
import {
  Search,
  Play,
  Square,
  AlertTriangle,
  X,
  CheckCircle2,
  XCircle,
  Lock,
  QrCode,
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
  const router = useRouter();
  const { toast } = useToast();
  const { shift, isOpen: isShiftOpen, openShiftModal, currentUser, isLoading: isShiftLoading } = useShift();

  useEffect(() => {
    if (!isShiftLoading && currentUser?.role === "SUPER_ADMIN") {
      router.replace("/platform");
    }
  }, [currentUser, isShiftLoading, router]);

  // Always focused input ref
  const inputRef = useRef<HTMLInputElement>(null);
  const [scanQuery, setScanQuery] = useState("");
  const [isEvaluating, setIsEvaluating] = useState(false);

  // Full Screen / Interactive Result Overlay state
  const [activeResult, setActiveResult] = useState<ScanResult | null>(null);
  const autoDismissTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Reason modal dialog for BLOCKED member
  const [blockedReasonDialog, setBlockedReasonDialog] = useState<string | null>(null);

  // Quick Subscribe Dialog state
  const [isSubscribeDialogOpen, setIsSubscribeDialogOpen] = useState(false);
  const [selectedMemberForSubscribe, setSelectedMemberForSubscribe] = useState<any | null>(null);

  // Collect Balance Dialog state
  const [isCollectBalanceOpen, setIsCollectBalanceOpen] = useState(false);
  const [collectInvoice, setCollectInvoice] = useState<any | null>(null);
  const [collectMember, setCollectMember] = useState<any | null>(null);

  // Create Member Dialog state
  const [isCreateMemberOpen, setIsCreateMemberOpen] = useState(false);

  // Info Details Dialog state
  const [infoDialog, setInfoDialog] = useState<{ title: string; message: string } | null>(null);

  // Data lists
  const [accessLogs, setAccessLogs] = useState<AccessLog[]>([]);
  const [todayClasses, setTodayClasses] = useState<ClassScheduleWithDetails[]>([]);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);

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
      case "collectPayment":
        if (member?.id) {
          try {
            const invoices = await http.get<any[]>(`/invoices?memberId=${member.id}`);
            const unpaid = invoices.find(
              (inv) => (inv.remainingAmount > 0 || inv.status === "PENDING_PAYMENT") && inv.status !== "VOID"
            );
            if (unpaid) {
              setCollectInvoice(unpaid);
              setCollectMember(member);
              setIsCollectBalanceOpen(true);
            } else {
              router.push(`/pos?memberId=${member.id}`);
            }
          } catch {
            router.push(`/pos?memberId=${member.id}`);
          }
        }
        break;

      case "renew":
      case "renewPt":
      case "sellSubscription":
      case "sellGymSubscription":
        if (activeResult.reason === "MEMBER_NOT_FOUND") {
          setIsCreateMemberOpen(true);
        } else if (member?.id) {
          setSelectedMemberForSubscribe(member);
          setIsSubscribeDialogOpen(true);
        }
        break;

      case "showStartDate":
        setInfoDialog({
          title: "موعد بدء سريان الاشتراك",
          message: activeResult.subscription?.startDate
            ? `يبدأ هذا الاشتراك رسمياً في: ${new Date(activeResult.subscription.startDate).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}`
            : "تاريخ بدء الاشتراك محدد في تاريخ لاحق.",
        });
        break;

      case "showClassDays":
      case "showTimes":
        setInfoDialog({
          title: "جدول ومواعيد الحصة",
          message: (activeResult as any)?.classDetails
            ? `مواعيد الحصة: ${(activeResult as any).classDetails}`
            : "العضو مسجل في هذه الحصة ولكن موعدها أو يومها ليس الآن.",
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

  const todayFormatted = new Intl.DateTimeFormat("ar-EG", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] xl:grid-cols-[1fr_360px] h-full lg:h-[calc(100vh-3.5rem)] lg:overflow-hidden relative">
      {/* Center Main Scan Area */}
      <main className="p-6 md:p-[26px_30px] flex flex-col gap-[18px] lg:h-full lg:overflow-y-auto min-h-0">
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
              امسح الباركود أو اكتب كود العضو أو رقم الهاتف (جاهز للمسح دائماً)
            </label>
          </div>

          <div className="relative flex items-center">
            <input
              id="scan-input"
              ref={inputRef}
              type="text"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              placeholder="امسح الباركود أو اكتب كود العضو أو رقم الهاتف..."
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
          <section className="bg-white border-2 border-dashed border-[#E1E5DF] rounded-[18px] p-8 text-center flex flex-col items-center justify-center gap-2 text-[#5B6470] shadow-sm min-h-[160px]">
            <QrCode className="h-10 w-10 text-[#5B6470]/50" />
            <p className="text-base font-bold text-[#14181F]">جاهز لمسح الباركود</p>
            <p className="text-xs">امسح باركود العضو بجهاز المسح أو أدخل الكود في حقل البحث أعلاه</p>
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

      {/* Right Column: Today's Classes Panel (340px) with Independent Scroll */}
      <aside className="p-6 md:p-[26px_22px] flex flex-col gap-[14px] border-inline-start border-[#E1E5DF] bg-white lg:h-full lg:overflow-y-auto min-h-0 shrink-0">
        <div className="flex items-center justify-between pb-2 border-b border-[#E1E5DF]">
          <h3 className="text-base font-bold text-[#14181F]">حصص اليوم</h3>
          <span className="text-xs text-[#5B6470] font-medium">{todayFormatted}</span>
        </div>

        {isLoadingClasses ? (
          <div className="p-6 text-center text-sm text-[#5B6470]">جاري تحميل الحصص...</div>
        ) : todayClasses.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#5B6470]">لا توجد حصص مجدولة اليوم</div>
        ) : (
          todayClasses.map((cls) => {
            const isStarted = cls.status === "IN_PROGRESS" || (cls.status as string) === "RUNNING";
            const isEnded = cls.status === "ENDED";
            const isCancelled = cls.status === "CANCELLED";
            const coachDisplayName = cls.coachName || (cls as any).coach?.name || "بدون مدرب";
            const enrolledCount = cls.enrolledMembersCount ?? (cls as any).registeredCount ?? 0;
            const startTimeStr = cls.effectiveStartTime || cls.startTime || "";

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
                    `بدأت ${startTimeStr} · مسجل ${enrolledCount}`
                  ) : isEnded ? (
                    "انتهت الحصة وأُغلق الحضور"
                  ) : (
                    `المدرب: ${coachDisplayName} · ${enrolledCount} مسجل`
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
                        onClick={() => handleEndClass(cls.todaySession?.id || (cls as any).session?.id || cls.id)}
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

      {/* Quick Subscribe & Renew Dialog */}
      <QuickSubscribeDialog
        isOpen={isSubscribeDialogOpen}
        onClose={() => {
          setIsSubscribeDialogOpen(false);
          focusInput();
        }}
        member={selectedMemberForSubscribe}
        onSuccess={async () => {
          setIsSubscribeDialogOpen(false);
          if (selectedMemberForSubscribe?.code) {
            await handleScanSubmit(selectedMemberForSubscribe.code);
          }
        }}
        onOpenPos={(memberId) => {
          setIsSubscribeDialogOpen(false);
          router.push(`/pos?memberId=${memberId}`);
        }}
      />

      {/* Collect Balance Dialog */}
      {collectInvoice && collectMember && (
        <CollectBalanceDialog
          isOpen={isCollectBalanceOpen}
          onClose={() => {
            setIsCollectBalanceOpen(false);
            setCollectInvoice(null);
            setCollectMember(null);
            focusInput();
          }}
          invoice={collectInvoice}
          member={collectMember}
          onSuccess={async () => {
            setIsCollectBalanceOpen(false);
            setCollectInvoice(null);
            setCollectMember(null);
            toast({
              title: "تم تحصيل المبلغ بنجاح",
              description: "تم تحديث حالة اشتراك العضو وتفعيل الدخول",
              variant: "success",
            });
            if (collectMember.code) {
              await handleScanSubmit(collectMember.code);
            }
          }}
        />
      )}

      {/* Create Member Dialog */}
      <CreateMemberDialog
        isOpen={isCreateMemberOpen}
        onClose={() => {
          setIsCreateMemberOpen(false);
          focusInput();
        }}
        onSuccess={(newMember) => {
          setIsCreateMemberOpen(false);
          toast({
            title: "تم تسجيل العضو بنجاح",
            description: `كود العضو الجديد: ${newMember.code}`,
            variant: "success",
          });
          setSelectedMemberForSubscribe(newMember);
          setIsSubscribeDialogOpen(true);
        }}
      />

      {/* Info Details Dialog */}
      <Dialog
        isOpen={!!infoDialog}
        onClose={() => {
          setInfoDialog(null);
          focusInput();
        }}
        title={infoDialog?.title || "تنبيه"}
        description="تفاصيل اشتراك ومواعيد العضو"
      >
        <div className="space-y-4 pt-2">
          <div className="p-4 rounded-xl bg-[#F6F8F5] text-[#14181F] border border-[#E1E5DF] text-sm font-medium">
            {infoDialog?.message}
          </div>
          <div className="flex justify-end pt-2">
            <Button
              variant="default"
              onClick={() => {
                setInfoDialog(null);
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
