"use client";

import React, { useEffect, useState } from "react";
import {
  Settings,
  CreditCard,
  CalendarDays,
  Bell,
  Dumbbell,
  Globe,
  Save,
  RefreshCw,
  Plus,
  X,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { Button, useToast } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import Link from "next/link";
import { settingsApi, type GymSettings } from "../../../features/settings/api";
import { useShift } from "../../../lib/shift-context";

export default function SettingsPage() {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const { toast } = useToast();
  const { currentUser } = useShift();
  const isAdmin =
    currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN";

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<GymSettings | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [minUpfront, setMinUpfront] = useState(50);
  const [dueAfterDays, setDueAfterDays] = useState<number | "">(30);
  const [dueAfterPercent, setDueAfterPercent] = useState<number | "">("");
  const [manualDiscountLimit, setManualDiscountLimit] = useState(10);
  const [classEntryMode, setClassEntryMode] = useState<"RECEPTION_STARTS" | "SCHEDULED">("RECEPTION_STARTS");
  const [classCheckinEarlyMinutes, setClassCheckinEarlyMinutes] = useState(15);
  const [expiryNotifyDays, setExpiryNotifyDays] = useState<number[]>([7, 3, 1]);
  const [newDayInput, setNewDayInput] = useState("");
  const [maxCoachBreaks, setMaxCoachBreaks] = useState(2);
  const [coachBreakDuration, setCoachBreakDuration] = useState(30);
  const [freeSessionsOnFitnessProfile, setFreeSessionsOnFitnessProfile] = useState(1);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await settingsApi.getSettings();
      setSettings(data);
      setName(data.name || "");
      setTimezone(data.timezone || "Africa/Cairo");
      setMinUpfront(data.defaultMinUpfrontPercent ?? 50);
      setDueAfterDays(data.defaultDueAfterDays ?? 30);
      setDueAfterPercent(data.defaultDueAfterPercent ?? "");
      setManualDiscountLimit(data.manualDiscountLimitPercent ?? 10);
      setClassEntryMode(data.classEntryMode || "RECEPTION_STARTS");
      setClassCheckinEarlyMinutes(data.classCheckinEarlyMinutes ?? 15);
      setExpiryNotifyDays(data.expiryNotifyDays || [7, 3, 1]);
      setMaxCoachBreaks(data.maxCoachBreaksPerDay ?? 2);
      setCoachBreakDuration(data.coachBreakDurationMinutes ?? 30);
      setFreeSessionsOnFitnessProfile(data.freeSessionsOnFitnessProfile ?? 1);
    } catch (err: any) {
      toast({
        title: "تعذر تحميل إعدادات الجيم",
        description: err?.message || "حدث خطأ أثناء تحميل البيانات",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleSaveCard = async (sectionName: string, patch: any) => {
    setIsSaving(true);
    try {
      const updated = await settingsApi.updateSettings(patch);
      setSettings(updated);
      toast({
        title: t("settings.saveSuccess"),
        description: `تم حفظ ${sectionName} بنجاح`,
        variant: "success",
      });
    } catch (err: any) {
      toast({
        title: "تعذر حفظ الإعدادات",
        description: err?.message || "يرجى التحقق من القيم المدخلة",
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddExpiryDay = () => {
    const val = parseInt(newDayInput.trim(), 10);
    if (!isNaN(val) && val > 0 && !expiryNotifyDays.includes(val)) {
      const updated = [...expiryNotifyDays, val].sort((a, b) => b - a);
      setExpiryNotifyDays(updated);
      setNewDayInput("");
    }
  };

  const handleRemoveExpiryDay = (day: number) => {
    setExpiryNotifyDays(expiryNotifyDays.filter((d) => d !== day));
  };

  if (currentUser && !isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 pt-16" dir={isRtl ? "rtl" : "ltr"}>
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl space-y-3 shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
          <h2 className="text-lg font-black text-red-900">
            {isRtl ? "غير مصرح بالدخول" : "Unauthorized Access"}
          </h2>
          <p className="text-xs text-red-700 leading-relaxed font-medium">
            {isRtl
              ? "صفحة إعدادات الجيم وسياسات الدفع والحصص مخصصة لمدير النادي فقط (GYM_ADMIN / SUPER_ADMIN)."
              : "Gym settings & business configuration is restricted to administrators."}
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

  if (isLoading) {
    return (
      <div className="py-24 text-center text-[#5B6470]">
        <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#4D6B00] mb-2" />
        <p className="text-sm">جاري تحميل إعدادات الجيم...</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E1E5DF]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-[#14181F]">
              {t("settings.title")}
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-[#C6F24E] text-[#14181F]">
              {settings?.slug}
            </span>
          </div>
          <p className="text-sm text-[#5B6470] mt-1">{t("settings.description")}</p>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={fetchSettings}
          disabled={isLoading || isSaving}
          className="flex items-center gap-1.5"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          <span>تحديث الإعدادات</span>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* CARD 1: Payments & Installments */}
        <div className="p-6 bg-white border border-[#E1E5DF] rounded-2xl space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E1E5DF]">
              <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#14181F] text-base">
                  {t("settings.paymentsCard")}
                </h3>
                <p className="text-xs text-[#5B6470]">{t("settings.paymentsDesc")}</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.minUpfront")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={minUpfront}
                    onChange={(e) => setMinUpfront(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                  />
                  <span className="font-bold text-[#5B6470]">%</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.dueAfterDays")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={dueAfterDays}
                  onChange={(e) =>
                    setDueAfterDays(e.target.value ? Number(e.target.value) : "")
                  }
                  placeholder="30 يوم مثلاً"
                  className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.dueAfterPercent")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={dueAfterPercent}
                    onChange={(e) =>
                      setDueAfterPercent(e.target.value ? Number(e.target.value) : "")
                    }
                    placeholder="اختياري (مثلاً: 50%)"
                    className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                  />
                  <span className="font-bold text-[#5B6470]">%</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.manualDiscountLimit")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={manualDiscountLimit}
                    onChange={(e) => setManualDiscountLimit(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                  />
                  <span className="font-bold text-[#5B6470]">%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E1E5DF] flex justify-end">
            <Button
              variant="lime"
              size="sm"
              disabled={isSaving}
              onClick={() =>
                handleSaveCard("إعدادات المدفوعات والتقسيط", {
                  defaultMinUpfrontPercent: minUpfront,
                  defaultDueAfterDays: dueAfterDays === "" ? null : dueAfterDays,
                  defaultDueAfterPercent: dueAfterPercent === "" ? null : dueAfterPercent,
                  manualDiscountLimitPercent: manualDiscountLimit,
                })
              }
              className="font-bold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{t("settings.saveCard")}</span>
            </Button>
          </div>
        </div>

        {/* CARD 2: Classes Entry Mode */}
        <div className="p-6 bg-white border border-[#E1E5DF] rounded-2xl space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E1E5DF]">
              <div className="p-2 rounded-xl bg-amber-50 text-amber-700">
                <CalendarDays className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#14181F] text-base">
                  {t("settings.classesCard")}
                </h3>
                <p className="text-xs text-[#5B6470]">{t("settings.classesDesc")}</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <div>
                <label className="font-semibold text-[#14181F] block mb-2">
                  {t("settings.classEntryMode")}
                </label>
                <div className="space-y-2">
                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      classEntryMode === "RECEPTION_STARTS"
                        ? "border-[#14181F] bg-[#F6F8F5] ring-1 ring-[#14181F]"
                        : "border-[#E1E5DF] hover:bg-[#F6F8F5]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="classEntryMode"
                      value="RECEPTION_STARTS"
                      checked={classEntryMode === "RECEPTION_STARTS"}
                      onChange={() => setClassEntryMode("RECEPTION_STARTS")}
                      className="mt-0.5 accent-[#14181F]"
                    />
                    <div>
                      <span className="font-bold text-[#14181F] block text-xs">
                        بدء الحصة يدوياً (RECEPTION_STARTS)
                      </span>
                      <span className="text-[11px] text-[#5B6470] mt-0.5 block leading-relaxed">
                        لا يُسمح للمشتركين بالدخول إلا بعد أن يقوم موظف الاستقبال أو المدرب بالنقر على "بدء الحصة" في النظام.
                      </span>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                      classEntryMode === "SCHEDULED"
                        ? "border-[#14181F] bg-[#F6F8F5] ring-1 ring-[#14181F]"
                        : "border-[#E1E5DF] hover:bg-[#F6F8F5]"
                    }`}
                  >
                    <input
                      type="radio"
                      name="classEntryMode"
                      value="SCHEDULED"
                      checked={classEntryMode === "SCHEDULED"}
                      onChange={() => setClassEntryMode("SCHEDULED")}
                      className="mt-0.5 accent-[#14181F]"
                    />
                    <div>
                      <span className="font-bold text-[#14181F] block text-xs">
                        مجدول تلقائياً (SCHEDULED)
                      </span>
                      <span className="text-[11px] text-[#5B6470] mt-0.5 block leading-relaxed">
                        تفتح البوابة تلقائياً للأعضاء المسجلين في الحصة أثناء وقت الحصة المسجل في الجدول ودقائق الدخول المبكر دون الحاجة لبدء يدوي.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Shown ONLY in SCHEDULED mode */}
              {classEntryMode === "SCHEDULED" && (
                <div className="p-3 bg-amber-50/50 border border-amber-200 rounded-xl space-y-2 animate-in fade-in-50 duration-200">
                  <label className="font-semibold text-[#14181F] block">
                    {t("settings.classCheckinEarlyMinutes")}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      max="120"
                      value={classCheckinEarlyMinutes}
                      onChange={(e) => setClassCheckinEarlyMinutes(Number(e.target.value))}
                      className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-sm font-bold"
                    />
                    <span className="font-bold text-[#5B6470]">دقيقة</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#E1E5DF] flex justify-end">
            <Button
              variant="lime"
              size="sm"
              disabled={isSaving}
              onClick={() =>
                handleSaveCard("إعدادات دخول الحصص", {
                  classEntryMode,
                  classCheckinEarlyMinutes,
                })
              }
              className="font-bold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{t("settings.saveCard")}</span>
            </Button>
          </div>
        </div>

        {/* CARD 3: Notifications & Expiry Days */}
        <div className="p-6 bg-white border border-[#E1E5DF] rounded-2xl space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E1E5DF]">
              <div className="p-2 rounded-xl bg-blue-50 text-blue-700">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#14181F] text-base">
                  {t("settings.notificationsCard")}
                </h3>
                <p className="text-xs text-[#5B6470]">{t("settings.notificationsDesc")}</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <div>
                <label className="font-semibold text-[#14181F] block mb-2">
                  {t("settings.expiryNotifyDays")}
                </label>
                <div className="flex flex-wrap items-center gap-2 p-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl min-h-[50px]">
                  {expiryNotifyDays.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white border border-[#E1E5DF] text-[#14181F] shadow-xs"
                    >
                      <span>قبل {d} يوم</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveExpiryDay(d)}
                        className="text-[#5B6470] hover:text-red-600 cursor-pointer"
                        title="حذف"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </span>
                  ))}

                  <div className="flex items-center gap-1.5 ms-auto">
                    <input
                      type="number"
                      min="1"
                      max="90"
                      value={newDayInput}
                      onChange={(e) => setNewDayInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddExpiryDay();
                        }
                      }}
                      placeholder="عدد الأيام..."
                      className="w-24 h-8 px-2 text-xs bg-white border border-[#E1E5DF] rounded-lg"
                    />
                    <button
                      type="button"
                      onClick={handleAddExpiryDay}
                      className="h-8 px-2.5 text-xs font-bold bg-[#14181F] text-white rounded-lg hover:bg-black transition-colors"
                    >
                      {t("settings.addDay")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E1E5DF] flex justify-end">
            <Button
              variant="lime"
              size="sm"
              disabled={isSaving}
              onClick={() =>
                handleSaveCard("إعدادات تنبيهات انتهاء الاشتراكات", {
                  expiryNotifyDays,
                })
              }
              className="font-bold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{t("settings.saveCard")}</span>
            </Button>
          </div>
        </div>

        {/* CARD 4: Coaches & Break Policies */}
        <div className="p-6 bg-white border border-[#E1E5DF] rounded-2xl space-y-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E1E5DF]">
              <div className="p-2 rounded-xl bg-purple-50 text-purple-700">
                <Dumbbell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#14181F] text-base">
                  {t("settings.coachesCard")}
                </h3>
                <p className="text-xs text-[#5B6470]">{t("settings.coachesDesc")}</p>
              </div>
            </div>

            <div className="space-y-4 pt-4 text-xs">
              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.maxCoachBreaks")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="10"
                  value={maxCoachBreaks}
                  onChange={(e) => setMaxCoachBreaks(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.coachBreakDuration")}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={coachBreakDuration}
                    onChange={(e) => setCoachBreakDuration(Number(e.target.value))}
                    className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                  />
                  <span className="font-bold text-[#5B6470]">دقيقة</span>
                </div>
              </div>

              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.freeSessionsOnFitnessProfile")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="5"
                  value={freeSessionsOnFitnessProfile}
                  onChange={(e) => setFreeSessionsOnFitnessProfile(Number(e.target.value))}
                  className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E1E5DF] flex justify-end">
            <Button
              variant="lime"
              size="sm"
              disabled={isSaving}
              onClick={() =>
                handleSaveCard("إعدادات استراحات المدربين", {
                  maxCoachBreaksPerDay: maxCoachBreaks,
                  coachBreakDurationMinutes: coachBreakDuration,
                  freeSessionsOnFitnessProfile,
                })
              }
              className="font-bold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{t("settings.saveCard")}</span>
            </Button>
          </div>
        </div>

        {/* CARD 5: General & Timezone */}
        <div className="p-6 bg-white border border-[#E1E5DF] rounded-2xl space-y-4 shadow-xs md:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-[#E1E5DF]">
              <div className="p-2 rounded-xl bg-slate-100 text-slate-800">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-[#14181F] text-base">
                  {t("settings.generalCard")}
                </h3>
                <p className="text-xs text-[#5B6470]">البيانات الأساسية للنادي والمنطقة الزمنية</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 text-xs">
              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.gymName")}
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                />
              </div>

              <div>
                <label className="font-semibold text-[#14181F] block mb-1">
                  {t("settings.timezone")}
                </label>
                <select
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  className="w-full h-10 px-3 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl text-sm font-bold"
                >
                  <option value="Africa/Cairo">Africa/Cairo (توقيت القاهرة - GMT+2 / GMT+3)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (توقيت الرياض - GMT+3)</option>
                  <option value="Asia/Dubai">Asia/Dubai (توقيت دبي - GMT+4)</option>
                  <option value="UTC">UTC (التوقيت العالمي الموحد)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#E1E5DF] flex justify-end">
            <Button
              variant="lime"
              size="sm"
              disabled={isSaving}
              onClick={() =>
                handleSaveCard("البيانات العامة والمنطقة الزمنية", {
                  name,
                  timezone,
                })
              }
              className="font-bold flex items-center gap-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{t("settings.saveCard")}</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

