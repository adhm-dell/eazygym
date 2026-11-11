"use client";

import React, { useState, useEffect } from "react";
import {
  HeartPulse,
  UserCheck,
  RotateCcw,
  AlertCircle,
  Check,
  Dumbbell,
  Stethoscope,
  Briefcase,
  Target,
  FileText,
  Loader2,
  X,
  Sparkles,
  Info,
} from "lucide-react";
import { Button, Badge, Dialog } from "@gym/ui";
import { coachOpsApi } from "../api";
import type { Member, Staff } from "@gym/contracts";

export interface IntakeData {
  previousGymExperience: string;
  medicalConditions: string;
  injuries: string;
  goals: string;
  jobNature: string;
  notes: string;
  assignmentMode: "AUTO" | "MANUAL";
  manualCoachId?: string;
}

interface FitnessProfileIntakeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: Member;
  planName?: string;
  coaches: Staff[];
  onConfirm: (data: IntakeData) => Promise<void>;
}

export function FitnessProfileIntakeDialog({
  isOpen,
  onClose,
  member,
  planName,
  coaches,
  onConfirm,
}: FitnessProfileIntakeDialogProps) {
  // Form fields
  const [experienceLevel, setExperienceLevel] = useState<string>("مبتدئ (لم يمارس من قبل)");
  const [experienceDetails, setExperienceDetails] = useState<string>("");
  const [injuries, setInjuries] = useState<string>("سليم تماماً ولا توجد أي إصابات سابقة");
  const [medicalConditions, setMedicalConditions] = useState<string>("سليم ولا توجد أمراض مزمنة أو موانع طبية");
  const [goals, setGoals] = useState<string>("زيادة اللياقة والنشاط العام");
  const [customGoal, setCustomGoal] = useState<string>("");
  const [jobNature, setJobNature] = useState<string>("مكتبي وقليل الحركة");
  const [notes, setNotes] = useState<string>("");

  // Coach Assignment Mode
  const [assignmentMode, setAssignmentMode] = useState<"AUTO" | "MANUAL">("AUTO");
  const [manualCoachId, setManualCoachId] = useState<string>("");

  // Next coach in queue preview
  const [nextCoachInQueue, setNextCoachInQueue] = useState<{ id: string; name: string; isOnShift?: boolean } | null>(null);
  const [isLoadingQueue, setIsLoadingQueue] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Load rotation queue preview when dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setIsLoadingQueue(true);

    coachOpsApi
      .getRotationQueue()
      .then((queue) => {
        if (Array.isArray(queue) && queue.length > 0) {
          // Find first coach on shift or first in queue
          const onShiftCoach = queue.find((q: any) => q.onShift && !q.onBreak);
          const topCoach = onShiftCoach || queue[0];
          if (topCoach?.coach) {
            setNextCoachInQueue({
              id: topCoach.coach.id,
              name: topCoach.coach.name,
              isOnShift: Boolean(topCoach.onShift && !topCoach.onBreak),
            });
          }
        }
      })
      .catch(() => {
        // Queue preview optional
      })
      .finally(() => {
        setIsLoadingQueue(false);
      });

    // Default manual coach if available
    if (coaches.length > 0 && !manualCoachId && coaches[0]) {
      setManualCoachId(coaches[0].id);
    }
  }, [isOpen, coaches]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (assignmentMode === "MANUAL" && !manualCoachId) {
      setError("يرجى اختيار الكابتن المسؤول من القائمة");
      return;
    }

    const fullExperience = experienceDetails.trim()
      ? `${experienceLevel} - ${experienceDetails.trim()}`
      : experienceLevel;

    const fullGoals = customGoal.trim() ? `${goals} (${customGoal.trim()})` : goals;

    setIsSubmitting(true);
    try {
      await onConfirm({
        previousGymExperience: fullExperience,
        medicalConditions: medicalConditions.trim(),
        injuries: injuries.trim(),
        goals: fullGoals,
        jobNature: jobNature.trim(),
        notes: notes.trim(),
        assignmentMode,
        manualCoachId: assignmentMode === "MANUAL" ? manualCoachId : undefined,
      });
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء حفظ الملف البدني وإتمام الاشتراك");
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={isSubmitting ? () => {} : onClose}
      title=""
      className="max-w-2xl"
    >
      <div className="flex flex-col gap-5 max-h-[85vh] overflow-y-auto px-1 py-1">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[#E1E5DF] pb-4">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center shrink-0 shadow-sm">
              <HeartPulse className="h-6 w-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-[#14181F]">الملف البدني والصحي للعضو الجديد</h2>
                <Badge variant="lime" className="text-xs font-bold">
                  أول اشتراك
                </Badge>
              </div>
              <p className="text-xs text-[#5B6470] mt-0.5">
                جمع البيانات البدنية والصحية للعضو وتحديد الكابتن المسؤول عن التقييم والمتابعة
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1 text-[#5B6470] hover:text-[#14181F] rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Member Info Pill */}
        <div className="bg-[#F2F4F1] p-3 rounded-xl border border-[#E1E5DF] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#5B6470]">العضو:</span>
            <b className="text-sm font-black text-[#14181F]">{member.name}</b>
            <span className="font-mono text-xs bg-[#14181F] text-[#C6F24E] px-2 py-0.5 rounded font-bold">
              {member.code}
            </span>
            {member.phone && <span className="text-[#5B6470]">· هاتف: {member.phone}</span>}
          </div>
          {planName && (
            <div className="flex items-center gap-1.5 font-bold text-[#14181F]">
              <span className="text-[#5B6470]">الباقة المطلوبة:</span>
              <span className="bg-white px-2 py-0.5 rounded border border-[#E1E5DF]">{planName}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700 font-semibold">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          {/* Section 1: Previous Experience */}
          <div className="flex flex-col gap-2">
            <label className="text-xs font-black text-[#14181F] flex items-center gap-1.5">
              <Dumbbell className="h-4 w-4 text-[#5B6470]" />
              <span>هل مارس المتدرب تمارين الجيم أو رياضة من قبل؟</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { label: "مبتدئ (لم يمارس من قبل)", desc: "أول تجربة له في الجيم" },
                { label: "متوسط (ممارسة متقطعة)", desc: "مارس سابقاً لعدة أشهر" },
                { label: "متقدم (منتظم وملتزم)", desc: "خبرة واسعة في الأوزان والتغذية" },
              ].map((item) => {
                const isSelected = experienceLevel === item.label;
                return (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => setExperienceLevel(item.label)}
                    className={`p-2.5 rounded-xl border text-start transition-all cursor-pointer ${
                      isSelected
                        ? "border-[#14181F] bg-[#14181F] text-white shadow-sm"
                        : "border-[#E1E5DF] bg-white text-[#14181F] hover:bg-[#F2F4F1]"
                    }`}
                  >
                    <b className="text-xs block font-bold">{item.label}</b>
                    <span className={`text-[11px] block mt-0.5 ${isSelected ? "text-white/80" : "text-[#5B6470]"}`}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
            <input
              type="text"
              value={experienceDetails}
              onChange={(e) => setExperienceDetails(e.target.value)}
              placeholder="تفاصيل إضافية عن نوع الرياضة أو التمارين السابقة (اختياري)..."
              className="w-full text-xs p-2.5 bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
            />
          </div>

          {/* Section 2: Injuries & Medical Conditions */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Injuries */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#14181F] flex items-center gap-1.5">
                  <Stethoscope className="h-4 w-4 text-[#5B6470]" />
                  <span>الإصابات السابقة أو آلام المفاصل:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setInjuries("سليم تماماً ولا توجد أي إصابات سابقة")}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  ✓ سليم بدون إصابات
                </button>
              </div>
              <textarea
                rows={2}
                value={injuries}
                onChange={(e) => setInjuries(e.target.value)}
                placeholder="مثال: انزلاق غضروفي بالفقرات، خشونة ركبة، تمزق كتف، أو سليم..."
                className="w-full text-xs p-2.5 bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
              />
            </div>

            {/* Medical Conditions */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-[#14181F] flex items-center gap-1.5">
                  <HeartPulse className="h-4 w-4 text-[#5B6470]" />
                  <span>الأمراض المزمنة أو الموانع الطبية:</span>
                </label>
                <button
                  type="button"
                  onClick={() => setMedicalConditions("سليم ولا توجد أمراض مزمنة أو موانع طبية")}
                  className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                >
                  ✓ سليم بدون أمراض
                </button>
              </div>
              <textarea
                rows={2}
                value={medicalConditions}
                onChange={(e) => setMedicalConditions(e.target.value)}
                placeholder="مثال: ضغط، سكر، حساسية ربو، جراحة سابقة، أو سليم تماماً..."
                className="w-full text-xs p-2.5 bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
              />
            </div>
          </div>

          {/* Section 3: Goals & Lifestyle */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Fitness Goals */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-[#14181F] flex items-center gap-1.5">
                <Target className="h-4 w-4 text-[#5B6470]" />
                <span>الهدف الرئيسي من الاشتراك:</span>
              </label>
              <select
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-[#E1E5DF] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
              >
                <option value="خسارة دهون وتنشيف ونزول وزن">خسارة دهون وتنشيف ونزول وزن</option>
                <option value="بناء وتضخيم كتلة عضلية">بناء وتضخيم كتلة عضلية</option>
                <option value="زيادة اللياقة والنشاط العام">زيادة اللياقة والنشاط العام</option>
                <option value="تأهيل بدني وعلاج طبيعي وتعديل قوام">تأهيل بدني وعلاج طبيعي وتعديل قوام</option>
                <option value="زيادة الوزن وعلاج النحافة">زيادة الوزن وعلاج النحافة</option>
                <option value="أخرى">هدف مخصص (اكتب أدناه)</option>
              </select>
              <input
                type="text"
                value={customGoal}
                onChange={(e) => setCustomGoal(e.target.value)}
                placeholder="تفاصيل الهدف المطلوب بالتحديد (مثال: خسارة 10 كجم في شهرين)..."
                className="w-full text-xs p-2 bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
              />
            </div>

            {/* Job Nature */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-black text-[#14181F] flex items-center gap-1.5">
                <Briefcase className="h-4 w-4 text-[#5B6470]" />
                <span>طبيعة العمل ونمط الحياة:</span>
              </label>
              <select
                value={jobNature}
                onChange={(e) => setJobNature(e.target.value)}
                className="w-full text-xs p-2.5 bg-white border border-[#E1E5DF] rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
              >
                <option value="مكتبي وقليل الحركة (جلوس لساعات طويلة)">مكتبي وقليل الحركة (جلوس لساعات طويلة)</option>
                <option value="حركي ونشاط يومي معتدل">حركي ونشاط يومي معتدل</option>
                <option value="عمل بدني شاق ومجهد">عمل بدني شاق ومجهد</option>
                <option value="طالب / عمل حر">طالب / عمل حر</option>
              </select>

              <label className="text-[11px] font-bold text-[#5B6470] mt-1 flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                <span>ملاحظات إضافية للمدرب:</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أي توجيهات أو ملاحظات خاصة للمدرب المسؤول..."
                className="w-full text-xs p-2 bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
              />
            </div>
          </div>

          {/* Section 4: Coach Rotation & Manual Override */}
          <div className="bg-[#14181F]/5 border-2 border-[#14181F]/20 rounded-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-5 w-5 text-[#14181F]" />
                <h3 className="text-xs font-black text-[#14181F] uppercase tracking-wide">
                  ترشيح الكابتن المسؤول (Introductory PT & Assessment)
                </h3>
              </div>
              <span className="text-[11px] text-[#5B6470] font-semibold">
                جلسة تعارف وتقييم بدني مجانية للعضو الجديد
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Option 1: Auto Rotation */}
              <div
                onClick={() => setAssignmentMode("AUTO")}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  assignmentMode === "AUTO"
                    ? "border-[#14181F] bg-white shadow-sm"
                    : "border-transparent bg-white/60 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        assignmentMode === "AUTO" ? "border-[#14181F] bg-[#14181F]" : "border-[#5B6470]"
                      }`}
                    >
                      {assignmentMode === "AUTO" && <div className="h-1.5 w-1.5 rounded-full bg-[#C6F24E]" />}
                    </div>
                    <div>
                      <b className="text-xs font-black text-[#14181F] block">ترشيح تلقائي بنظام الدور (Auto-Rotation)</b>
                      <span className="text-[11px] text-[#5B6470]">ترشيح المدرب المستحق في الدور تلقائياً</span>
                    </div>
                  </div>
                  <RotateCcw className="h-4 w-4 text-[#5B6470]" />
                </div>

                <div className="mt-3 pt-2 border-t border-[#E1E5DF] text-[11px]">
                  {isLoadingQueue ? (
                    <span className="text-[#5B6470] flex items-center gap-1">
                      <Loader2 className="h-3 w-3 animate-spin" /> جاري فحص ورديات المدربين...
                    </span>
                  ) : nextCoachInQueue ? (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#5B6470]">الكابتن القادم في الدور:</span>
                      <span className="font-bold text-[#14181F] flex items-center gap-1">
                        {nextCoachInQueue.name}
                        {nextCoachInQueue.isOnShift ? (
                          <span className="h-2 w-2 rounded-full bg-emerald-500" title="على الوردية حالياً" />
                        ) : (
                          <span className="text-[10px] text-amber-600">(خارج الوردية)</span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <span className="text-amber-700 font-medium">سيتم ترشيح أول مدرب متاح على الوردية</span>
                  )}
                </div>
              </div>

              {/* Option 2: Manual Override */}
              <div
                onClick={() => setAssignmentMode("MANUAL")}
                className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between ${
                  assignmentMode === "MANUAL"
                    ? "border-[#14181F] bg-white shadow-sm"
                    : "border-transparent bg-white/60 hover:bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${
                        assignmentMode === "MANUAL" ? "border-[#14181F] bg-[#14181F]" : "border-[#5B6470]"
                      }`}
                    >
                      {assignmentMode === "MANUAL" && <div className="h-1.5 w-1.5 rounded-full bg-[#C6F24E]" />}
                    </div>
                    <div>
                      <b className="text-xs font-black text-[#14181F] block">تعيين كابتن محدد يدوياً (Manual Override)</b>
                      <span className="text-[11px] text-[#5B6470]">تجاوز الدور واختيار كابتن معين بالاسم</span>
                    </div>
                  </div>
                  <UserCheck className="h-4 w-4 text-[#14181F]" />
                </div>

                <div className="mt-3 pt-2 border-t border-[#E1E5DF]">
                  {assignmentMode === "MANUAL" ? (
                    <select
                      value={manualCoachId}
                      onChange={(e) => setManualCoachId(e.target.value)}
                      className="w-full text-xs font-bold p-1.5 bg-[#F2F4F1] border border-[#14181F] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
                    >
                      <option value="">-- اختر الكابتن المسؤول --</option>
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          كابتن {c.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[11px] text-[#5B6470]">اضغط هنا لتحديد مدرب معين بالاسم للعضو</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#E1E5DF]">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-xs font-bold px-4 h-10"
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="text-xs font-black px-6 h-10 bg-[#14181F] hover:bg-black text-[#C6F24E] flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>جاري حفظ الملف البدني وإتمام الاشتراك...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>تأكيد الملف البدني وإتمام الاشتراك</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </Dialog>
  );
}
