"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  Button,
  useToast,
} from "@gym/ui";
import { Plus, Trash2, Sliders, AlertTriangle } from "lucide-react";
import {
  fetchCommissionTiers,
  saveCommissionTiers,
  type CommissionTierItem,
} from "../api";

interface TiersEditorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  coaches: Array<{ id: string; name: string }>;
  onSaved?: () => void;
}

export function TiersEditorDialog({
  open,
  onOpenChange,
  coaches,
  onSaved,
}: TiersEditorDialogProps) {
  const { toast } = useToast();
  const [selectedCoachId, setSelectedCoachId] = useState<string>("DEFAULT");
  const [tiers, setTiers] = useState<CommissionTierItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Load tiers when coach selection changes
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setValidationError(null);
    const coachId = selectedCoachId === "DEFAULT" ? undefined : selectedCoachId;
    fetchCommissionTiers(coachId)
      .then((data) => {
        if (data && data.length > 0) {
          setTiers(
            data.map((t) => ({
              minRevenue: Number(t.minRevenue),
              percent: Number(t.percent),
            }))
          );
        } else {
          // Default initial tiers if empty
          setTiers([
            { minRevenue: 0, percent: 40 },
            { minRevenue: 10000, percent: 50 },
          ]);
        }
      })
      .catch((err) => {
        toast({
          title: "خطأ",
          description: err.message,
          variant: "error",
        });
      })
      .finally(() => setLoading(false));
  }, [open, selectedCoachId]);

  const handleAddTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier ? lastTier.minRevenue + 5000 : 0;
    const newPercent = lastTier ? Math.min(100, lastTier.percent + 5) : 40;
    setTiers([...tiers, { minRevenue: newMin, percent: newPercent }]);
    setValidationError(null);
  };

  const handleRemoveTier = (index: number) => {
    const updated = tiers.filter((_, i) => i !== index);
    setTiers(updated);
    setValidationError(null);
  };

  const handleUpdateTier = (
    index: number,
    field: "minRevenue" | "percent",
    value: number
  ) => {
    const updated = [...tiers];
    updated[index] = { ...updated[index]!, [field]: value };
    setTiers(updated);
    setValidationError(null);
  };

  // Client validation matching validateTiers from domain
  const validate = (): boolean => {
    if (tiers.length === 0) {
      setValidationError("يجب ضبط شريحة واحدة على الأقل (NO_TIERS_CONFIGURED)");
      return false;
    }

    const hasZero = tiers.some((t) => t.minRevenue === 0);
    if (!hasZero) {
      setValidationError("يجب أن تبدأ الشريحة الأولى من 0 ج.م إيراد (TIERS_MUST_START_AT_ZERO)");
      return false;
    }

    const seenMin = new Set<number>();
    for (const t of tiers) {
      if (seenMin.has(t.minRevenue)) {
        setValidationError(`تكرار حد الإيراد ${t.minRevenue} ج.م غير مسموح (DUPLICATE_TIER_THRESHOLD)`);
        return false;
      }
      seenMin.add(t.minRevenue);

      if (t.percent < 0 || t.percent > 100) {
        setValidationError(`نسبة العمولة ${t.percent}% غير صالحة. يجب أن تكون بين 0% و 100%`);
        return false;
      }
    }

    setValidationError(null);
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setSaving(true);
    try {
      const coachId = selectedCoachId === "DEFAULT" ? null : selectedCoachId;
      await saveCommissionTiers(tiers, coachId);
      toast({
        title: "تم الحفظ بنجاح",
        description: "تم تحديث شرائح العمولة وتطبيق القواعد الحسابية",
      });
      onSaved?.();
      onOpenChange(false);
    } catch (err: any) {
      setValidationError(err.message || "فشل حفظ الشرائح");
      toast({
        title: "خطأ في الحفظ",
        description: err.message,
        variant: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      isOpen={open}
      onClose={() => onOpenChange(false)}
      maxWidth="lg"
      className="bg-white text-[#14181F] rounded-2xl p-6"
      title={
        <div className="flex items-center gap-2 text-xl font-bold">
          <Sliders className="h-5 w-5 text-[#14181F]" />
          <span>ضبط وتعديل شرائح عمولات المدربين</span>
        </div>
      }
      footer={
        <div className="flex items-center justify-between gap-3 w-full">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="border-[#E1E5DF] rounded-xl font-bold"
          >
            إلغاء
          </Button>
          <Button
            variant="lime"
            onClick={handleSave}
            disabled={saving || loading}
            className="rounded-xl font-bold"
          >
            {saving ? "جاري الحفظ..." : "حفظ الشرائح"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 py-3" dir="rtl">
        {/* Target Selector */}
        <div>
          <label className="text-xs font-bold text-[#5B6470] mb-1.5 block">
            تطبيق الشرائح على:
          </label>
          <select
            value={selectedCoachId}
            onChange={(e) => setSelectedCoachId(e.target.value)}
            className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-2 text-sm font-semibold text-[#14181F] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
          >
            <option value="DEFAULT">الإعداد الافتراضي للفرع (لكل المدربين)</option>
            {coaches.map((c) => (
              <option key={c.id} value={c.id}>
                تخصيص شريحة خاصة بالكابتن: {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Validation Alert */}
        {validationError && (
          <div className="p-3 rounded-xl bg-[#FDF2F2] border border-[#F8B4B4] text-[#B3261E] text-xs font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{validationError}</span>
          </div>
        )}

        {/* Tiers List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#5B6470]">قائمة الشرائح (بالإيراد المحصل)</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleAddTier}
              className="h-8 text-xs font-bold border-[#E1E5DF] hover:bg-[#F2F4F1]"
            >
              <Plus className="h-3.5 w-3.5 me-1" />
              إضافة شريحة
            </Button>
          </div>

          {loading ? (
            <div className="py-8 text-center text-xs text-[#5B6470]">جاري تحميل الشرائح...</div>
          ) : (
            <div className="space-y-2 max-h-[260px] overflow-y-auto pe-1">
              {tiers.map((tier, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 p-2.5 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF]"
                >
                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-xs text-[#5B6470] whitespace-nowrap">من إيراد:</span>
                    <input
                      type="number"
                      min={0}
                      step={500}
                      value={tier.minRevenue}
                      onChange={(e) =>
                        handleUpdateTier(idx, "minRevenue", Math.max(0, parseFloat(e.target.value) || 0))
                      }
                      className="w-28 bg-white border border-[#E1E5DF] rounded-lg px-2.5 py-1 text-sm font-bold text-[#14181F] text-center"
                    />
                    <span className="text-xs font-bold text-[#14181F]">ج.م</span>
                  </div>

                  <div className="flex-1 flex items-center gap-1.5">
                    <span className="text-xs text-[#5B6470] whitespace-nowrap">النسبة:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={tier.percent}
                      onChange={(e) =>
                        handleUpdateTier(idx, "percent", Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))
                      }
                      className="w-20 bg-white border border-[#E1E5DF] rounded-lg px-2.5 py-1 text-sm font-bold text-[#14181F] text-center"
                    />
                    <span className="text-xs font-bold text-[#14181F]">%</span>
                  </div>

                  {tiers.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveTier(idx)}
                      className="p-1.5 text-[#5B6470] hover:text-[#B3261E] rounded-lg transition-colors cursor-pointer"
                      title="حذف الشريحة"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-[11px] text-[#5B6470] leading-relaxed bg-[#F9FAF9] p-3 rounded-xl border border-[#E1E5DF]">
          <span className="font-bold text-[#14181F]">قاعدة الحساب: </span>
          تُحدد الشريحة بناءً على إجمالي المبالغ المحصلة فعلاً للتدريب الشخصي (PT) خلال الشهر، وتُطبق نسبة الشريحة التي وصل إليها الكابتن على كامل إجمالي المحطات المستحقة في ذلك الشهر.
        </p>
      </div>
    </Dialog>
  );
}
