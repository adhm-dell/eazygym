"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import {
  CalendarDays,
  Clock,
  Users,
  Play,
  Square,
  AlertTriangle,
  Plus,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Search,
  Edit2,
  Power,
  Calendar,
  Sparkles,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Info,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Button, Badge, useToast } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import {
  classesApi,
  type ClassScheduleItem,
  type TodayClassOccurrence,
} from "../../../features/classes/api";
import { ClassScheduleDialog } from "../../../features/classes/components/class-schedule-dialog";
import { ClassExceptionDialog } from "../../../features/classes/components/class-exception-dialog";
import { RegisteredMembersDialog } from "../../../features/classes/components/registered-members-dialog";
import { useShift } from "../../../lib/shift-context";

export default function ClassesPage() {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const { toast } = useToast();
  const { currentUser } = useShift();
  const isAllowed =
    currentUser?.role === "RECEPTION" ||
    currentUser?.role === "GYM_ADMIN" ||
    currentUser?.role === "SUPER_ADMIN";
  const isAdmin =
    currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN";

  // Active Tab: 'today' | 'timetable'
  const [activeTab, setActiveTab] = useState<"today" | "timetable">("today");

  // Data states
  const [todayClasses, setTodayClasses] = useState<TodayClassOccurrence[]>([]);
  const [schedules, setSchedules] = useState<ClassScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDayFilter, setSelectedDayFilter] = useState<number | "ALL">("ALL");

  // Dialog states
  const [isScheduleDialogOpen, setIsScheduleDialogOpen] = useState(false);
  const [scheduleToEdit, setScheduleToEdit] = useState<ClassScheduleItem | null>(null);
  const [defaultScheduleDay, setDefaultScheduleDay] = useState<number>(0);

  const [isExceptionDialogOpen, setIsExceptionDialogOpen] = useState(false);
  const [selectedScheduleForException, setSelectedScheduleForException] = useState<{
    id: string;
    name: string;
    coach?: { id?: string; name?: string };
    startTime: string;
    endTime: string;
  } | null>(null);

  const [isMembersDialogOpen, setIsMembersDialogOpen] = useState(false);
  const [selectedScheduleForMembers, setSelectedScheduleForMembers] = useState<{
    id: string;
    name: string;
    capacity?: number;
    registeredCount?: number;
    members?: any[];
  } | null>(null);

  // Load data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [todayData, schedulesData] = await Promise.all([
        classesApi.listTodayClasses(),
        classesApi.listSchedules(),
      ]);
      setTodayClasses(todayData);
      setSchedules(schedulesData);
    } catch (err: any) {
      console.error("Failed to load classes data", err);
      setLoadError(err?.message || "حدث خطأ أثناء تحميل بيانات الحصص");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Actions on Today's classes
  const handleStartClass = async (scheduleId: string, name: string) => {
    try {
      await classesApi.startClass(scheduleId);
      toast({
        title: "تم بدء الحصة بنجاح",
        description: `بدأت حصة ${name} الآن وتم فتح تسجيل الدخول للأعضاء`,
        variant: "success",
      });
      await fetchData();
    } catch (err: any) {
      toast({
        title: "تعذر بدء الحصة",
        description: err?.message || "حدث خطأ أثناء بدء الحصة",
        variant: "error",
      });
    }
  };

  const handleEndClass = async (scheduleId: string, name: string) => {
    try {
      await classesApi.endClass(scheduleId);
      toast({
        title: "تم إنهاء الحصة بنجاح",
        description: `تم إنهاء حصة ${name} وإغلاق الحضور`,
        variant: "success",
      });
      await fetchData();
    } catch (err: any) {
      toast({
        title: "تعذر إنهاء الحصة",
        description: err?.message || "حدث خطأ أثناء إنهاء الحصة",
        variant: "error",
      });
    }
  };

  const handleToggleScheduleActive = async (schedule: ClassScheduleItem) => {
    try {
      const updated = await classesApi.updateSchedule(schedule.id, {
        isActive: !schedule.isActive,
      });
      toast({
        title: updated.isActive ? "تم تفعيل موعد الحصة" : "تم تعطيل موعد الحصة",
        description: `موعد حصة ${schedule.name} أصبحت ${updated.isActive ? "نشطة" : "معطلة"}`,
        variant: "success",
      });
      await fetchData();
    } catch (err: any) {
      toast({
        title: "تعذر تحديث حالة الحصة",
        description: err?.message || "حدث خطأ أثناء حفظ التعديل",
        variant: "error",
      });
    }
  };

  // Filtered Today Classes
  const filteredTodayClasses = useMemo(() => {
    if (!searchQuery.trim()) return todayClasses;
    const q = searchQuery.toLowerCase().trim();
    return todayClasses.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.coach?.name && c.coach.name.toLowerCase().includes(q))
    );
  }, [todayClasses, searchQuery]);

  // Grouped Weekly Schedules
  const daysMap = [0, 1, 2, 3, 4, 5, 6];
  const schedulesByDay = useMemo(() => {
    const map: Record<number, ClassScheduleItem[]> = {
      0: [],
      1: [],
      2: [],
      3: [],
      4: [],
      5: [],
      6: [],
    };
    schedules.forEach((s) => {
      const list = map[s.dayOfWeek];
      if (list) {
        list.push(s);
      }
    });
    // Sort each day by startTime
    Object.keys(map).forEach((d) => {
      const list = map[Number(d)];
      if (list) {
        list.sort((a, b) => a.startTime.localeCompare(b.startTime));
      }
    });
    return map;
  }, [schedules]);

  // Today counters
  const runningCount = todayClasses.filter((c) => c.status === "RUNNING").length;
  const notStartedCount = todayClasses.filter((c) => c.status === "NOT_STARTED").length;
  const endedCount = todayClasses.filter((c) => c.status === "ENDED").length;
  const cancelledCount = todayClasses.filter((c) => c.status === "CANCELLED").length;

  if (currentUser && !isAllowed) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 pt-16" dir={isRtl ? "rtl" : "ltr"}>
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl space-y-3 shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
          <h2 className="text-lg font-black text-red-900">
            {isRtl ? "غير مصرح بالدخول" : "Unauthorized Access"}
          </h2>
          <p className="text-xs text-red-700 leading-relaxed font-medium">
            {isRtl
              ? "صفحة الحصص الجماعية والجدول الأسبوعي مخصصة للاستقبال ومدير النادي فقط."
              : "Classes & timetable management is restricted to reception and gym administrators."}
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs font-bold border-red-300 hover:bg-red-100">
                {isRtl ? "العودة لشاشة الدخول الرئيسية" : "Return to Home"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E1E5DF]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-[#14181F]">
              {t("classesTimetable.title")}
            </h1>
            <Badge variant="lime" className="font-mono text-xs">
              {todayClasses.length} اليوم · {schedules.length} أسبوعياً
            </Badge>
          </div>
          <p className="text-sm text-[#5B6470] mt-1">
            {t("classesTimetable.description")}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={isLoading}
            className="flex items-center gap-1.5"
            title="تحديث البيانات"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </Button>

          {isAdmin && (
            <Button
              variant="lime"
              className="font-bold flex items-center gap-2"
              onClick={() => {
                setScheduleToEdit(null);
                setDefaultScheduleDay(new Date().getDay());
                setIsScheduleDialogOpen(true);
              }}
            >
              <Plus className="w-4 h-4" />
              <span>{t("classesTimetable.createSchedule")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex items-center p-1 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("today")}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "today"
                ? "bg-white text-[#14181F] shadow-sm"
                : "text-[#5B6470] hover:text-[#14181F]"
            }`}
          >
            <Clock className="w-4 h-4 text-[#4D6B00]" />
            <span>{t("classesTimetable.todayTab")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                activeTab === "today"
                  ? "bg-[#C6F24E] text-[#14181F]"
                  : "bg-[#E1E5DF] text-[#5B6470]"
              }`}
            >
              {todayClasses.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("timetable")}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${
              activeTab === "timetable"
                ? "bg-white text-[#14181F] shadow-sm"
                : "text-[#5B6470] hover:text-[#14181F]"
            }`}
          >
            <CalendarDays className="w-4 h-4 text-[#4D6B00]" />
            <span>{t("classesTimetable.timetableTab")}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-xs font-mono ${
                activeTab === "timetable"
                  ? "bg-[#C6F24E] text-[#14181F]"
                  : "bg-[#E1E5DF] text-[#5B6470]"
              }`}
            >
              {schedules.length}
            </span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[260px]">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-[#5B6470]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث عن حصة أو مدرب..."
            className="w-full h-10 ps-9 pe-3 text-sm bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-transparent"
          />
        </div>
      </div>

      {/* TODAY'S VIEW */}
      {activeTab === "today" && (
        <div className="space-y-6">
          {/* KPI Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5B6470] font-medium">إجمالي حصص اليوم</p>
                <p className="text-2xl font-black text-[#14181F] mt-1">{todayClasses.length}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-[#F6F8F5] flex items-center justify-center text-[#14181F]">
                <Calendar className="w-5 h-5 text-[#5B6470]" />
              </div>
            </div>

            <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5B6470] font-medium">جارية الآن</p>
                <p className="text-2xl font-black text-emerald-600 mt-1">{runningCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Play className="w-5 h-5 fill-current" />
              </div>
            </div>

            <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5B6470] font-medium">لم تبدأ بعد</p>
                <p className="text-2xl font-black text-amber-600 mt-1">{notStartedCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl flex items-center justify-between">
              <div>
                <p className="text-xs text-[#5B6470] font-medium">ملغاة اليوم</p>
                <p className="text-2xl font-black text-red-600 mt-1">{cancelledCount}</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-red-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Today's Classes List */}
          {isLoading ? (
            <div className="py-16 text-center text-[#5B6470]">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#4D6B00] mb-2" />
              <p className="text-sm">جاري تحميل حصص اليوم...</p>
            </div>
          ) : filteredTodayClasses.length === 0 ? (
            <div className="py-16 text-center bg-white border border-dashed border-[#E1E5DF] rounded-2xl p-8 space-y-3">
              <CalendarDays className="w-12 h-12 text-[#5B6470]/40 mx-auto" />
              <h3 className="text-lg font-bold text-[#14181F]">
                {t("classesTimetable.noClassesToday")}
              </h3>
              <p className="text-sm text-[#5B6470] max-w-md mx-auto">
                {t("classesTimetable.noClassesTodayDesc")}
              </p>
              <Button
                variant="lime"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setScheduleToEdit(null);
                  setDefaultScheduleDay(new Date().getDay());
                  setIsScheduleDialogOpen(true);
                }}
              >
                <Plus className="w-4 h-4 me-1.5" />
                <span>{t("classesTimetable.createSchedule")}</span>
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredTodayClasses.map((cls) => {
                const isRunning = cls.status === "RUNNING";
                const isNotStarted = cls.status === "NOT_STARTED";
                const isEnded = cls.status === "ENDED";
                const isCancelled = cls.status === "CANCELLED";

                const regCount = cls.registeredCount || cls.members?.length || 0;
                const capacity = cls.capacity || 20;
                const percent = Math.min(100, Math.round((regCount / capacity) * 100));

                return (
                  <div
                    key={cls.id}
                    className={`bg-white border rounded-2xl p-5 flex flex-col justify-between transition-all hover:shadow-subtle ${
                      isRunning
                        ? "border-emerald-300 ring-2 ring-emerald-500/20 bg-emerald-50/10"
                        : isCancelled
                        ? "border-red-200 bg-red-50/20 opacity-80"
                        : "border-[#E1E5DF]"
                    }`}
                  >
                    {/* Header */}
                    <div>
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div>
                          <h3 className="text-lg font-black text-[#14181F]">{cls.name}</h3>
                          <p className="text-xs text-[#5B6470] mt-0.5">
                            المدرب: <strong className="text-[#14181F] font-semibold">{cls.coach?.name || "بدون مدرب"}</strong>
                          </p>
                        </div>
                        <Badge
                          variant={
                            isRunning
                              ? "g"
                              : isNotStarted
                              ? "w"
                              : isCancelled
                              ? "r"
                              : "default"
                          }
                        >
                          {isRunning
                            ? t("classesTimetable.running")
                            : isNotStarted
                            ? t("classesTimetable.notStarted")
                            : isCancelled
                            ? t("classesTimetable.cancelled")
                            : t("classesTimetable.ended")}
                        </Badge>
                      </div>

                      {/* Time and Capacity info */}
                      <div className="mt-4 p-3 bg-[#F6F8F5] rounded-xl space-y-2 border border-[#E1E5DF]">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <span className="flex items-center gap-1.5 text-[#14181F]">
                            <Clock className="w-3.5 h-3.5 text-[#5B6470]" />
                            <span className="font-mono dir-ltr">
                              {cls.startTime} - {cls.endTime}
                            </span>
                          </span>
                          <span className="text-[#5B6470]">
                            {t("classesTimetable.registeredCount")}:{" "}
                            <strong className="text-[#14181F] font-bold">
                              {regCount} / {capacity}
                            </strong>
                          </span>
                        </div>

                        {/* Capacity progress */}
                        <div className="h-1.5 w-full bg-[#E1E5DF] rounded-full overflow-hidden">
                          <div
                            className={`h-full transition-all duration-300 ${
                              percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-[#C6F24E]"
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      {/* Exception / Cancelled banner */}
                      {isCancelled && (
                        <div className="mt-3 p-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
                          <span>
                            تم إلغاء الحصة اليوم. سيتم رفض دخول المشتركين عند البوابة بـ{" "}
                            <code className="font-mono font-bold">CLASS_CANCELLED</code>.
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action buttons */}
                    <div className="mt-5 pt-4 border-t border-[#E1E5DF] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        {isNotStarted && (
                          <Button
                            variant="lime"
                            size="sm"
                            className="w-full font-bold col-span-2 flex items-center justify-center gap-1.5"
                            onClick={() => handleStartClass(cls.id, cls.name)}
                          >
                            <Play className="w-4 h-4 fill-current" />
                            <span>{t("classesTimetable.startClass")}</span>
                          </Button>
                        )}

                        {isRunning && (
                          <Button
                            variant="default"
                            size="sm"
                            className="w-full font-bold col-span-2 bg-[#14181F] text-white hover:bg-black flex items-center justify-center gap-1.5"
                            onClick={() => handleEndClass(cls.id, cls.name)}
                          >
                            <Square className="w-4 h-4 fill-current text-red-400" />
                            <span>{t("classesTimetable.endClass")}</span>
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full text-xs flex items-center justify-center gap-1.5"
                          onClick={() => {
                            setSelectedScheduleForMembers({
                              id: cls.id,
                              name: cls.name,
                              capacity: cls.capacity,
                              registeredCount: regCount,
                              members: cls.members,
                            });
                            setIsMembersDialogOpen(true);
                          }}
                        >
                          <Users className="w-3.5 h-3.5" />
                          <span>{t("classesTimetable.viewMembers")} ({regCount})</span>
                        </Button>

                        {isAdmin && (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full text-xs flex items-center justify-center gap-1.5 text-amber-700 hover:text-amber-800 hover:bg-amber-50"
                            onClick={() => {
                              setSelectedScheduleForException({
                                id: cls.id,
                                name: cls.name,
                                coach: cls.coach,
                                startTime: cls.startTime,
                                endTime: cls.endTime,
                              });
                              setIsExceptionDialogOpen(true);
                            }}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>{t("classesTimetable.manageException")}</span>
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TIMETABLE VIEW */}
      {activeTab === "timetable" && (
        <div className="space-y-6">
          {!isAdmin && (
            <div className="p-3 bg-sky-50 border border-sky-200 rounded-xl text-xs text-sky-800 flex items-center gap-2">
              <Info className="w-4 h-4 shrink-0 text-sky-600" />
              <span>
                {isRtl
                  ? "الجدول الأسبوعي معروض بوضع القراءة فقط لموظفي الاستقبال. إنشاء وتعديل وإلغاء المواعيد متاح لمدير النادي فقط."
                  : "The weekly timetable is in read-only mode for reception staff. Adding and modifying schedules is restricted to administrators."}
              </span>
            </div>
          )}

          {/* Day Selector Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              type="button"
              onClick={() => setSelectedDayFilter("ALL")}
              className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all ${
                selectedDayFilter === "ALL"
                  ? "bg-[#14181F] text-white"
                  : "bg-white border border-[#E1E5DF] text-[#5B6470] hover:bg-[#F6F8F5]"
              }`}
            >
              عرض كل أيام الأسبوع ({schedules.length})
            </button>
            {daysMap.map((d) => {
              const daySchedules = schedulesByDay[d] || [];
              const isSelected = selectedDayFilter === d;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setSelectedDayFilter(d)}
                  className={`px-4 py-2 rounded-xl text-xs font-bold shrink-0 transition-all flex items-center gap-1.5 ${
                    isSelected
                      ? "bg-[#C6F24E] text-[#14181F]"
                      : "bg-white border border-[#E1E5DF] text-[#5B6470] hover:bg-[#F6F8F5]"
                  }`}
                >
                  <span>{t(`classesTimetable.days.${d}`)}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      isSelected ? "bg-black/10 text-[#14181F]" : "bg-gray-100 text-[#5B6470]"
                    }`}
                  >
                    {daySchedules.length}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Timetable Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            {daysMap
              .filter((d) => selectedDayFilter === "ALL" || selectedDayFilter === d)
              .map((dayOfWeek) => {
                const daySchedules = (schedulesByDay[dayOfWeek] || []).filter((s) => {
                  if (!searchQuery.trim()) return true;
                  const q = searchQuery.toLowerCase().trim();
                  return (
                    s.name.toLowerCase().includes(q) ||
                    (s.coach?.name && s.coach.name.toLowerCase().includes(q))
                  );
                });

                const isToday = new Date().getDay() === dayOfWeek;

                return (
                  <div
                    key={dayOfWeek}
                    className={`bg-[#F6F8F5] border rounded-2xl p-4 flex flex-col min-h-[420px] ${
                      isToday
                        ? "border-[#C6F24E] ring-2 ring-[#C6F24E]/30 bg-[#F6F8F5]"
                        : "border-[#E1E5DF]"
                    }`}
                  >
                    {/* Day Column Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF] mb-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-[#14181F] text-sm">
                          {t(`classesTimetable.days.${dayOfWeek}`)}
                        </h3>
                        {isToday && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#C6F24E] text-[#14181F]">
                            اليوم
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-mono text-[#5B6470]">
                        {daySchedules.length}
                      </span>
                    </div>

                    {/* Schedules Cards */}
                    <div className="space-y-3 flex-1 overflow-y-auto">
                      {daySchedules.length === 0 ? (
                        <div className="py-8 text-center text-xs text-[#5B6470]">
                          لا توجد حصص
                        </div>
                      ) : (
                        daySchedules.map((schedule) => {
                          const regCount = schedule.registeredCount || schedule.members?.length || 0;
                          return (
                            <div
                              key={schedule.id}
                              className={`p-3 bg-white border rounded-xl shadow-xs space-y-2 transition-shadow hover:shadow-subtle ${
                                schedule.isActive
                                  ? "border-[#E1E5DF]"
                                  : "border-gray-200 opacity-60 bg-gray-50"
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1">
                                <h4 className="font-bold text-sm text-[#14181F] line-clamp-1">
                                  {schedule.name}
                                </h4>
                                <span
                                  className={`w-2 h-2 rounded-full shrink-0 mt-1 ${
                                    schedule.isActive ? "bg-emerald-500" : "bg-gray-400"
                                  }`}
                                  title={schedule.isActive ? "نشط" : "معطل"}
                                />
                              </div>

                              <div className="text-xs text-[#5B6470] space-y-1">
                                <div className="flex items-center gap-1 font-mono dir-ltr">
                                  <Clock className="w-3 h-3 text-[#5B6470]" />
                                  <span>
                                    {schedule.startTime} - {schedule.endTime}
                                  </span>
                                </div>
                                <div className="truncate">
                                  المدرب: <strong className="text-[#14181F]">{schedule.coach?.name || "بدون"}</strong>
                                </div>
                                <div className="flex items-center justify-between text-[11px] pt-1">
                                  <span>السعة: {schedule.capacity}</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedScheduleForMembers({
                                        id: schedule.id,
                                        name: schedule.name,
                                        capacity: schedule.capacity,
                                        registeredCount: regCount,
                                        members: schedule.members,
                                      });
                                      setIsMembersDialogOpen(true);
                                    }}
                                    className="text-[#4D6B00] hover:underline font-bold"
                                  >
                                    مسجل ({regCount})
                                  </button>
                                </div>
                              </div>

                              {/* Card Action footer (Admin only) */}
                              {isAdmin && (
                                <div className="pt-2 border-t border-[#E1E5DF] flex items-center justify-between gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setScheduleToEdit(schedule);
                                      setIsScheduleDialogOpen(true);
                                    }}
                                    className="p-1 rounded hover:bg-[#F6F8F5] text-[#5B6470] hover:text-[#14181F] transition-colors"
                                    title="تعديل الموعد"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedScheduleForException({
                                        id: schedule.id,
                                        name: schedule.name,
                                        coach: schedule.coach,
                                        startTime: schedule.startTime,
                                        endTime: schedule.endTime,
                                      });
                                      setIsExceptionDialogOpen(true);
                                    }}
                                    className="p-1 rounded hover:bg-amber-50 text-amber-600 hover:text-amber-700 transition-colors"
                                    title="إضافة استثناء لتاريخ معين"
                                  >
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => handleToggleScheduleActive(schedule)}
                                    className={`p-1 rounded transition-colors ${
                                      schedule.isActive
                                        ? "text-red-500 hover:bg-red-50"
                                        : "text-emerald-600 hover:bg-emerald-50"
                                    }`}
                                    title={schedule.isActive ? "تعطيل الموعد" : "تفعيل الموعد"}
                                  >
                                    <Power className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })
                      )}
                    </div>

                    {/* Quick Add Button per day (Admin only) */}
                    {isAdmin && (
                      <div className="pt-3 mt-3 border-t border-[#E1E5DF]">
                        <button
                          type="button"
                          onClick={() => {
                            setScheduleToEdit(null);
                            setDefaultScheduleDay(dayOfWeek);
                            setIsScheduleDialogOpen(true);
                          }}
                          className="w-full py-2 px-3 text-xs font-semibold text-[#5B6470] hover:text-[#14181F] bg-white hover:bg-[#E1E5DF]/50 border border-dashed border-[#E1E5DF] rounded-xl transition-all flex items-center justify-center gap-1.5"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>إضافة موعد</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* DIALOGS */}
      {isScheduleDialogOpen && (
        <ClassScheduleDialog
          isOpen={isScheduleDialogOpen}
          onClose={() => {
            setIsScheduleDialogOpen(false);
            setScheduleToEdit(null);
          }}
          onSuccess={() => {
            fetchData();
          }}
          scheduleToEdit={scheduleToEdit}
          defaultDayOfWeek={defaultScheduleDay}
        />
      )}

      {isExceptionDialogOpen && (
        <ClassExceptionDialog
          isOpen={isExceptionDialogOpen}
          onClose={() => {
            setIsExceptionDialogOpen(false);
            setSelectedScheduleForException(null);
          }}
          onSuccess={() => {
            fetchData();
          }}
          schedule={selectedScheduleForException}
        />
      )}

      {isMembersDialogOpen && (
        <RegisteredMembersDialog
          isOpen={isMembersDialogOpen}
          onClose={() => {
            setIsMembersDialogOpen(false);
            setSelectedScheduleForMembers(null);
          }}
          schedule={selectedScheduleForMembers}
        />
      )}
    </div>
  );
}
