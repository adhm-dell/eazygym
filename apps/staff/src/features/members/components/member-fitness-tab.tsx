"use client";

import React, { useState, useEffect } from "react";
import { coachOpsApi } from "../../coach-ops/api";
import { Button, Input, useToast } from "@gym/ui";
import {
  Plus,
  HeartPulse,
  Scale,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Clock,
  UserCheck,
} from "lucide-react";

interface MemberFitnessTabProps {
  memberId: string;
}

export function MemberFitnessTab({ memberId }: MemberFitnessTabProps) {
  const { toast } = useToast();
  const [profile, setProfile] = useState<any>(null);
  const [assessments, setAssessments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Edit profile state
  const [goals, setGoals] = useState("");
  const [medicalConditions, setMedicalConditions] = useState("");
  const [injuries, setInjuries] = useState("");
  const [previousGymExperience, setPreviousGymExperience] = useState("");
  const [notes, setNotes] = useState("");
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // New assessment modal state
  const [isNewAssessOpen, setIsNewAssessOpen] = useState(false);
  const [weight, setWeight] = useState("80");
  const [bodyFatPercent, setBodyFatPercent] = useState("20");
  const [muscleMass, setMuscleMass] = useState("35");
  const [waterPercent, setWaterPercent] = useState("55");
  const [visceralFatLevel, setVisceralFatLevel] = useState("6");
  const [bmr, setBmr] = useState("1750");
  const [assessNotes, setAssessNotes] = useState("");
  const [isSavingAssess, setIsSavingAssess] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [profData, assessData] = await Promise.all([
        coachOpsApi.getFitnessProfile(memberId),
        coachOpsApi.getAssessments(memberId),
      ]);
      setProfile(profData);
      setAssessments(assessData || []);

      if (profData) {
        setGoals(profData.goals || "");
        setMedicalConditions(profData.medicalConditions || "");
        setInjuries(profData.injuries || "");
        setPreviousGymExperience(profData.previousGymExperience || "");
        setNotes(profData.notes || "");
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [memberId]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      await coachOpsApi.updateFitnessProfile(memberId, {
        goals,
        medicalConditions,
        injuries,
        previousGymExperience,
        notes,
      });
      toast({ title: "تم تحديث الملف البدني للعضو بنجاح", variant: "success" });
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAssess(true);
    try {
      await coachOpsApi.createAssessment(memberId, {
        metrics: {
          weight: parseFloat(weight),
          bodyFatPercent: parseFloat(bodyFatPercent),
          muscleMass: parseFloat(muscleMass),
          waterPercent: parseFloat(waterPercent),
          visceralFatLevel: parseInt(visceralFatLevel, 10),
          bmr: parseInt(bmr, 10),
          notes: assessNotes,
        },
      });
      toast({ title: "تم إضافة فحص InBody الجديد بنجاح", variant: "success" });
      setIsNewAssessOpen(false);
      setAssessNotes("");
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    } finally {
      setIsSavingAssess(false);
    }
  };

  const latestAssess = assessments[0];
  const currentAcceptedAssignment = profile?.assignments?.find((a: any) => a.status === "ACCEPTED");
  const pendingAssignment = profile?.assignments?.find((a: any) => a.status === "PENDING");

  return (
    <div className="space-y-6">
      {/* Latest Metrics Highlights */}
      {latestAssess && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 font-bold block">الوزن</span>
            <span className="text-xl font-black text-gray-900 mt-1 block">
              {latestAssess.metrics?.weight || "-"} كجم
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 font-bold block">نسبة الدهون</span>
            <span className="text-xl font-black text-amber-600 mt-1 block">
              {latestAssess.metrics?.bodyFatPercent || "-"}%
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 font-bold block">الكتلة العضلية</span>
            <span className="text-xl font-black text-emerald-600 mt-1 block">
              {latestAssess.metrics?.muscleMass || "-"} كجم
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 font-bold block">نسبة الماء</span>
            <span className="text-xl font-black text-blue-600 mt-1 block">
              {latestAssess.metrics?.waterPercent || "-"}%
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 font-bold block">الدهون الحشوية</span>
            <span className="text-xl font-black text-gray-900 mt-1 block">
              Level {latestAssess.metrics?.visceralFatLevel || "-"}
            </span>
          </div>

          <div className="p-3.5 bg-white rounded-xl border border-gray-200 shadow-sm text-center">
            <span className="text-[11px] text-gray-500 font-bold block">معدل الحرق BMR</span>
            <span className="text-xl font-black text-gray-900 mt-1 block">
              {latestAssess.metrics?.bmr || "-"} kcal
            </span>
          </div>
        </div>
      )}

      {/* Fitness Profile Form */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <HeartPulse className="h-5 w-5 text-gray-900" />
            <h3 className="font-bold text-sm text-gray-900">الملف البدني والصحي للعضو</h3>
          </div>
          {currentAcceptedAssignment ? (
            <span className="text-xs text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full font-bold">
              المدرب المعتمد: {currentAcceptedAssignment.coach?.name}
            </span>
          ) : pendingAssignment ? (
            <span className="text-xs text-amber-800 bg-amber-100 px-3 py-1 rounded-full font-bold">
              بانتظار موافقة: {pendingAssignment.coach?.name}
            </span>
          ) : (
            <span className="text-xs text-gray-600 bg-gray-100 px-2.5 py-1 rounded-full font-medium">
              لا يوجد مدرب معين حالياً
            </span>
          )}
        </div>

        <form onSubmit={handleSaveProfile} className="space-y-4 text-start">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="الأهداف الرياضية (Goals)"
              value={goals}
              onChange={(e) => setGoals(e.target.value)}
              placeholder="مثال: زيادة الكتلة العضلية، إنقاص الوزن، تحسين اللياقة"
            />
            <Input
              label="الخبرة التدريبية السابقة"
              value={previousGymExperience}
              onChange={(e) => setPreviousGymExperience(e.target.value)}
              placeholder="مثال: سنتين تمارين جيم، مبتدئ، كمال أجسام"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="حالات صحية أو أمراض مزمنة (إن وجدت)"
              value={medicalConditions}
              onChange={(e) => setMedicalConditions(e.target.value)}
              placeholder="مثال: ضغط دم، ربو، حساسية"
            />
            <Input
              label="إصابات سابقة أو حالية (Injuries)"
              value={injuries}
              onChange={(e) => setInjuries(e.target.value)}
              placeholder="مثال: إصابة في الركبة، خشونة فقرات، انزلاق غضروفي"
            />
          </div>

          <Input
            label="ملاحظات وتوجيهات خاصة بالمدرب"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="تعليمات أو توصيات برنامج التدريب"
          />

          <div className="flex justify-end pt-2">
            <Button
              type="submit"
              variant="lime"
              size="sm"
              isLoading={isSavingProfile}
              className="font-bold"
            >
              حفظ وتحديث الملف البدني
            </Button>
          </div>
        </form>
      </div>

      {/* Assignment History Timeline */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <UserCheck className="h-5 w-5 text-gray-900" />
            <h3 className="font-bold text-sm text-gray-900">
              سجل تكليفات وترشيحات المدربين ({profile?.assignments?.length || 0})
            </h3>
          </div>
          <span className="text-xs text-gray-500">
            تاريخ التكليفات السابقة والاعتذارات
          </span>
        </div>

        {!profile?.assignments || profile.assignments.length === 0 ? (
          <p className="text-xs text-gray-500 text-center py-4">
            لم يتم تسجيل أي تكليفات مدربين لهذا العضو بعد
          </p>
        ) : (
          <div className="relative ps-6 space-y-4 before:absolute before:top-2 before:bottom-2 before:start-2.5 before:w-0.5 before:bg-gray-200">
            {profile.assignments.map((a: any) => {
              const isAccepted = a.status === "ACCEPTED";
              const isRejected = a.status === "REJECTED";
              const isSuperseded = a.status === "SUPERSEDED";
              const isPending = a.status === "PENDING";

              return (
                <div key={a.id} className="relative flex items-start gap-3">
                  <span
                    className={`absolute -start-6 top-1 h-5 w-5 rounded-full flex items-center justify-center text-white text-[10px] ${
                      isAccepted
                        ? "bg-emerald-600"
                        : isRejected
                        ? "bg-red-600"
                        : isSuperseded
                        ? "bg-gray-400"
                        : "bg-amber-500"
                    }`}
                  >
                    {isAccepted ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : isRejected ? (
                      <XCircle className="h-3.5 w-3.5" />
                    ) : isSuperseded ? (
                      <RotateCcw className="h-3.5 w-3.5" />
                    ) : (
                      <Clock className="h-3.5 w-3.5" />
                    )}
                  </span>

                  <div className="bg-[#F8FAF6] p-3 rounded-xl border border-gray-100 flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-gray-900">
                        {isAccepted && `تم قبول التكليف بواسطة الكابتن ${a.coach?.name || a.coachId}`}
                        {isRejected && `اعتذر الكابتن ${a.coach?.name || a.coachId} عن التكليف`}
                        {isSuperseded && `تم استبدال ترشيح الكابتن ${a.coach?.name || a.coachId}`}
                        {isPending && `تم ترشيح الكابتن ${a.coach?.name || a.coachId} (بانتظار الموافقة)`}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {new Date(a.createdAt).toLocaleDateString("ar-EG", {
                          hour: "2-digit",
                          minute: "2-digit",
                          month: "short",
                          day: "numeric",
                        })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-gray-600">
                      <span>المصدر: {a.source === "ROTATION" ? "تلقائي (الدور)" : "يدوي (الاستقبال)"}</span>
                      {a.rejectionReason && (
                        <span className="text-red-600 font-bold">
                          · سبب الرفض: {a.rejectionReason}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* InBody Assessments History */}
      <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-gray-900" />
            <h3 className="font-bold text-sm text-gray-900">
              سجل قياسات وفحوصات InBody ({assessments.length})
            </h3>
          </div>
          <Button
            variant="lime"
            size="sm"
            onClick={() => setIsNewAssessOpen(true)}
            className="flex items-center gap-1 font-bold text-xs"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>إضافة فحص جديد</span>
          </Button>
        </div>

        {assessments.length === 0 ? (
          <div className="p-8 text-center text-gray-500 space-y-2">
            <Scale className="h-8 w-8 mx-auto text-[#C6F24E]" />
            <p className="text-xs">لا توجد قياسات InBody مسجلة للعضو حتى الآن.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="py-2.5 px-3 text-start">تاريخ القياس</th>
                  <th className="py-2.5 px-3 text-start">الوزن</th>
                  <th className="py-2.5 px-3 text-start">نسبة الدهون</th>
                  <th className="py-2.5 px-3 text-start">الكتلة العضلية</th>
                  <th className="py-2.5 px-3 text-start">نسبة الماء</th>
                  <th className="py-2.5 px-3 text-start">الدهون الحشوية</th>
                  <th className="py-2.5 px-3 text-start">معدل الحرق (BMR)</th>
                  <th className="py-2.5 px-3 text-start">ملاحظات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {assessments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-3 font-bold text-gray-900">
                      {new Date(a.assessmentDate).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-2.5 px-3 font-bold text-gray-900">
                      {a.metrics?.weight ? `${a.metrics.weight} كجم` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-amber-600 font-bold">
                      {a.metrics?.bodyFatPercent ? `${a.metrics.bodyFatPercent}%` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-600 font-bold">
                      {a.metrics?.muscleMass ? `${a.metrics.muscleMass} كجم` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-blue-600">
                      {a.metrics?.waterPercent ? `${a.metrics.waterPercent}%` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">
                      {a.metrics?.visceralFatLevel || "-"}
                    </td>
                    <td className="py-2.5 px-3 text-gray-700">
                      {a.metrics?.bmr ? `${a.metrics.bmr} kcal` : "-"}
                    </td>
                    <td className="py-2.5 px-3 text-gray-500">
                      {a.metrics?.notes || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* New Assessment Modal */}
      {isNewAssessOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-md my-auto max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col text-start">
            <div className="p-4 sm:p-5 border-b border-[#E1E5DF] shrink-0 bg-white flex items-center justify-between">
              <h3 className="font-bold text-base text-[#14181F]">تسجيل فحص InBody جديد</h3>
              <button
                type="button"
                onClick={() => setIsNewAssessOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateAssessment} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 min-h-0">
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="الوزن (كجم)"
                    type="number"
                    step="0.1"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    required
                  />
                  <Input
                    label="نسبة الدهون (%)"
                    type="number"
                    step="0.1"
                    value={bodyFatPercent}
                    onChange={(e) => setBodyFatPercent(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="الكتلة العضلية (كجم)"
                    type="number"
                    step="0.1"
                    value={muscleMass}
                    onChange={(e) => setMuscleMass(e.target.value)}
                    required
                  />
                  <Input
                    label="نسبة الماء (%)"
                    type="number"
                    step="0.1"
                    value={waterPercent}
                    onChange={(e) => setWaterPercent(e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Input
                    label="الدهون الحشوية (Level)"
                    type="number"
                    value={visceralFatLevel}
                    onChange={(e) => setVisceralFatLevel(e.target.value)}
                    required
                  />
                  <Input
                    label="معدل الحرق (BMR)"
                    type="number"
                    value={bmr}
                    onChange={(e) => setBmr(e.target.value)}
                    required
                  />
                </div>

                <Input
                  label="ملاحظات القياس"
                  value={assessNotes}
                  onChange={(e) => setAssessNotes(e.target.value)}
                  placeholder="ملاحظات إضافية على الفحص"
                />
              </div>

              <div className="flex justify-end gap-2 p-4 border-t border-[#E1E5DF] shrink-0 bg-white">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsNewAssessOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="lime"
                  size="sm"
                  isLoading={isSavingAssess}
                  className="font-bold"
                >
                  حفظ الفحص
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

