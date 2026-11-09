"use client";

import React, { useState } from "react";
import { Dialog, Button } from "@gym/ui";
import { assessmentsApi, type FitnessAssessmentMetrics } from "../api";
import { Activity, Scale, Percent, Flame } from "lucide-react";

interface AddAssessmentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  onSuccess: () => void;
}

export function AddAssessmentDialog({
  isOpen,
  onClose,
  memberId,
  memberName,
  onSuccess,
}: AddAssessmentDialogProps) {
  const [weight, setWeight] = useState<string>("");
  const [bodyFatPercent, setBodyFatPercent] = useState<string>("");
  const [muscleMass, setMuscleMass] = useState<string>("");
  const [waterPercent, setWaterPercent] = useState<string>("");
  const [visceralFatLevel, setVisceralFatLevel] = useState<string>("");
  const [bmr, setBmr] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const metrics: FitnessAssessmentMetrics = {
        weight: weight ? parseFloat(weight) : undefined,
        bodyFatPercent: bodyFatPercent ? parseFloat(bodyFatPercent) : undefined,
        muscleMass: muscleMass ? parseFloat(muscleMass) : undefined,
        waterPercent: waterPercent ? parseFloat(waterPercent) : undefined,
        visceralFatLevel: visceralFatLevel ? parseFloat(visceralFatLevel) : undefined,
        bmr: bmr ? parseFloat(bmr) : undefined,
        notes: notes || undefined,
      };

      await assessmentsApi.createAssessment(memberId, {
        metrics,
        assessmentDate: new Date().toISOString(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || "فشل تسجيل الفحص");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="تسجيل فحص InBody جديد"
      description={`تسجيل القياسات والتحاليل البدنية للمتدرب: ${memberName}`}
      footer={
        <div className="flex gap-2 justify-end w-full">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting} className="text-xs">
            إلغاء
          </Button>
          <Button
            variant="lime"
            onClick={handleSubmit}
            disabled={isSubmitting || (!weight && !bodyFatPercent && !muscleMass)}
            className="text-xs font-bold"
          >
            {isSubmitting ? "جاري الحفظ..." : "حفظ الفحص"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3 text-xs">
        {error && (
          <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="font-bold text-[#14181F] block mb-1">الوزن (كجم)</label>
            <input
              type="number"
              step="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="مثال: 78.5"
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
            />
          </div>

          <div>
            <label className="font-bold text-[#14181F] block mb-1">نسبة الدهون (%)</label>
            <input
              type="number"
              step="0.1"
              value={bodyFatPercent}
              onChange={(e) => setBodyFatPercent(e.target.value)}
              placeholder="مثال: 18.2"
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
            />
          </div>

          <div>
            <label className="font-bold text-[#14181F] block mb-1">كتلة العضل (كجم)</label>
            <input
              type="number"
              step="0.1"
              value={muscleMass}
              onChange={(e) => setMuscleMass(e.target.value)}
              placeholder="مثال: 36.4"
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
            />
          </div>

          <div>
            <label className="font-bold text-[#14181F] block mb-1">نسبة الماء (%)</label>
            <input
              type="number"
              step="0.1"
              value={waterPercent}
              onChange={(e) => setWaterPercent(e.target.value)}
              placeholder="مثال: 58.0"
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
            />
          </div>

          <div>
            <label className="font-bold text-[#14181F] block mb-1">الدهون الحشوية</label>
            <input
              type="number"
              value={visceralFatLevel}
              onChange={(e) => setVisceralFatLevel(e.target.value)}
              placeholder="مثال: 6"
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
            />
          </div>

          <div>
            <label className="font-bold text-[#14181F] block mb-1">معدل الحرق (BMR)</label>
            <input
              type="number"
              value={bmr}
              onChange={(e) => setBmr(e.target.value)}
              placeholder="مثال: 1750"
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
            />
          </div>
        </div>

        <div>
          <label className="font-bold text-[#14181F] block mb-1">ملاحظات المدرب وتوصيات التغذية</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="مثال: زيادة السعرات الحرارية والتركيز على تمارين الأرجل..."
            className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl focus:outline-none focus:border-[#14181F]"
          />
        </div>
      </form>
    </Dialog>
  );
}

