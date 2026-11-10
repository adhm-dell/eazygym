"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Sparkles,
  Percent,
  Coins,
  Calendar,
  Layers,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Tag,
  Plus,
  Trash2,
} from "lucide-react";
import { Dialog, Button, Switch } from "@gym/ui";
import { evaluatePromotion, type CartItem as DomainCartItem, type ItemKind } from "@gym/domain";
import {
  promotionsApi,
  type Promotion,
} from "../api";
import type { Plan, CreatePromotionDto, UpdatePromotionDto } from "@gym/contracts";
import { useTranslation } from "@gym/i18n";

interface PromotionFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (promotion: Promotion) => void;
  promotionToEdit?: Promotion | null;
}

interface TestCartItem {
  id: string;
  name: string;
  kind: ItemKind;
  planId?: string | null;
  priceEgp: number;
}

export function PromotionFormDialog({
  isOpen,
  onClose,
  onSuccess,
  promotionToEdit,
}: PromotionFormDialogProps) {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const isEditing = Boolean(promotionToEdit);

  // Available plans for multi-select
  const [availablePlans, setAvailablePlans] = useState<Plan[]>([]);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [type, setType] = useState<"PERCENT" | "FIXED">("PERCENT");
  const [valueInput, setValueInput] = useState("");
  const [maxDiscountEgp, setMaxDiscountEgp] = useState("");
  const [minSubtotalEgp, setMinSubtotalEgp] = useState("");
  const [itemKinds, setItemKinds] = useState<ItemKind[]>([]);
  const [planIds, setPlanIds] = useState<string[]>([]);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [perMemberLimit, setPerMemberLimit] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Errors & submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [codeError, setCodeError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Live preview state
  const [previewCartPreset, setPreviewCartPreset] = useState<"sub" | "service_product" | "mixed" | "custom">("sub");
  const [testCodeInput, setTestCodeInput] = useState("");
  const [customCartItems, setCustomCartItems] = useState<TestCartItem[]>([]);

  // Fetch plans on mount
  useEffect(() => {
    if (isOpen) {
      promotionsApi.listPlans().then(setAvailablePlans).catch(() => setAvailablePlans([]));
    }
  }, [isOpen]);

  // Initialize or reset form values
  useEffect(() => {
    if (promotionToEdit) {
      setName(promotionToEdit.name);
      setCode(promotionToEdit.code || "");
      setTestCodeInput(promotionToEdit.code || "");
      setType(promotionToEdit.type);
      setValueInput(
        promotionToEdit.type === "PERCENT"
          ? promotionToEdit.value.toString()
          : (promotionToEdit.value / 100).toString()
      );
      setMaxDiscountEgp(
        promotionToEdit.maxDiscount != null ? (promotionToEdit.maxDiscount / 100).toString() : ""
      );
      setMinSubtotalEgp(
        promotionToEdit.minSubtotal != null ? (promotionToEdit.minSubtotal / 100).toString() : ""
      );
      setItemKinds(promotionToEdit.itemKinds || []);
      setPlanIds(promotionToEdit.planIds || []);
      setStartsAt(
        promotionToEdit.startsAt ? promotionToEdit.startsAt.slice(0, 16) : ""
      );
      setEndsAt(
        promotionToEdit.endsAt ? promotionToEdit.endsAt.slice(0, 16) : ""
      );
      setMaxUses(promotionToEdit.maxUses != null ? promotionToEdit.maxUses.toString() : "");
      setPerMemberLimit(
        promotionToEdit.perMemberLimit != null ? promotionToEdit.perMemberLimit.toString() : ""
      );
      setIsActive(promotionToEdit.isActive);
    } else {
      setName("");
      setCode("");
      setTestCodeInput("");
      setType("PERCENT");
      setValueInput("10");
      setMaxDiscountEgp("");
      setMinSubtotalEgp("");
      setItemKinds([]);
      setPlanIds([]);
      setStartsAt("");
      setEndsAt("");
      setMaxUses("");
      setPerMemberLimit("1");
      setIsActive(true);
    }
    setCodeError(null);
    setFormError(null);
  }, [promotionToEdit, isOpen]);

  // Keep test code synced with code input if user hasn't explicitly changed it
  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.toUpperCase();
    setCode(val);
    setTestCodeInput(val);
    setCodeError(null);
  };

  // Toggle item kind in multi-select
  const toggleItemKind = (kind: ItemKind) => {
    if (itemKinds.includes(kind)) {
      setItemKinds(itemKinds.filter((k) => k !== kind));
    } else {
      setItemKinds([...itemKinds, kind]);
    }
  };

  // Toggle plan in multi-select
  const togglePlanId = (id: string) => {
    if (planIds.includes(id)) {
      setPlanIds(planIds.filter((p) => p !== id));
    } else {
      setPlanIds([...planIds, id]);
    }
  };

  // Preset sample carts for live calculation
  const sampleCarts: Record<"sub" | "service_product" | "mixed", TestCartItem[]> = useMemo(() => {
    const firstPlanId = availablePlans[0]?.id || "plan_sample_1";
    const secondPlanId = availablePlans[1]?.id || "plan_sample_2";

    return {
      sub: [
        {
          id: "item_sub_1",
          name: availablePlans[0]?.name || "باقة سنوية VIP",
          kind: "SUBSCRIPTION",
          planId: firstPlanId,
          priceEgp: 7500,
        },
      ],
      service_product: [
        {
          id: "item_serv_1",
          name: "جلسة مساج استشفائي",
          kind: "SERVICE",
          priceEgp: 300,
        },
        {
          id: "item_prod_1",
          name: "مشروب واي بروتين شيك",
          kind: "PRODUCT",
          priceEgp: 80,
        },
      ],
      mixed: [
        {
          id: "item_sub_2",
          name: availablePlans[1]?.name || "باقة جيم شهرية",
          kind: "SUBSCRIPTION",
          planId: secondPlanId,
          priceEgp: 900,
        },
        {
          id: "item_serv_2",
          name: "جلسة تدريب خاص (PT)",
          kind: "SERVICE",
          priceEgp: 300,
        },
        {
          id: "item_prod_2",
          name: "لوح طاقة بروتين بار",
          kind: "PRODUCT",
          priceEgp: 120,
        },
      ],
    };
  }, [availablePlans]);

  // Current active preview cart items
  const activeCartItems: TestCartItem[] = useMemo(() => {
    if (previewCartPreset === "custom") {
      return customCartItems.length > 0
        ? customCartItems
        : [
            {
              id: "item_custom_1",
              name: "بند تجريبي 1",
              kind: "SUBSCRIPTION",
              planId: availablePlans[0]?.id || null,
              priceEgp: 1000,
            },
          ];
    }
    return sampleCarts[previewCartPreset];
  }, [previewCartPreset, sampleCarts, customCartItems, availablePlans]);

  // Live evaluation via domain pure function
  const livePreviewResult = useMemo(() => {
    const valNum = parseFloat(valueInput) || 0;
    const valuePiastersOrPercent =
      type === "PERCENT" ? Math.max(0, Math.min(100, valNum)) : Math.round(valNum * 100);

    const maxDiscountPiasters = maxDiscountEgp ? Math.round(parseFloat(maxDiscountEgp) * 100) : null;
    const minSubtotalPiasters = minSubtotalEgp ? Math.round(parseFloat(minSubtotalEgp) * 100) : null;
    const maxUsesNum = maxUses ? parseInt(maxUses, 10) : null;
    const perMemberLimitNum = perMemberLimit ? parseInt(perMemberLimit, 10) : null;

    const domainCartItems: DomainCartItem[] = activeCartItems.map((item) => ({
      id: item.id,
      kind: item.kind,
      planId: item.planId,
      total: Math.round(item.priceEgp * 100),
    }));

    const result = evaluatePromotion({
      promo: {
        type,
        value: valuePiastersOrPercent,
        maxDiscount: maxDiscountPiasters,
        minSubtotal: minSubtotalPiasters,
        itemKinds,
        planIds,
        startsAt: startsAt ? new Date(startsAt) : null,
        endsAt: endsAt ? new Date(endsAt) : null,
        maxUses: maxUsesNum,
        perMemberLimit: perMemberLimitNum,
        isActive,
        code: code.trim() || null,
      },
      items: domainCartItems,
      now: new Date(),
      enteredCode: testCodeInput.trim() || null,
      totalRedemptions: 0,
      memberRedemptions: 0,
    });

    const subtotalPiasters = domainCartItems.reduce((acc, i) => acc + i.total, 0);

    return {
      applicable: result.applicable,
      reason: result.reason,
      discountPiasters: result.discount,
      subtotalPiasters,
      netPiasters: subtotalPiasters - result.discount,
      perItem: result.perItem,
    };
  }, [
    type,
    valueInput,
    maxDiscountEgp,
    minSubtotalEgp,
    itemKinds,
    planIds,
    startsAt,
    endsAt,
    maxUses,
    perMemberLimit,
    isActive,
    code,
    testCodeInput,
    activeCartItems,
  ]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCodeError(null);
    setFormError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFormError(isRtl ? "اسم العرض مطلوب" : "Promotion name is required");
      return;
    }

    const valNum = parseFloat(valueInput);
    if (isNaN(valNum) || valNum <= 0) {
      setFormError(
        isRtl ? "يرجى إدخال قيمة صحيحة للخصم أكبر من 0" : "Please enter a valid discount value > 0"
      );
      return;
    }

    if (type === "PERCENT" && valNum > 100) {
      setFormError(isRtl ? "النسبة المئوية لا يمكن أن تتجاوز 100%" : "Percentage cannot exceed 100%");
      return;
    }

    if (startsAt && endsAt) {
      if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
        setFormError(
          t("promotionsManagement.endsAtMustBeAfterStartsAt") ||
            "تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء"
        );
        return;
      }
    }

    const value = type === "PERCENT" ? valNum : Math.round(valNum * 100);
    const maxDiscount = maxDiscountEgp ? Math.round(parseFloat(maxDiscountEgp) * 100) : null;
    const minSubtotal = minSubtotalEgp ? Math.round(parseFloat(minSubtotalEgp) * 100) : null;
    const maxUsesInt = maxUses ? parseInt(maxUses, 10) : null;
    const perMemberInt = perMemberLimit ? parseInt(perMemberLimit, 10) : null;
    const trimmedCode = code.trim() ? code.trim().toUpperCase() : null;

    setIsSubmitting(true);
    try {
      let saved: Promotion;
      if (isEditing && promotionToEdit) {
        const dto: UpdatePromotionDto = {
          name: trimmedName,
          code: trimmedCode,
          type,
          value,
          maxDiscount,
          minSubtotal,
          itemKinds,
          planIds,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          maxUses: maxUsesInt,
          perMemberLimit: perMemberInt,
          isActive,
        };
        saved = await promotionsApi.updatePromotion(promotionToEdit.id, dto);
      } else {
        const dto: CreatePromotionDto = {
          name: trimmedName,
          code: trimmedCode,
          type,
          value,
          maxDiscount,
          minSubtotal,
          itemKinds,
          planIds,
          startsAt: startsAt ? new Date(startsAt).toISOString() : null,
          endsAt: endsAt ? new Date(endsAt).toISOString() : null,
          maxUses: maxUsesInt,
          perMemberLimit: perMemberInt,
        };
        saved = await promotionsApi.createPromotion(dto);
      }
      onSuccess(saved);
      onClose();
    } catch (err: any) {
      const errCode = err?.response?.data?.code || err?.code;
      if (errCode === "PROMOTION_CODE_EXISTS" || errCode === "CONFLICT" || err?.response?.status === 409) {
        setCodeError(
          t("promotionsManagement.codeExistsError") || "هذا الكود مستخدم بالفعل في هذا الفرع"
        );
      } else {
        setFormError(
          err?.response?.data?.message ||
            err?.message ||
            (isRtl ? "حدث خطأ أثناء حفظ العرض الترويجي" : "An error occurred saving promotion")
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="3xl"
      title={
        <div className="flex items-center justify-between pb-2 border-b border-[#E1E5DF] flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-[#C6F24E] text-[#14181F] flex items-center justify-center font-bold">
              <Tag className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-[#14181F]">
                {isEditing
                  ? (t("promotionsManagement.editPromotion") || "تعديل العرض الترويجي")
                  : (t("promotionsManagement.createPromotion") || "إنشاء عرض جديد")}
              </h3>
              <p className="text-xs text-[#5B6470] mt-0.5">
                {t("promotionsManagement.description") ||
                  "إعداد حملات الخصم، أكواد الكوبونات الترويجية، ومتابعة معدل الاستخدام والمبيعات"}
              </p>
            </div>
          </div>

          {/* Active Toggle */}
          <div className="flex items-center gap-2 bg-[#F2F4F1] px-3 py-1.5 rounded-xl border border-[#E1E5DF]">
            <span className="text-xs font-semibold text-[#14181F]">
              {isActive
                ? (t("promotionsManagement.active") || "مفعل")
                : (t("promotionsManagement.inactive") || "معطل")}
            </span>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border-[#E1E5DF] font-medium px-4 h-10"
          >
            {t("promotionsManagement.cancel") || "إلغاء"}
          </Button>
          <Button
            type="submit"
            form="promotion-form"
            disabled={isSubmitting}
            className="rounded-xl font-bold bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F] px-5 h-10 shadow-sm"
          >
            {isSubmitting
              ? (isRtl ? "جاري الحفظ..." : "Saving...")
              : isEditing
              ? (t("promotionsManagement.save") || "حفظ التعديلات")
              : (t("promotionsManagement.create") || "إنشاء العرض")}
          </Button>
        </div>
      }
    >
      <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
        <form id="promotion-form" onSubmit={handleSubmit} className="space-y-6">
              {formError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
                  {formError}
                </div>
              )}

              {/* General Info: Name & Code */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#14181F] flex items-center gap-1">
                    <span>{t("promotionsManagement.promotionName") || "اسم العرض"}</span>
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={
                      isRtl ? "مثال: خصم افتتاح الصيف 20%" : "e.g. Summer Opening 20% Off"
                    }
                    className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E] focus:ring-2 focus:ring-[#C6F24E]/20"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#14181F] flex items-center justify-between">
                    <span>{t("promotionsManagement.code") || "كود الخصم (اختياري)"}</span>
                    <span className="text-[11px] text-[#5B6470] font-normal">
                      {isRtl ? "فارغ = تلقائي بدون كود" : "Empty = automatic"}
                    </span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={code}
                      onChange={handleCodeChange}
                      placeholder={t("promotionsManagement.codePlaceholder") || "مثال: SUMMER25"}
                      className={`w-full h-10 px-3 uppercase font-mono tracking-wider rounded-xl border text-sm focus:outline-none focus:ring-2 ${
                        codeError
                          ? "border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/30"
                          : "border-[#E1E5DF] bg-white focus:border-[#C6F24E] focus:ring-[#C6F24E]/20"
                      }`}
                    />
                  </div>
                  {codeError ? (
                    <p className="text-[11px] text-red-600 font-semibold mt-1">{codeError}</p>
                  ) : (
                    <p className="text-[10px] text-[#5B6470]">
                      {t("promotionsManagement.codeHint") ||
                        "إذا تركته فارغاً، يطبق الخصم تلقائياً عند استيفاء الشروط"}
                    </p>
                  )}
                </div>
              </div>

              {/* Discount Type & Value */}
              <div className="p-4 rounded-xl bg-[#F2F4F1]/60 border border-[#E1E5DF] space-y-4">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <label className="text-xs font-bold text-[#14181F]">
                    {t("promotionsManagement.type") || "نوع الخصم وقيمته"}
                  </label>
                  <div className="flex rounded-lg bg-[#E1E5DF] p-0.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setType("PERCENT")}
                      className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                        type === "PERCENT"
                          ? "bg-white text-[#14181F] shadow-sm font-bold"
                          : "text-[#5B6470] hover:text-[#14181F]"
                      }`}
                    >
                      <Percent className="h-3 w-3" />
                      <span>{t("promotionsManagement.percent") || "نسبة مئوية (%)"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("FIXED")}
                      className={`px-3 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                        type === "FIXED"
                          ? "bg-white text-[#14181F] shadow-sm font-bold"
                          : "text-[#5B6470] hover:text-[#14181F]"
                      }`}
                    >
                      <Coins className="h-3 w-3" />
                      <span>{t("promotionsManagement.fixed") || "مبلغ ثابت (ج.م)"}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#14181F]">
                      {type === "PERCENT"
                        ? (t("promotionsManagement.percentValue") || "النسبة المئوية (%)")
                        : (t("promotionsManagement.fixedValue") || "المبلغ بالجنيه (ج.م)")}
                      <span className="text-red-500 ms-0.5">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step={type === "PERCENT" ? "1" : "0.5"}
                        min="0"
                        max={type === "PERCENT" ? "100" : undefined}
                        value={valueInput}
                        onChange={(e) => setValueInput(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
                        placeholder={type === "PERCENT" ? "20" : "200"}
                        required
                      />
                      <span className="absolute end-3 top-2.5 text-xs font-bold text-[#5B6470]">
                        {type === "PERCENT" ? "%" : t("promotionsManagement.egp") || "ج.م"}
                      </span>
                    </div>
                  </div>

                  {type === "PERCENT" && (
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-[#14181F]">
                        {t("promotionsManagement.maxDiscount") || "أقصى خصم (ج.م)"}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="0"
                          value={maxDiscountEgp}
                          onChange={(e) => setMaxDiscountEgp(e.target.value)}
                          placeholder={isRtl ? "مثال: 500 (اختياري)" : "e.g. 500 (optional)"}
                          className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
                        />
                        <span className="absolute end-3 top-2.5 text-xs text-[#5B6470]">
                          {t("promotionsManagement.egp") || "ج.م"}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-[#14181F]">
                      {t("promotionsManagement.minSubtotal") || "الحد الأدنى للسلة (ج.م)"}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="1"
                        min="0"
                        value={minSubtotalEgp}
                        onChange={(e) => setMinSubtotalEgp(e.target.value)}
                        placeholder={isRtl ? "مثال: 1000 (اختياري)" : "e.g. 1000 (optional)"}
                        className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-sm focus:outline-none focus:border-[#C6F24E]"
                      />
                      <span className="absolute end-3 top-2.5 text-xs text-[#5B6470]">
                        {t("promotionsManagement.egp") || "ج.م"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Scope: Item Kinds & Specific Plans */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Item Kinds */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#14181F] flex items-center justify-between">
                    <span>{t("promotionsManagement.itemKinds") || "البنود المشمولة"}</span>
                    <span className="text-[11px] text-[#5B6470] font-normal">
                      {itemKinds.length === 0
                        ? (t("promotionsManagement.allItemKinds") || "يشمل جميع البنود")
                        : `${itemKinds.length} محددة`}
                    </span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { key: "SUBSCRIPTION", label: t("promotionsManagement.subscription") || "الاشتراكات", icon: Layers },
                        { key: "SERVICE", label: t("promotionsManagement.service") || "الخدمات", icon: Sparkles },
                        { key: "PRODUCT", label: t("promotionsManagement.product") || "البار والمنتجات", icon: ShoppingBag },
                      ] as const
                    ).map((k) => {
                      const isSelected = itemKinds.includes(k.key);
                      const Icon = k.icon;
                      return (
                        <button
                          key={k.key}
                          type="button"
                          onClick={() => toggleItemKind(k.key)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 border transition-all ${
                            isSelected
                              ? "bg-[#14181F] text-[#C6F24E] border-[#14181F] shadow-sm"
                              : "bg-white text-[#5B6470] border-[#E1E5DF] hover:border-[#14181F]"
                          }`}
                        >
                          <Icon className="h-3.5 w-3.5" />
                          <span>{k.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Specific Plans */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-[#14181F] flex items-center justify-between">
                    <span>{t("promotionsManagement.specificPlans") || "باقات محددة"}</span>
                    <span className="text-[11px] text-[#5B6470] font-normal">
                      {planIds.length === 0
                        ? (t("promotionsManagement.allPlans") || "جميع الباقات")
                        : `${planIds.length} باقات محددة`}
                    </span>
                  </label>
                  <div className="max-h-28 overflow-y-auto p-2 rounded-xl border border-[#E1E5DF] bg-white space-y-1">
                    {availablePlans.length === 0 ? (
                      <p className="text-[11px] text-[#5B6470] p-1">
                        {isRtl ? "جاري تحميل الباقات..." : "Loading plans..."}
                      </p>
                    ) : (
                      availablePlans.map((p) => {
                        const checked = planIds.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer transition-colors ${
                              checked ? "bg-[#F2F4F1] font-bold text-[#14181F]" : "text-[#5B6470] hover:bg-gray-50"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => togglePlanId(p.id)}
                              className="rounded border-[#E1E5DF] text-[#14181F] focus:ring-[#C6F24E]"
                            />
                            <span className="truncate">{p.name}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Dates & Usage Limits */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#14181F] flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-[#5B6470]" />
                    <span>{t("promotionsManagement.startsAt") || "تاريخ البدء"}</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl border border-[#E1E5DF] bg-white text-xs focus:outline-none focus:border-[#C6F24E]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#14181F] flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-[#5B6470]" />
                    <span>{t("promotionsManagement.endsAt") || "تاريخ الانتهاء"}</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={endsAt}
                    onChange={(e) => setEndsAt(e.target.value)}
                    className="w-full h-10 px-2 rounded-xl border border-[#E1E5DF] bg-white text-xs focus:outline-none focus:border-[#C6F24E]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#14181F]">
                    {t("promotionsManagement.maxUses") || "أقصى استخدام إجمالي"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={maxUses}
                    onChange={(e) => setMaxUses(e.target.value)}
                    placeholder={isRtl ? "فارغ = غير محدود" : "Empty = unlimited"}
                    className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-xs focus:outline-none focus:border-[#C6F24E]"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-[#14181F]">
                    {t("promotionsManagement.perMemberLimit") || "الحد لكل مشترك"}
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={perMemberLimit}
                    onChange={(e) => setPerMemberLimit(e.target.value)}
                    placeholder={isRtl ? "مثلاً 1" : "e.g. 1"}
                    className="w-full h-10 px-3 rounded-xl border border-[#E1E5DF] bg-white text-xs focus:outline-none focus:border-[#C6F24E]"
                  />
                </div>
              </div>
            </form>

            {/* LIVE PREVIEW PANEL */}
            <div className="mt-6 pt-5 border-t border-[#E1E5DF] space-y-4 bg-[#F8F9F8] p-4 sm:p-5 rounded-2xl border">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-bold">
                    <Sparkles className="h-4 w-4" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-[#14181F]">
                      {t("promotionsManagement.livePreviewTitle") || "معاينة الحسبة المباشرة (Live Preview)"}
                    </h4>
                    <p className="text-[11px] text-[#5B6470]">
                      {t("promotionsManagement.livePreviewDesc") ||
                        "محاكاة مطابقة 100% لنفس كود حسابات الكاشير (POS) باستخدام محرك العروض"}
                    </p>
                  </div>
                </div>

                {/* Sample Cart Preset Selector */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-[#5B6470] font-medium me-1">
                    {t("promotionsManagement.sampleCart") || "السلة التجريبية:"}
                  </span>
                  {(
                    [
                      { key: "sub", label: t("promotionsManagement.sampleSubOnly") || "باقة سنوية VIP" },
                      { key: "service_product", label: t("promotionsManagement.sampleServiceProduct") || "مساج + بروتين" },
                      { key: "mixed", label: t("promotionsManagement.sampleMixed") || "سلة مختلطة" },
                      { key: "custom", label: t("promotionsManagement.customCart") || "مخصصة" },
                    ] as const
                  ).map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setPreviewCartPreset(preset.key)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                        previewCartPreset === preset.key
                          ? "bg-[#14181F] text-white shadow-sm"
                          : "bg-white text-[#5B6470] border border-[#E1E5DF] hover:bg-gray-100"
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Test Code Input & Custom Cart Controls */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-[#E1E5DF] text-xs">
                  <Tag className="h-3.5 w-3.5 text-[#5B6470]" />
                  <span className="text-[#5B6470] font-medium">
                    {t("promotionsManagement.testPromoCode") || "كود التجربة:"}
                  </span>
                  <input
                    type="text"
                    value={testCodeInput}
                    onChange={(e) => setTestCodeInput(e.target.value.toUpperCase())}
                    placeholder={code || (isRtl ? "بدون كود" : "No code")}
                    className="w-28 font-mono uppercase font-bold text-[#14181F] outline-none"
                  />
                  {testCodeInput && (
                    <button
                      type="button"
                      onClick={() => setTestCodeInput("")}
                      className="text-gray-400 hover:text-gray-600 text-xs"
                      title={isRtl ? "مسح الكود لاختبار الخصم بدون كود" : "Clear code"}
                    >
                      ✕
                    </button>
                  )}
                </div>

                {previewCartPreset === "custom" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const newId = `custom_${Date.now()}`;
                      setCustomCartItems([
                        ...customCartItems,
                        {
                          id: newId,
                          name: `بند مخصص ${customCartItems.length + 1}`,
                          kind: "SUBSCRIPTION",
                          planId: availablePlans[0]?.id || null,
                          priceEgp: 500,
                        },
                      ]);
                    }}
                    className="h-8 text-xs gap-1 rounded-lg border-[#E1E5DF]"
                  >
                    <Plus className="h-3 w-3" />
                    <span>{isRtl ? "إضافة بند تجريبي" : "Add item"}</span>
                  </Button>
                )}
              </div>

              {/* Custom cart item rows editor */}
              {previewCartPreset === "custom" && customCartItems.length > 0 && (
                <div className="p-2.5 bg-white rounded-xl border border-[#E1E5DF] space-y-2">
                  {customCartItems.map((item, idx) => (
                    <div key={item.id} className="flex items-center gap-2 text-xs flex-wrap">
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => {
                          const val = e.target.value;
                          setCustomCartItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, name: val } : it))
                          );
                        }}
                        className="px-2 py-1 border rounded w-36"
                      />
                      <select
                        value={item.kind}
                        onChange={(e) => {
                          const k = e.target.value as ItemKind;
                          setCustomCartItems((prev) =>
                            prev.map((it, i) => (i === idx ? { ...it, kind: k } : it))
                          );
                        }}
                        className="px-2 py-1 border rounded"
                      >
                        <option value="SUBSCRIPTION">اشتراك باقة</option>
                        <option value="SERVICE">خدمة إضافية</option>
                        <option value="PRODUCT">منتج بار</option>
                      </select>
                      {item.kind === "SUBSCRIPTION" && (
                        <select
                          value={item.planId || ""}
                          onChange={(e) => {
                            const pid = e.target.value || null;
                            setCustomCartItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, planId: pid } : it))
                            );
                          }}
                          className="px-2 py-1 border rounded max-w-[140px]"
                        >
                          <option value="">(بدون باقة محددة)</option>
                          {availablePlans.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name}
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="10"
                          min="0"
                          value={item.priceEgp}
                          onChange={(e) => {
                            const pr = parseFloat(e.target.value) || 0;
                            setCustomCartItems((prev) =>
                              prev.map((it, i) => (i === idx ? { ...it, priceEgp: pr } : it))
                            );
                          }}
                          className="px-2 py-1 border rounded w-20"
                        />
                        <span>ج.م</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomCartItems((prev) => prev.filter((_, i) => i !== idx));
                        }}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Preview Outcome Banner */}
              {livePreviewResult.applicable ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-sm">
                        {isRtl ? "ينطبق العرض بنجاح على هذه السلة!" : "Promotion applies successfully!"}
                      </span>
                      <p className="text-xs text-emerald-700">
                        {isRtl ? "إجمالي التخفيض الممنوح:" : "Total discount:"}{" "}
                        <b className="font-mono text-sm">
                          {(livePreviewResult.discountPiasters / 100).toFixed(2)}{" "}
                          {t("promotionsManagement.egp") || "ج.م"}
                        </b>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs bg-white/80 px-3 py-1.5 rounded-lg border border-emerald-300">
                    <div>
                      <span className="text-[#5B6470] block">
                        {t("promotionsManagement.cartTotalBefore") || "قبل الخصم:"}
                      </span>
                      <span className="font-bold text-[#14181F]">
                        {(livePreviewResult.subtotalPiasters / 100).toFixed(2)} ج.م
                      </span>
                    </div>
                    <div className="text-emerald-700 font-bold">→</div>
                    <div>
                      <span className="text-emerald-800 font-bold block">
                        {t("promotionsManagement.cartTotalAfter") || "الصافي بعد الخصم:"}
                      </span>
                      <span className="font-black text-emerald-900 text-sm">
                        {(livePreviewResult.netPiasters / 100).toFixed(2)} ج.م
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 flex items-start gap-2.5">
                  <XCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-sm">
                      {isRtl ? "العرض لا ينطبق على هذه السلة" : "Promotion does not apply to this cart"}
                    </span>
                    <p className="text-xs text-amber-800 mt-0.5">
                      <span className="font-semibold">
                        {t("promotionsManagement.denialReason") || "سبب الرفض:"}{" "}
                      </span>
                      {livePreviewResult.reason &&
                        (t(`promotionsManagement.reason_${livePreviewResult.reason}`) ||
                          livePreviewResult.reason)}
                    </p>
                  </div>
                </div>
              )}

              {/* Pro-Rata Per-Item Split Table */}
              <div className="bg-white rounded-xl border border-[#E1E5DF] overflow-hidden text-xs">
                <div className="px-3 py-2 bg-[#F2F4F1] border-b border-[#E1E5DF] font-bold text-[#14181F] flex items-center justify-between">
                  <span>
                    {t("promotionsManagement.perItemSplit") ||
                      "توزيع الخصم بالتناسب على البنود (Pro-Rata)"}
                  </span>
                  <span className="text-[11px] text-[#5B6470] font-normal">
                    {activeCartItems.length} {isRtl ? "عناصر بالسلة" : "items"}
                  </span>
                </div>

                <div className="divide-y divide-[#E1E5DF]">
                  {activeCartItems.map((item) => {
                    const split = livePreviewResult.perItem.find((p) => p.id === item.id);
                    const discountPiasters = split ? split.discount : 0;
                    const itemTotalPiasters = Math.round(item.priceEgp * 100);
                    const netPiasters = itemTotalPiasters - discountPiasters;

                    return (
                      <div
                        key={item.id}
                        className="px-3 py-2 flex items-center justify-between gap-3 hover:bg-gray-50/60"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#14181F] truncate">{item.name}</p>
                          <span className="text-[10px] text-[#5B6470] capitalize">
                            {item.kind === "SUBSCRIPTION"
                              ? "اشتراك باقة"
                              : item.kind === "SERVICE"
                              ? "خدمة"
                              : "منتج بار"}
                          </span>
                        </div>

                        <div className="flex items-center gap-4 text-end shrink-0 font-mono">
                          <div>
                            <span className="text-[10px] text-[#5B6470] block">
                              {t("promotionsManagement.originalPrice") || "الأصلي"}
                            </span>
                            <span className="text-gray-700">{item.priceEgp.toFixed(2)} ج.م</span>
                          </div>

                          <div className={discountPiasters > 0 ? "text-emerald-700 font-bold" : "text-gray-400"}>
                            <span className="text-[10px] text-[#5B6470] block">
                              {t("promotionsManagement.discountAmount") || "الخصم"}
                            </span>
                            <span>
                              {discountPiasters > 0
                                ? `-${(discountPiasters / 100).toFixed(2)}`
                                : "0.00"}{" "}
                              ج.م
                            </span>
                          </div>

                          <div>
                            <span className="text-[10px] text-[#5B6470] block">
                              {t("promotionsManagement.netPrice") || "الصافي"}
                            </span>
                            <span className="font-bold text-[#14181F]">
                              {(netPiasters / 100).toFixed(2)} ج.م
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
    </Dialog>
  );
}
