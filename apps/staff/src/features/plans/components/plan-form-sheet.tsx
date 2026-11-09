"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import {
  Layers,
  Sparkles,
  AlertCircle,
  Info,
  DollarSign,
  Clock,
  Dumbbell,
  Snowflake,
  Percent,
} from "lucide-react";
import { Sheet, Button } from "@gym/ui";
import { plansApi } from "../api";
import type { Plan, Service, CreatePlanDto, UpdatePlanDto } from "@gym/contracts";

interface PlanFormSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (savedPlan: Plan) => void;
  planToEdit?: Plan | null;
}

interface FormValues {
  name: string;
  kind: "GYM" | "PT" | "CLASS";
  priceEgp: number | string;
  durationDays: number;
  grantsFloorAccess: boolean;
  totalSessions: number | string;
  sessionsPerWeek: number | string;
  freezeMaxCount: number;
  freezeMaxTotalDays: number;
  minUpfrontPercent: number | string;
  dueAfterDays: number | string;
  dueAfterPercent: number | string;
  maxInvitations: number;
  freePtSessions: number;
  commissionable: boolean;
  commissionMilestones: number;
  isActive: boolean;
  includedServices: { serviceId: string; quantity: number | string }[];
}

export function PlanFormSheet({
  isOpen,
  onClose,
  onSuccess,
  planToEdit,
}: PlanFormSheetProps) {
  const isEditing = Boolean(planToEdit);
  const [gymDefaultUpfront, setGymDefaultUpfront] = useState<number>(30);
  const [servicesList, setServicesList] = useState<Service[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      name: "",
      kind: "GYM",
      priceEgp: "",
      durationDays: 30,
      grantsFloorAccess: true,
      totalSessions: "",
      sessionsPerWeek: "",
      freezeMaxCount: 0,
      freezeMaxTotalDays: 0,
      minUpfrontPercent: "",
      dueAfterDays: "",
      dueAfterPercent: "",
      maxInvitations: 0,
      freePtSessions: 0,
      commissionable: false,
      commissionMilestones: 1,
      isActive: true,
      includedServices: [],
    },
  });

  // Load gym defaults and services list
  useEffect(() => {
    plansApi.getGymSettings().then((settings) => {
      if (settings?.defaultMinUpfrontPercent !== undefined) {
        setGymDefaultUpfront(Number(settings.defaultMinUpfrontPercent));
      }
    });
    plansApi.listServices().then((s) => setServicesList(s));
  }, []);

  // Sync initial values when planToEdit changes or dialog opens
  useEffect(() => {
    if (planToEdit) {
      reset({
        name: planToEdit.name,
        kind: planToEdit.kind,
        priceEgp: (planToEdit.price / 100).toString(),
        durationDays: planToEdit.durationDays,
        grantsFloorAccess: planToEdit.grantsFloorAccess,
        totalSessions: planToEdit.totalSessions !== null ? planToEdit.totalSessions.toString() : "",
        sessionsPerWeek: planToEdit.sessionsPerWeek !== null ? planToEdit.sessionsPerWeek.toString() : "",
        freezeMaxCount: planToEdit.freezeMaxCount || 0,
        freezeMaxTotalDays: planToEdit.freezeMaxTotalDays || 0,
        minUpfrontPercent: planToEdit.minUpfrontPercent !== null && planToEdit.minUpfrontPercent !== undefined ? planToEdit.minUpfrontPercent.toString() : "",
        dueAfterDays: planToEdit.dueAfterDays !== null && planToEdit.dueAfterDays !== undefined ? planToEdit.dueAfterDays.toString() : "",
        dueAfterPercent: planToEdit.dueAfterPercent !== null && planToEdit.dueAfterPercent !== undefined ? planToEdit.dueAfterPercent.toString() : "",
        maxInvitations: planToEdit.maxInvitations || 0,
        freePtSessions: planToEdit.freePtSessions || 0,
        commissionable: planToEdit.commissionable,
        commissionMilestones: planToEdit.commissionMilestones || 1,
        isActive: planToEdit.isActive,
        includedServices: planToEdit.includedServices
          ? planToEdit.includedServices.map((is) => ({
              serviceId: is.serviceId,
              quantity: is.quantity !== null && is.quantity !== undefined ? is.quantity.toString() : "",
            }))
          : [],
      });
    } else {
      reset({
        name: "",
        kind: "GYM",
        priceEgp: "",
        durationDays: 30,
        grantsFloorAccess: true,
        totalSessions: "",
        sessionsPerWeek: "",
        freezeMaxCount: 0,
        freezeMaxTotalDays: 0,
        minUpfrontPercent: "",
        dueAfterDays: "",
        dueAfterPercent: "",
        maxInvitations: 0,
        freePtSessions: 0,
        commissionable: false,
        commissionMilestones: 1,
        isActive: true,
        includedServices: [],
      });
    }
    setServerError(null);
  }, [planToEdit, reset, isOpen]);

  // Watched fields for dynamic calculations and hints
  const currentKind = watch("kind");
  const currentDurationDays = Number(watch("durationDays")) || 30;
  const currentPriceEgp = Number(watch("priceEgp")) || 0;
  const currentFreezeCount = Number(watch("freezeMaxCount")) || 0;
  const currentFreezeDays = Number(watch("freezeMaxTotalDays")) || 0;
  const currentDueDays = watch("dueAfterDays");
  const currentDuePercent = watch("dueAfterPercent");
  const currentMilestones = Number(watch("commissionMilestones")) || 1;

  // Keep floorAccess default in sync with kind changes for new plans
  const handleKindChange = (newKind: "GYM" | "PT" | "CLASS") => {
    setValue("kind", newKind);
    if (!isEditing) {
      if (newKind === "PT") {
        setValue("grantsFloorAccess", false);
        setValue("commissionable", true);
      } else {
        setValue("grantsFloorAccess", true);
        setValue("commissionable", false);
      }
    }
  };

  // Max commission milestones = max(1, ceil(durationDays / 30))
  const maxMilestonesAllowed = useMemo(() => {
    return Math.max(1, Math.ceil(currentDurationDays / 30));
  }, [currentDurationDays]);

  // Live Commission Preview
  const commissionPreview = useMemo(() => {
    if (currentPriceEgp <= 0 || currentMilestones <= 0) return null;
    const payoutPerMilestone = Math.round(currentPriceEgp / currentMilestones);
    return `${currentPriceEgp.toLocaleString()} ج.م ← ${currentMilestones} دفعات × ${payoutPerMilestone.toLocaleString()} ج.م`;
  }, [currentPriceEgp, currentMilestones]);

  // Live Suspension Sentence
  const suspensionSentence = useMemo(() => {
    const days = currentDueDays !== "" && currentDueDays !== undefined ? Number(currentDueDays) : null;
    const pct = currentDuePercent !== "" && currentDuePercent !== undefined ? Number(currentDuePercent) : null;

    if (days !== null && days > 0) {
      return `يتوقف الاشتراك تلقائياً بعد ${days} يوم من البداية إذا بقي متبقي غير مسدد.`;
    }
    if (pct !== null && pct > 0) {
      const calculatedDays = Math.round((currentDurationDays * pct) / 100);
      return `يتوقف الاشتراك تلقائياً بعد ${calculatedDays} يوم (${pct}% من المدة) إذا بقي متبقي غير مسدد.`;
    }
    return "لا يتم إيقاف الاشتراك تلقائياً إذا بقي متبقي (يظل نشطاً مع احتساب المديونية).";
  }, [currentDueDays, currentDuePercent, currentDurationDays]);

  const onSubmit = async (data: FormValues) => {
    setIsSubmitting(true);
    setServerError(null);

    // Consistency check on freeze
    const fCount = Number(data.freezeMaxCount) || 0;
    const fDays = Number(data.freezeMaxTotalDays) || 0;
    if ((fCount === 0 && fDays > 0) || (fCount > 0 && fDays === 0)) {
      setError("freezeMaxCount", {
        type: "manual",
        message: "يجب تحديد عدد المرات وإجمالي الأيام معاً، أو تعيينهما بـ 0 لتعطيل التجميد",
      });
      setIsSubmitting(false);
      return;
    }

    // Convert EGP to Minor piasters
    const pricePiasters = Math.round(Number(data.priceEgp) * 100);

    const payload: CreatePlanDto = {
      name: data.name.trim(),
      kind: data.kind,
      price: pricePiasters,
      durationDays: Number(data.durationDays),
      grantsFloorAccess: data.grantsFloorAccess,
      totalSessions: data.totalSessions !== "" && data.totalSessions !== undefined ? Number(data.totalSessions) : null,
      sessionsPerWeek: data.kind === "CLASS" ? (data.sessionsPerWeek !== "" ? Number(data.sessionsPerWeek) : 1) : null,
      freezeMaxCount: fCount,
      freezeMaxTotalDays: fDays,
      minUpfrontPercent: data.minUpfrontPercent !== "" && data.minUpfrontPercent !== undefined ? Number(data.minUpfrontPercent) : null,
      dueAfterDays: data.dueAfterDays !== "" && data.dueAfterDays !== undefined ? Number(data.dueAfterDays) : null,
      dueAfterPercent: data.dueAfterPercent !== "" && data.dueAfterPercent !== undefined ? Number(data.dueAfterPercent) : null,
      maxInvitations: Number(data.maxInvitations) || 0,
      freePtSessions: Number(data.freePtSessions) || 0,
      commissionable: data.kind === "PT" ? data.commissionable : false,
      commissionMilestones: data.kind === "PT" ? Number(data.commissionMilestones) || 1 : 1,
      isActive: data.isActive,
      includedServices: data.includedServices
        .filter((s) => s.serviceId)
        .map((s) => ({
          serviceId: s.serviceId,
          quantity: s.quantity !== "" && s.quantity !== undefined ? Number(s.quantity) : null,
        })),
    };

    try {
      let saved: Plan;
      if (isEditing && planToEdit) {
        saved = await plansApi.updatePlan(planToEdit.id, payload as UpdatePlanDto);
      } else {
        saved = await plansApi.createPlan(payload);
      }
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      console.error("Plan save error:", err);
      if (err?.code === "INVALID_PLAN" && err?.response?.details?.fields) {
        const fields: string[] = err.response.details.fields;
        fields.forEach((field) => {
          if (field === "commissionMilestones") {
            setError("commissionMilestones", {
              type: "server",
              message: `عدد دفعات العمولة يتجاوز الحد الأقصى لأشهر الباقة (${maxMilestonesAllowed})`,
            });
          } else if (field === "freezePolicy") {
            setError("freezeMaxCount", {
              type: "server",
              message: "سياسة التجميد غير متطابقة (يجب تحديد المرات والأيام معاً)",
            });
          } else if (field === "durationDays") {
            setError("durationDays", {
              type: "server",
              message: "مدة الباقة بالأيام غير صالحة",
            });
          } else if (field === "price") {
            setError("priceEgp", {
              type: "server",
              message: "سعر الباقة غير صالح",
            });
          } else if (field === "sessionsPerWeek") {
            setError("sessionsPerWeek", {
              type: "server",
              message: "عدد الحصص الأسبوعية مطلوب لباقات الـ CLASS",
            });
          }
        });
        setServerError("فشل التحقق من بيانات الباقة من السيرفر. يرجى مراجعة الحقول المحددة بالأحمر.");
      } else {
        setServerError(err?.message || "حدث خطأ أثناء حفظ الباقة.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleService = (serviceId: string) => {
    const current = watch("includedServices") || [];
    const exists = current.some((s) => s.serviceId === serviceId);
    if (exists) {
      setValue(
        "includedServices",
        current.filter((s) => s.serviceId !== serviceId)
      );
    } else {
      setValue("includedServices", [...current, { serviceId, quantity: "" }]);
    }
  };

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      side="end"
      size="xl"
      title={
        <div className="flex items-center gap-2.5 text-[#14181F]">
          <Layers className="h-6 w-6 text-[#14181F]" />
          <span>{isEditing ? "تعديل باقة اشتراك" : "إنشاء باقة اشتراك جديدة"}</span>
        </div>
      }
      description={
        isEditing
          ? "تعديل بنود وسياسات الباقة. تنبيه: لن تتأثر الاشتراكات الحالية المباعة مسبقاً بهذا التعديل."
          : "حدد نوع الباقة، السعر، مدة الصلاحية، سياسات التجميد والتقسيط والعمولات."
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 pt-2" dir="rtl">
        {serverError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{serverError}</span>
          </div>
        )}

        {/* 1. Basics */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-4">
          <h3 className="text-sm font-bold text-[#14181F] flex items-center gap-2 pb-2 border-b border-[#E1E5DF]">
            <Sparkles className="h-4 w-4 text-[#C6F24E]" />
            <span>البيانات الأساسية</span>
          </h3>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">
                اسم الباقة <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                {...register("name", { required: "اسم الباقة مطلوب" })}
                placeholder="مثال: اشتراك 3 شهور صالة حديد"
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-medium text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
              {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name.message}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-[#5B6470] mb-1">نوع الباقة</label>
                <select
                  value={currentKind}
                  disabled={isEditing}
                  onChange={(e) => handleKindChange(e.target.value as any)}
                  className="w-full px-3 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
                >
                  <option value="GYM">جيم صالة (GYM)</option>
                  <option value="PT">تدريب خاص (PT)</option>
                  <option value="CLASS">حصص جماعية (CLASS)</option>
                </select>
                {isEditing && (
                  <p className="text-[11px] text-[#5B6470] mt-0.5">نوع الباقة لا يمكن تغييره بعد الإنشاء.</p>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5B6470] mb-1">
                  السعر (ج.م) <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="any"
                    {...register("priceEgp", {
                      required: "السعر مطلوب",
                      min: { value: 0, message: "السعر يجب أن يكون 0 أو أكثر" },
                    })}
                    placeholder="1500"
                    className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
                  />
                  <span className="absolute end-3 top-2.5 text-xs text-[#5B6470] font-bold">ج.م</span>
                </div>
                {errors.priceEgp && <p className="text-xs text-red-500 mt-1">{errors.priceEgp.message}</p>}
              </div>

              <div>
                <label className="block text-xs font-bold text-[#5B6470] mb-1">
                  المدة (بالأيام) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  {...register("durationDays", {
                    required: "المدة بالأيام مطلوبة",
                    min: { value: 1, message: "المدة يجب أن تكون يوماً واحداً على الأقل" },
                  })}
                  placeholder="30"
                  className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
                />
                {errors.durationDays && <p className="text-xs text-red-500 mt-1">{errors.durationDays.message}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  {...register("isActive")}
                  className="w-4 h-4 rounded border-gray-300 text-[#14181F] focus:ring-0"
                />
                <span className="text-xs font-bold text-[#14181F]">باقة نشطة (تظهر في شاشة البيع)</span>
              </label>
            </div>
          </div>
        </div>

        {/* 2. Access */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-3">
          <h3 className="text-sm font-bold text-[#14181F] flex items-center gap-2 pb-2 border-b border-[#E1E5DF]">
            <Dumbbell className="h-4 w-4 text-[#14181F]" />
            <span>صلاحية دخول الصالة (Turnstile Floor Access)</span>
          </h3>

          <div className="flex items-start gap-3">
            <input
              type="checkbox"
              id="grantsFloorAccess"
              {...register("grantsFloorAccess")}
              className="mt-1 w-4 h-4 rounded border-gray-300 text-[#14181F] focus:ring-0"
            />
            <div>
              <label htmlFor="grantsFloorAccess" className="text-xs font-bold text-[#14181F] cursor-pointer">
                تتيح دخول صالة الجيم العامة
              </label>
              <p className="text-[11px] text-[#5B6470] mt-0.5 leading-relaxed">
                مفعلة تلقائياً لباقات الجيم والحصص. بالنسبة لتدريب الـ PT، إذا كانت غير مفعلة، فلن تفتح البوابة
                إلا إذا كان لدى العضو اشتراك صالة آخر نشط.
              </p>
            </div>
          </div>
        </div>

        {/* 3. Sessions */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-3">
          <h3 className="text-sm font-bold text-[#14181F] flex items-center gap-2 pb-2 border-b border-[#E1E5DF]">
            <Clock className="h-4 w-4 text-[#14181F]" />
            <span>الجلسات والحصص</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">
                إجمالي الجلسات (totalSessions)
              </label>
              <input
                type="number"
                {...register("totalSessions")}
                placeholder="اتركه فارغاً = غير محدود"
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
              <p className="text-[11px] text-[#5B6470] mt-1">
                اتركه فارغاً لاشتراكات الجيم المفتوحة، أو حدد عدداً محدداً (مثل 12 جلسة PT).
              </p>
            </div>

            {currentKind === "CLASS" && (
              <div>
                <label className="block text-xs font-bold text-[#5B6470] mb-1">
                  الحصص في الأسبوع (sessionsPerWeek) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  {...register("sessionsPerWeek", {
                    required: currentKind === "CLASS" ? "مطلوب لباقات الحصص" : false,
                    min: { value: 1, message: "يجب ألا تقل عن حصة واحدة أسبوعياً" },
                  })}
                  placeholder="3"
                  className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
                />
                {errors.sessionsPerWeek && (
                  <p className="text-xs text-red-500 mt-1">{errors.sessionsPerWeek.message}</p>
                )}
                <p className="text-[11px] text-[#5B6470] mt-1">يحدد عدد المرات المسموح للعضو بحجز حصة فيها أسبوعياً.</p>
              </div>
            )}
          </div>
        </div>

        {/* 4. Freeze Policy */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-3">
          <h3 className="text-sm font-bold text-[#14181F] flex items-center justify-between pb-2 border-b border-[#E1E5DF]">
            <div className="flex items-center gap-2">
              <Snowflake className="h-4 w-4 text-blue-500" />
              <span>سياسة التجميد (Freeze Policy)</span>
            </div>
            {currentFreezeCount === 0 || currentFreezeDays === 0 ? (
              <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-md">
                التجميد غير متاح
              </span>
            ) : (
              <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md">
                {currentFreezeDays} يوم على {currentFreezeCount} مرات
              </span>
            )}
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">أقصى عدد مرات تجميد</label>
              <input
                type="number"
                min="0"
                {...register("freezeMaxCount", {
                  valueAsNumber: true,
                  onChange: (e) => {
                    if (Number(e.target.value) === 0) {
                      setValue("freezeMaxTotalDays", 0);
                    }
                  },
                })}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
              {errors.freezeMaxCount && (
                <p className="text-xs text-red-500 mt-1">{errors.freezeMaxCount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">إجمالي أيام التجميد المسموحة</label>
              <input
                type="number"
                min="0"
                {...register("freezeMaxTotalDays", {
                  valueAsNumber: true,
                  onChange: (e) => {
                    if (Number(e.target.value) === 0) {
                      setValue("freezeMaxCount", 0);
                    }
                  },
                })}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
            </div>
          </div>
          <p className="text-[11px] text-[#5B6470]">
            إذا كانت إحدى القيمتين 0 فسيتم تعطيل التجميد تماماً لهذه الباقة.
          </p>
        </div>

        {/* 5. Payment Policy */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-3">
          <h3 className="text-sm font-bold text-[#14181F] flex items-center gap-2 pb-2 border-b border-[#E1E5DF]">
            <DollarSign className="h-4 w-4 text-emerald-600" />
            <span>سياسة الدفع والتعليق عند التأخر</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">
                الحد الأدنى للدفعة الأولى (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                {...register("minUpfrontPercent")}
                placeholder={`الافتراضي (${gymDefaultUpfront}%)`}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
              <p className="text-[11px] text-[#5B6470] mt-1">اتركه فارغاً لاستخدام الإعداد العام للجيم.</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">
                إيقاف بعد (أيام)
              </label>
              <input
                type="number"
                min="0"
                {...register("dueAfterDays")}
                placeholder="مثال: 45"
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">
                إيقاف بعد (% من المدة)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                {...register("dueAfterPercent")}
                placeholder="مثال: 50"
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
            </div>
          </div>

          <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-xs text-emerald-800 font-medium flex items-center gap-2">
            <Info className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{suspensionSentence}</span>
          </div>
        </div>

        {/* 6. Perks */}
        <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-3">
          <h3 className="text-sm font-bold text-[#14181F] flex items-center gap-2 pb-2 border-b border-[#E1E5DF]">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <span>المزايا المضمنة (Perks)</span>
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">دعوات زوار مجانية (Invitations)</label>
              <input
                type="number"
                min="0"
                {...register("maxInvitations", { valueAsNumber: true })}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">جلسات PT مجانية مع الاشتراك</label>
              <input
                type="number"
                min="0"
                {...register("freePtSessions", { valueAsNumber: true })}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
            </div>
          </div>

          {servicesList.length > 0 && (
            <div className="pt-2">
              <label className="block text-xs font-bold text-[#5B6470] mb-2">خدمات أخرى مضمنة بالباقة:</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {servicesList.map((service) => {
                  const currentInc = watch("includedServices") || [];
                  const isSelected = currentInc.some((s) => s.serviceId === service.id);
                  const selectedItem = currentInc.find((s) => s.serviceId === service.id);

                  return (
                    <div
                      key={service.id}
                      className={`p-2.5 rounded-xl border transition-all flex items-center justify-between ${
                        isSelected
                          ? "bg-[#C6F24E]/10 border-[#14181F]"
                          : "bg-[#F2F4F1] border-[#E1E5DF] opacity-80"
                      }`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleService(service.id)}
                          className="rounded border-gray-300 text-[#14181F] focus:ring-0"
                        />
                        <span className="text-xs font-bold text-[#14181F]">{service.name}</span>
                      </label>
                      {isSelected && (
                        <input
                          type="number"
                          min="1"
                          placeholder="العدد (فارغ=مفتوح)"
                          value={selectedItem?.quantity ?? ""}
                          onChange={(e) => {
                            const val = e.target.value;
                            setValue(
                              "includedServices",
                              currentInc.map((s) =>
                                s.serviceId === service.id ? { ...s, quantity: val } : s
                              )
                            );
                          }}
                          className="w-28 px-2 py-1 bg-white border border-[#E1E5DF] rounded-lg text-xs font-mono"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* 7. Commission (PT Only) */}
        {currentKind === "PT" && (
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4.5 space-y-3">
            <h3 className="text-sm font-bold text-[#14181F] flex items-center gap-2 pb-2 border-b border-[#E1E5DF]">
              <Percent className="h-4 w-4 text-purple-600" />
              <span>عمولات المدرب (PT Commission)</span>
            </h3>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="commissionable"
                {...register("commissionable")}
                className="w-4 h-4 rounded border-gray-300 text-[#14181F] focus:ring-0"
              />
              <label htmlFor="commissionable" className="text-xs font-bold text-[#14181F] cursor-pointer">
                خاضعة لعمولة المدرب الشخصي
              </label>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#5B6470] mb-1">
                دفعات العمولة (commissionMilestones) - الحد الأقصى ({maxMilestonesAllowed})
              </label>
              <input
                type="number"
                min="1"
                max={maxMilestonesAllowed}
                {...register("commissionMilestones", {
                  valueAsNumber: true,
                  min: { value: 1, message: "يجب ألا تقل الدفعات عن 1" },
                  max: {
                    value: maxMilestonesAllowed,
                    message: `دفعات العمولة لا يمكن أن تتجاوز عدد أشهر الباقة (${maxMilestonesAllowed})`,
                  },
                })}
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
              {errors.commissionMilestones && (
                <p className="text-xs text-red-500 mt-1">{errors.commissionMilestones.message}</p>
              )}
            </div>

            {commissionPreview && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-xl text-xs text-purple-900 font-bold flex items-center gap-2">
                <Info className="h-4 w-4 shrink-0 text-purple-600" />
                <span>معاينة تقسيم دفعات العمولة: {commissionPreview}</span>
              </div>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#E1E5DF]">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl font-bold"
          >
            إلغاء
          </Button>
          <Button
            type="submit"
            variant="lime"
            disabled={isSubmitting}
            isLoading={isSubmitting}
            className="rounded-xl font-bold"
          >
            {isEditing ? "حفظ التعديلات" : "إنشاء الباقة"}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
