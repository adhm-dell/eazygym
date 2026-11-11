"use client";

import React, { useState, useEffect } from "react";
import {
  Dialog,
  Button,
  Badge,
  Input,
  useToast,
} from "@gym/ui";
import {
  Layers,
  CreditCard,
  Banknote,
  Smartphone,
  Wallet as WalletIcon,
  Check,
  Calendar,
  User,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { sellApi } from "../../sell/api";
import { formatMoney } from "../../../lib/money";
import type { Plan, Staff, ClassScheduleWithDetails } from "@gym/contracts";

interface QuickSubscribeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  member: {
    id: string;
    name: string;
    code: string;
    phone?: string;
  } | null;
  onSuccess: (invoice: any) => void;
  onOpenPos?: (memberId: string) => void;
}

export function QuickSubscribeDialog({
  isOpen,
  onClose,
  member,
  onSuccess,
  onOpenPos,
}: QuickSubscribeDialogProps) {
  const { toast } = useToast();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [coaches, setCoaches] = useState<Staff[]>([]);
  const [classSchedules, setClassSchedules] = useState<ClassScheduleWithDetails[]>([]);
  const [walletBalance, setWalletBalance] = useState<number>(0);
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  // Form State
  const [activeCategory, setActiveCategory] = useState<"ALL" | "GYM" | "PT" | "CLASS">("ALL");
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [startDate, setStartDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [selectedCoachId, setSelectedCoachId] = useState<string>("");
  const [selectedClassSlotId, setSelectedClassSlotId] = useState<string>("");

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState<"CASH" | "INSTAPAY" | "CARD" | "WALLET">("CASH");
  const [paymentRef, setPaymentRef] = useState<string>("");
  const [payFull, setPayFull] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !member) return;

    let mounted = true;
    setIsLoadingData(true);
    setError(null);

    Promise.all([
      sellApi.listPlans(),
      sellApi.listCoaches(),
      sellApi.listClassSchedules(),
      sellApi.getMemberWallet(member.id),
    ])
      .then(([p, c, cs, w]) => {
        if (!mounted) return;
        const activePlans = p.filter((item) => item.isActive);
        setPlans(activePlans);
        setCoaches(c);
        setClassSchedules(cs);
        setWalletBalance(w?.balance || 0);
        if (activePlans.length > 0 && !selectedPlanId && activePlans[0]) {
          setSelectedPlanId(activePlans[0].id);
        }
      })
      .catch((err) => {
        if (!mounted) return;
        setError("تعذر تحميل باقات الاشتراك: " + (err?.message || String(err)));
      })
      .finally(() => {
        if (mounted) setIsLoadingData(false);
      });

    return () => {
      mounted = false;
    };
  }, [isOpen, member]);

  if (!isOpen || !member) return null;

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const filteredPlans = plans.filter((p) => {
    if (activeCategory === "ALL") return true;
    return p.kind === activeCategory;
  });

  const planPrice = selectedPlan?.price || 0;
  const minUpfrontPercent = selectedPlan?.minUpfrontPercent ?? 30;
  const minUpfrontPiasters = Math.round((planPrice * minUpfrontPercent) / 100);
  const amountToPayPiasters = payFull ? planPrice : minUpfrontPiasters;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan) {
      setError("يرجى اختيار باقة اشتراك");
      return;
    }

    if (selectedPlan.kind === "CLASS" && !selectedClassSlotId && classSchedules.length > 0) {
      setError("يرجى اختيار جدول الحصة");
      return;
    }

    if (paymentMethod === "WALLET" && walletBalance < amountToPayPiasters) {
      setError(`رصيد المحفظة (${formatMoney(walletBalance)}) لا يكفي لسداد ${formatMoney(amountToPayPiasters)}`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const invoice = await sellApi.createInvoice({
        memberId: member.id,
        items: [
          {
            kind: "SUBSCRIPTION",
            planId: selectedPlan.id,
            quantity: 1,
            unitPrice: selectedPlan.price,
            subscription: {
              startDate: startDate ? new Date(startDate).toISOString() : new Date().toISOString(),
              coachId: selectedCoachId || undefined,
              classSlotIds: selectedClassSlotId ? [selectedClassSlotId] : undefined,
            },
          },
        ],
        payments:
          amountToPayPiasters > 0 && paymentMethod !== "WALLET"
            ? [
                {
                  method: paymentMethod as "CASH" | "INSTAPAY" | "CARD",
                  amount: amountToPayPiasters,
                  reference: paymentRef.trim() || null,
                },
              ]
            : [],
        useWallet: paymentMethod === "WALLET",
      });

      toast({
        title: "تم إصدار الاشتراك بنجاح",
        description: `تم تفعيل باقة "${selectedPlan.name}" للعضو ${member.name}`,
        variant: "success",
      });

      onSuccess(invoice);
      onClose();
    } catch (err: any) {
      setError(err?.message || "تعذر إتمام عملية الاشتراك");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title="شراء وتجديد الاشتراك (شاشة سريعة)"
      description={`تفعيل اشتراك جديد للعضو: ${member.name} (كود: ${member.code})`}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-5 pt-2" dir="rtl">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
            {error}
          </div>
        )}

        {/* Member Summary Header */}
        <div className="p-3.5 rounded-2xl bg-[#F6F8F5] border border-[#E1E5DF] flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-bold">
              <User className="h-4 w-4" />
            </div>
            <div>
              <b className="text-sm text-[#14181F] block">{member.name}</b>
              <span className="text-[#5B6470] font-mono">كود: {member.code} {member.phone && `· ${member.phone}`}</span>
            </div>
          </div>
          <div className="text-end">
            <span className="text-[#5B6470] block">رصيد المحفظة</span>
            <b className="text-[#14181F] font-mono">{formatMoney(walletBalance)}</b>
          </div>
        </div>

        {/* Categories Filter */}
        <div className="flex items-center gap-1.5 p-1 bg-[#F2F4F1] rounded-xl text-xs font-bold border border-[#E1E5DF]">
          {[
            { id: "ALL", label: "الكل" },
            { id: "GYM", label: "جيم" },
            { id: "PT", label: "برايفت (PT)" },
            { id: "CLASS", label: "حصص" },
          ].map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id as any)}
              className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? "bg-white text-[#14181F] shadow-sm font-black"
                  : "text-[#5B6470] hover:text-[#14181F]"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Plans Selector Cards */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-[#14181F] block">
            اختر الباقة المطلوبة ({filteredPlans.length} باقة متاحة)
          </label>
          {isLoadingData ? (
            <div className="p-8 text-center text-xs text-[#5B6470]">جاري تحميل الباقات...</div>
          ) : filteredPlans.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#5B6470] bg-white rounded-xl border border-dashed border-[#E1E5DF]">
              لا توجد باقات متاحة في هذا القسم
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-48 overflow-y-auto p-1">
              {filteredPlans.map((plan) => {
                const isSelected = plan.id === selectedPlanId;
                return (
                  <div
                    key={plan.id}
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`p-3 rounded-xl border-2 transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                      isSelected
                        ? "border-[#14181F] bg-[#14181F]/5 shadow-sm"
                        : "border-[#E1E5DF] bg-white hover:border-[#14181F]/30"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <b className="text-xs font-bold text-[#14181F] block leading-snug">{plan.name}</b>
                        <span className="text-[11px] text-[#5B6470]">
                          {plan.durationDays
                            ? `${plan.durationDays} يوم`
                            : plan.totalSessions
                            ? `${plan.totalSessions} جلسة`
                            : ""}
                        </span>
                      </div>
                      <Badge variant={plan.kind === "PT" ? "g" : plan.kind === "CLASS" ? "w" : "default"}>
                        {plan.kind}
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-[#E1E5DF]/60">
                      <b className="text-sm font-black text-[#14181F] font-mono">{formatMoney(plan.price)}</b>
                      {isSelected && (
                        <span className="h-5 w-5 rounded-full bg-[#14181F] text-[#C6F24E] flex items-center justify-center">
                          <Check className="h-3 w-3 stroke-[3]" />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Selected Plan Details & Options */}
        {selectedPlan && (
          <div className="p-3.5 rounded-2xl bg-white border border-[#E1E5DF] space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Start Date */}
              <div>
                <label className="text-[11px] font-bold text-[#5B6470] block mb-1">
                  تاريخ بدء الاشتراك
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-2 text-xs font-mono font-bold"
                />
              </div>

              {/* Coach selector for PT */}
              {selectedPlan.kind === "PT" && (
                <div>
                  <label className="text-[11px] font-bold text-[#5B6470] block mb-1">
                    المدرب المسند
                  </label>
                  <select
                    value={selectedCoachId}
                    onChange={(e) => setSelectedCoachId(e.target.value)}
                    className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="">ترشيح تلقائي عبر الروتيشن (Rotation)</option>
                    {coaches.map((c) => (
                      <option key={c.id} value={c.id}>
                        الكابتن: {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Class Schedule Selector */}
              {selectedPlan.kind === "CLASS" && (
                <div>
                  <label className="text-[11px] font-bold text-[#5B6470] block mb-1">
                    جدول الحصة
                  </label>
                  <select
                    value={selectedClassSlotId}
                    onChange={(e) => setSelectedClassSlotId(e.target.value)}
                    className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl px-3 py-2 text-xs font-bold"
                  >
                    <option value="">اختر الحصة المجدولة اليوم</option>
                    {classSchedules.map((cs) => (
                      <option key={cs.id} value={cs.id}>
                        {cs.name} ({cs.effectiveStartTime}) - {cs.coachName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Payment Method & Amount Options */}
            <div className="pt-2 border-t border-[#E1E5DF] space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#5B6470]">مبلغ السداد المطلوب:</span>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-xs">
                    <input
                      type="radio"
                      name="paymentOption"
                      checked={payFull}
                      onChange={() => setPayFull(true)}
                      className="accent-[#14181F]"
                    />
                    <span>كامل ({formatMoney(planPrice)})</span>
                  </label>
                  {minUpfrontPercent < 100 && (
                    <label className="inline-flex items-center gap-1.5 cursor-pointer font-bold text-xs">
                      <input
                        type="radio"
                        name="paymentOption"
                        checked={!payFull}
                        onChange={() => setPayFull(false)}
                        className="accent-[#14181F]"
                      />
                      <span>مقدم {minUpfrontPercent}% ({formatMoney(minUpfrontPiasters)})</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Payment Methods Tabs */}
              <div className="grid grid-cols-4 gap-1.5 pt-1">
                {[
                  { id: "CASH", label: "كاش", icon: Banknote },
                  { id: "INSTAPAY", label: "إنستاباي", icon: Smartphone },
                  { id: "CARD", label: "بطاقة", icon: CreditCard },
                  { id: "WALLET", label: "المحفظة", icon: WalletIcon, disabled: walletBalance < amountToPayPiasters },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={m.disabled}
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={`p-2 rounded-xl border flex flex-col items-center gap-1 text-[11px] font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                        isSelected
                          ? "bg-[#14181F] text-white border-[#14181F] shadow-sm"
                          : "bg-[#F2F4F1] text-[#5B6470] border-[#E1E5DF] hover:text-[#14181F]"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{m.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Reference Input for Digital Payments */}
              {(paymentMethod === "INSTAPAY" || paymentMethod === "CARD") && (
                <div className="pt-1">
                  <Input
                    label="رقم المرجع / العملية (اختياري)"
                    placeholder="رقم مرجع التحويل أو آخر 4 أرقام من البطاقة"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    className="text-xs"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* Dialog Actions Footer */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-[#E1E5DF]">
          {onOpenPos && (
            <button
              type="button"
              onClick={() => onOpenPos(member.id)}
              className="text-xs text-[#5B6470] hover:text-[#14181F] font-bold flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              <span>فتح في شاشة البيع المتقدمة (POS)</span>
            </button>
          )}

          <div className="flex items-center gap-2 w-full sm:w-auto ms-auto">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button
              type="submit"
              variant="lime"
              className="font-bold px-6"
              disabled={isSubmitting || !selectedPlan}
              isLoading={isSubmitting}
            >
              تأكيد الاشتراك وتفعيل الدخول
            </Button>
          </div>
        </div>
      </form>
    </Dialog>
  );
}
