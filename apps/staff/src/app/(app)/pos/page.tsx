"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ShoppingBag,
  Plus,
  Minus,
  Trash2,
  Tag,
  Search,
  User,
  Wallet as WalletIcon,
  CheckCircle,
  AlertTriangle,
  Receipt,
  Printer,
  CreditCard,
  Banknote,
  Smartphone,
  RotateCcw,
} from "lucide-react";
import {
  useToast,
  Button,
  Dialog,
} from "@gym/ui";
import {
  toMinor,
  fromMinor,
  evaluatePromotion,
  validateManualDiscount,
  planWalletUse,
  settleTender,
  activationDecision,
  balanceDueDate,
  allocateAcrossItems,
  allocateProRata,
  type CartItem as DomainCartItem,
  type Minor,
} from "@gym/domain";
import { sellApi } from "../../../features/sell/api";
import { coachOpsApi } from "../../../features/coach-ops/api";
import { useShift } from "../../../lib/shift-context";
import { formatMoney } from "../../../lib/money";
import type {
  Plan,
  Service,
  Product,
  Promotion,
  Member,
  Wallet,
  Staff,
  ClassScheduleWithDetails,
  InvoiceDetail,
} from "@gym/contracts";

interface CartLine {
  cartId: string;
  kind: "SUBSCRIPTION" | "SERVICE" | "PRODUCT";
  title: string;
  planId?: string;
  serviceId?: string;
  productId?: string;
  quantity: number;
  unitPrice: Minor;
  startDate?: string;
  coachId?: string;
  coachName?: string;
  classSlotId?: string;
  className?: string;
  freezeMaxCount?: number;
  freezeMaxTotalDays?: number;
  durationDays?: number;
  minUpfrontPercent?: number;
}

export default function PosSellPage() {
  const { toast } = useToast();
  const { shift: currentShift } = useShift();

  // Catalog data
  const [plans, setPlans] = useState<Plan[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [coaches, setCoaches] = useState<Staff[]>([]);
  const [classSchedules, setClassSchedules] = useState<ClassScheduleWithDetails[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  // Active view & filters
  const [activeTab, setActiveTab] = useState<"plans" | "services" | "products">("plans");
  const [catalogSearch, setCatalogSearch] = useState("");

  // Customer selection
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [memberWallet, setMemberWallet] = useState<Wallet | null>(null);
  const [isWalkIn, setIsWalkIn] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartLine[]>([]);

  // Configure Plan Modal
  const [configuringPlan, setConfiguringPlan] = useState<Plan | null>(null);
  const [planStartDate, setPlanStartDate] = useState("2026-11-04");
  const [planCoachId, setPlanCoachId] = useState<string>("");
  const [planClassSlotId, setPlanClassSlotId] = useState<string>("");
  const [planFreezeCount, setPlanFreezeCount] = useState<number>(0);
  const [planFreezeDays, setPlanFreezeDays] = useState<number>(0);

  // Discounts
  const [promoCodeInput, setPromoCodeInput] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<Promotion | null>(null);
  const [promoError, setPromoError] = useState<string | null>(null);

  // Manual Discount
  const [manualDiscountActive, setManualDiscountActive] = useState(false);
  const [manualDiscountType, setManualDiscountType] = useState<"fixed" | "percent">("fixed");
  const [manualDiscountValue, setManualDiscountValue] = useState("");
  const [manualDiscountNote, setManualDiscountNote] = useState("");

  // Payments
  const [useWallet, setUseWallet] = useState(true);
  const [cashAmountStr, setCashAmountStr] = useState("");
  const [instapayAmountStr, setInstapayAmountStr] = useState("");
  const [instapayRef, setInstapayRef] = useState("");
  const [cardAmountStr, setCardAmountStr] = useState("");
  const [invoiceNote, setInvoiceNote] = useState("");

  // Modals
  const [completedInvoice, setCompletedInvoice] = useState<InvoiceDetail | null>(null);
  const [printModalOpen, setPrintModalOpen] = useState(false);
  const [printFormat, setPrintFormat] = useState<"80mm" | "a4">("80mm");

  // Collect balance & Vouchers & Recent invoices
  const [collectBalanceModalOpen, setCollectBalanceModalOpen] = useState(false);
  const [vouchersModalOpen, setVouchersModalOpen] = useState(false);
  const [recentInvoicesList, setRecentInvoicesList] = useState<InvoiceDetail[]>([]);

  // Manual coach assignment from rotation result
  const [manualAssignProfileId, setManualAssignProfileId] = useState<string | null>(null);
  const [selectedManualCoachId, setSelectedManualCoachId] = useState<string>("");
  const [isManualAssignLoading, setIsManualAssignLoading] = useState(false);

  const handleConfirmManualAssign = async () => {
    if (!manualAssignProfileId || !selectedManualCoachId) return;
    setIsManualAssignLoading(true);
    try {
      await coachOpsApi.assignManually(manualAssignProfileId, { coachId: selectedManualCoachId });
      toast({
        title: "تم تعيين المدرب بنجاح",
        description: "تم تعيين المدرب ومنح الجلسات المجانية للعضو الجديد",
        variant: "success",
      });
      setManualAssignProfileId(null);
    } catch (err: any) {
      toast({
        title: "فشل تعيين المدرب",
        description: err.message || "حدث خطأ أثناء التعيين اليدوي",
        variant: "error",
      });
    } finally {
      setIsManualAssignLoading(false);
    }
  };

  // Collect Balance state
  const [selectedInvoiceToPay, setSelectedInvoiceToPay] = useState<InvoiceDetail | null>(null);
  const [collectMethod, setCollectMethod] = useState<"CASH" | "INSTAPAY" | "CARD">("CASH");
  const [collectAmountStr, setCollectAmountStr] = useState("");

  // Voucher state
  const [voucherType, setVoucherType] = useState<"RECEIPT" | "DISBURSEMENT">("RECEIPT");
  const [voucherMethod, setVoucherMethod] = useState<"CASH" | "INSTAPAY" | "CARD">("CASH");
  const [voucherAmountStr, setVoucherAmountStr] = useState("");
  const [voucherReason, setVoucherReason] = useState("");
  const [voucherCreditWallet, setVoucherCreditWallet] = useState(true);

  // Load initial catalog data
  const loadCatalog = async () => {
    try {
      setLoading(true);
      const [p, s, prod, promo, c, cs, m] = await Promise.all([
        sellApi.listPlans(),
        sellApi.listServices(),
        sellApi.listProducts(),
        sellApi.listPromotions(),
        sellApi.listCoaches(),
        sellApi.listClassSchedules(),
        sellApi.listMembers(),
      ]);
      setPlans(p);
      setServices(s);
      setProducts(prod);
      setPromotions(promo);
      setCoaches(c);
      setClassSchedules(cs);
      setMembers(m);

      // Default select member 1001 for demonstration
      const defaultMem = m.find((mem: Member) => mem.code === "1001") || m[0] || null;
      if (defaultMem) {
        handleSelectMember(defaultMem);
      }
    } catch (err) {
      toast({
        title: "خطأ في تحميل الكتالوج",
        description: String(err),
        variant: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCatalog();
  }, []);

  const handleSelectMember = async (member: Member | null) => {
    setSelectedMember(member);
    setIsWalkIn(false);
    if (member) {
      try {
        const wallet = await sellApi.getMemberWallet(member.id);
        setMemberWallet(wallet);
      } catch {
        setMemberWallet(null);
      }
    } else {
      setMemberWallet(null);
    }
  };

  // Add Product directly to cart
  const handleAddProduct = (prod: Product) => {
    if (prod.stock <= 0) {
      toast({
        title: "المنتج غير متوفر",
        description: `نفد المخزون للمنتج (${prod.name})`,
        variant: "warning",
      });
      return;
    }
    setCart((prev) => {
      const existing = prev.find((i) => i.productId === prod.id);
      if (existing) {
        if (existing.quantity >= prod.stock) {
          toast({
            title: "تنبيه المخزون",
            description: `أقصى كمية متاحة في المخزن هي ${prod.stock}`,
            variant: "warning",
          });
          return prev;
        }
        return prev.map((i) =>
          i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          cartId: "line_" + Math.random().toString(36).slice(2, 9),
          kind: "PRODUCT",
          title: prod.name,
          productId: prod.id,
          unitPrice: prod.price,
          quantity: 1,
        },
      ];
    });
    toast({
      title: "أضيف إلى الفاتورة",
      description: `${prod.name} (${formatMoney(prod.price)})`,
    });
  };

  // Add Service directly to cart
  const handleAddService = (srv: Service) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.serviceId === srv.id);
      if (existing) {
        return prev.map((i) =>
          i.cartId === existing.cartId ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [
        ...prev,
        {
          cartId: "line_" + Math.random().toString(36).slice(2, 9),
          kind: "SERVICE",
          title: srv.name,
          serviceId: srv.id,
          unitPrice: srv.price,
          quantity: 1,
        },
      ];
    });
    toast({
      title: "أضيفت الخدمة",
      description: `${srv.name} (${formatMoney(srv.price)})`,
    });
  };

  // Open plan configuration modal
  const handleOpenPlanConfig = (plan: Plan) => {
    if (isWalkIn || !selectedMember) {
      toast({
        title: "تنبيه العميل",
        description: "يجب اختيار عضو مسجل لشراء اشتراك رياضي (الزائر لا يشتري اشتراكات)",
        variant: "warning",
      });
      return;
    }
    setConfiguringPlan(plan);
    setPlanStartDate("2026-11-04");
    setPlanCoachId(coaches[0]?.id || "");
    setPlanClassSlotId(classSchedules[0]?.id || "");
    setPlanFreezeCount(plan.freezeMaxCount);
    setPlanFreezeDays(plan.freezeMaxTotalDays);
  };

  // Confirm plan addition to cart
  const handleConfirmAddPlan = () => {
    if (!configuringPlan) return;
    const coach = coaches.find((c) => c.id === planCoachId);
    const cls = classSchedules.find((cs) => cs.id === planClassSlotId);

    const title =
      configuringPlan.kind === "PT"
        ? `${configuringPlan.name} · ${coach ? coach.name : "بدون مدرب"}`
        : configuringPlan.kind === "CLASS"
        ? `${configuringPlan.name} · ${cls ? cls.name : "حصة محددة"}`
        : configuringPlan.name;

    setCart((prev) => [
      ...prev,
      {
        cartId: "line_" + Math.random().toString(36).slice(2, 9),
        kind: "SUBSCRIPTION",
        title,
        planId: configuringPlan.id,
        unitPrice: configuringPlan.price,
        quantity: 1,
        startDate: planStartDate,
        coachId: configuringPlan.kind === "PT" ? planCoachId : undefined,
        coachName: configuringPlan.kind === "PT" ? coach?.name : undefined,
        classSlotId: configuringPlan.kind === "CLASS" ? planClassSlotId : undefined,
        className: configuringPlan.kind === "CLASS" ? cls?.name : undefined,
        freezeMaxCount: planFreezeCount,
        freezeMaxTotalDays: planFreezeDays,
        durationDays: configuringPlan.durationDays,
        minUpfrontPercent: configuringPlan.minUpfrontPercent ?? 50,
      },
    ]);

    setConfiguringPlan(null);
    toast({
      title: "تم إضافة الاشتراك للسلة",
      description: `${title} (${formatMoney(configuringPlan.price)})`,
    });
  };

  // Cart operations
  const updateQuantity = (cartId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => {
          if (i.cartId !== cartId) return i;
          const nextQty = i.quantity + delta;
          if (nextQty <= 0) return null;
          return { ...i, quantity: nextQty };
        })
        .filter(Boolean) as CartLine[]
    );
  };

  const removeCartItem = (cartId: string) => {
    setCart((prev) => prev.filter((i) => i.cartId !== cartId));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedPromo(null);
    setPromoCodeInput("");
    setPromoError(null);
    setManualDiscountActive(false);
    setManualDiscountValue("");
    setManualDiscountNote("");
    setCashAmountStr("");
    setInstapayAmountStr("");
    setCardAmountStr("");
  };

  // Subtotal in piasters
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  }, [cart]);

  // Promotions evaluation
  const handleApplyPromoCode = async (codeToApply?: string) => {
    const code = (codeToApply ?? promoCodeInput).trim();
    if (!code) return;
    setPromoError(null);

    const domainCartItems: DomainCartItem[] = cart.map((item) => ({
      id: item.cartId,
      kind: item.kind,
      planId: item.planId,
      total: item.unitPrice * item.quantity,
    }));

    if (domainCartItems.length === 0) {
      setPromoError("السلة فارغة، يرجى إضافة عناصر أولاً");
      return;
    }

    const reasonMessages: Record<string, string> = {
      INACTIVE: "العرض غير نشط",
      NOT_STARTED: "العرض لم يبدأ بعد",
      EXPIRED: "انتهت صلاحية هذا العرض الترويجي",
      WRONG_CODE: "كود الخصم غير صحيح",
      MAX_USES_REACHED: "تم استنفاد الحد الأقصى لاستخدام الكوبون",
      MEMBER_LIMIT_REACHED: "العضو استنفد مرات الاستخدام المسموحة",
      NOTHING_ELIGIBLE: "لا توجد عناصر في السلة مشمولة بهذا العرض",
      BELOW_MIN_SUBTOTAL: "إجمالي السلة أقل من الحد الأدنى لتطبيق هذا الخصم",
    };

    try {
      const previewRes = await sellApi.previewPromotion({
        code,
        memberId: selectedMember?.id,
        items: domainCartItems.map((i) => ({
          id: i.id,
          kind: i.kind,
          planId: i.planId,
          total: i.total,
        })),
      });

      const promo =
        promotions.find((p) => p.id === previewRes.promotionId) ||
        promotions.find((p) => p.code?.trim().toLowerCase() === code.toLowerCase()) ||
        ({
          id: previewRes.promotionId,
          name: previewRes.promotionName,
          code,
          type: "FIXED",
          value: previewRes.discount,
          itemKinds: [],
          isActive: true,
          usedCount: 0,
        } as any);

      setAppliedPromo(promo);
      setManualDiscountActive(false);
      toast({
        title: "تم تطبيق الخصم بنجاح",
        description: `${previewRes.promotionName} (-${formatMoney(previewRes.discount)})`,
        variant: "success",
      });
    } catch (err: any) {
      const errCode = err?.response?.data?.code || err?.code;
      if (errCode && reasonMessages[errCode]) {
        setPromoError(reasonMessages[errCode]);
        setAppliedPromo(null);
        return;
      }

      // Fallback to local evaluatePromotion if backend unavailable
      const promo = promotions.find((p) => p.code?.trim().toLowerCase() === code.toLowerCase());
      if (!promo) {
        setPromoError("كود الخصم غير موجود");
        setAppliedPromo(null);
        return;
      }

      const result = evaluatePromotion({
        promo: {
          type: promo.type,
          value: promo.value,
          maxDiscount: promo.maxDiscount,
          minSubtotal: promo.minSubtotal,
          itemKinds: promo.itemKinds,
          planIds: promo.planIds || [],
          startsAt: promo.startsAt ? new Date(promo.startsAt) : null,
          endsAt: promo.endsAt ? new Date(promo.endsAt) : null,
          maxUses: promo.maxUses,
          perMemberLimit: promo.perMemberLimit,
          isActive: promo.isActive,
          code: promo.code,
        },
        items: domainCartItems,
        now: new Date(),
        enteredCode: code,
        totalRedemptions: promo.usedCount,
        memberRedemptions: 0,
      });

      if (!result.applicable) {
        setPromoError(reasonMessages[result.reason || ""] || "لا يمكن تطبيق هذا العرض");
        setAppliedPromo(null);
        return;
      }

      setAppliedPromo(promo);
      setManualDiscountActive(false);
      toast({
        title: "تم تطبيق الخصم بنجاح",
        description: `${promo.name} (-${formatMoney(result.discount)})`,
        variant: "success",
      });
    }
  };

  // Discount calculation
  const discountCalculation = useMemo(() => {
    if (subtotal <= 0) return { discount: 0, perItem: [] };

    // Case 1: Applied Promotion
    if (appliedPromo) {
      const domainCartItems: DomainCartItem[] = cart.map((item) => ({
        id: item.cartId,
        kind: item.kind,
        planId: item.planId,
        total: item.unitPrice * item.quantity,
      }));
      const res = evaluatePromotion({
        promo: {
          type: appliedPromo.type,
          value: appliedPromo.value,
          maxDiscount: appliedPromo.maxDiscount,
          minSubtotal: appliedPromo.minSubtotal,
          itemKinds: appliedPromo.itemKinds,
          planIds: appliedPromo.planIds || [],
          startsAt: appliedPromo.startsAt ? new Date(appliedPromo.startsAt) : null,
          endsAt: appliedPromo.endsAt ? new Date(appliedPromo.endsAt) : null,
          maxUses: appliedPromo.maxUses,
          perMemberLimit: appliedPromo.perMemberLimit,
          isActive: appliedPromo.isActive,
          code: appliedPromo.code,
        },
        items: domainCartItems,
        now: new Date(),
        enteredCode: appliedPromo.code,
        totalRedemptions: appliedPromo.usedCount,
        memberRedemptions: 0,
      });
      return { discount: res.discount, perItem: res.perItem };
    }

    // Case 2: Manual Discount
    if (manualDiscountActive) {
      const parsedVal = parseFloat(manualDiscountValue) || 0;
      let manualMinor =
        manualDiscountType === "fixed"
          ? toMinor(parsedVal)
          : Math.round((subtotal * parsedVal) / 100);

      manualMinor = Math.min(manualMinor, subtotal);
      if (manualMinor > 0) {
        const parts = allocateProRata(
          manualMinor,
          cart.map((i) => i.unitPrice * i.quantity)
        );
        return {
          discount: manualMinor,
          perItem: cart.map((i, idx) => ({ id: i.cartId, discount: parts[idx] ?? 0 })),
        };
      }
    }

    return { discount: 0, perItem: [] };
  }, [subtotal, appliedPromo, manualDiscountActive, manualDiscountType, manualDiscountValue, cart]);

  const discount = discountCalculation.discount;
  const netTotal = Math.max(0, subtotal - discount);

  // Wallet calculation
  const walletBalance = memberWallet ? memberWallet.balance : 0;
  const walletPlan = useMemo(() => {
    if (!useWallet || walletBalance <= 0 || netTotal <= 0) {
      return { fromWallet: 0, remainingDue: netTotal };
    }
    return planWalletUse({
      balance: walletBalance,
      due: netTotal,
      autoApply: true,
    });
  }, [useWallet, walletBalance, netTotal]);

  const fromWallet = walletPlan.fromWallet;
  const dueAfterWallet = walletPlan.remainingDue;

  // Tendered amounts
  const cashPiasters = toMinor(parseFloat(cashAmountStr) || 0);
  const instapayPiasters = toMinor(parseFloat(instapayAmountStr) || 0);
  const cardPiasters = toMinor(parseFloat(cardAmountStr) || 0);
  const otherTendered = cashPiasters + instapayPiasters + cardPiasters;

  // Settle tender (handling overpayment excess to wallet)
  const tenderSettlement = useMemo(() => {
    return settleTender({
      due: dueAfterWallet,
      tendered: otherTendered,
    });
  }, [dueAfterWallet, otherTendered]);

  const totalCollected = fromWallet + tenderSettlement.applied;
  const remainingDue = Math.max(0, netTotal - totalCollected);
  const excessCreditToWallet = tenderSettlement.walletCredit;

  // Subscription Activation Decision
  const activation = useMemo(() => {
    const subItems = cart.filter((i) => i.kind === "SUBSCRIPTION");
    if (subItems.length === 0) return null;

    // Use minimum upfront from the plan (e.g. 50%)
    const minPercent = subItems[0]?.minUpfrontPercent ?? 50;
    const subTotalNet = subItems.reduce((s, item) => {
      const itemDisc = discountCalculation.perItem.find((p) => p.id === item.cartId)?.discount || 0;
      return s + (item.unitPrice * item.quantity - itemDisc);
    }, 0);

    const allocatedCollected = allocateAcrossItems(totalCollected, [subTotalNet])[0] ?? 0;

    const dec = activationDecision({
      total: subTotalNet,
      collected: allocatedCollected,
      minUpfrontPercent: minPercent,
    });

    // Check balance due date if remaining balance
    const dueDate = balanceDueDate({
      startDate: new Date("2026-11-04"),
      durationDays: subItems[0]?.durationDays || 30,
      dueAfterDays: 14,
      dueAfterPercent: 20,
    });

    return {
      ...dec,
      minPercent,
      dueDateFormatted: dueDate ? dueDate.toISOString().slice(0, 10) : null,
    };
  }, [cart, discountCalculation, totalCollected]);

  // Checkout Handler
  const handleCheckout = async () => {
    if (!currentShift || currentShift.status !== "OPEN") {
      toast({
        title: "الوردية مغلقة",
        description: "يجب فتح الوردية وتسجيل العهدة النقدية أولاً لإتمام عمليات البيع",
        variant: "error",
      });
      return;
    }

    if (cart.length === 0) {
      toast({
        title: "السلة فارغة",
        description: "يرجى إضافة عناصر إلى الفاتورة أولاً",
        variant: "warning",
      });
      return;
    }

    const hasSub = cart.some((i) => i.kind === "SUBSCRIPTION");
    if (hasSub && !selectedMember) {
      toast({
        title: "تحديد العضو مطلوب",
        description: "لا يمكن شراء اشتراكات للعميل الزائر (Walk-in)، يرجى تحديد عضو مسجل",
        variant: "error",
      });
      return;
    }

    if (manualDiscountActive) {
      const valResult = validateManualDiscount({
        subtotal,
        discount: discount,
        note: manualDiscountNote,
      });
      if (valResult === "NOTE_REQUIRED") {
        toast({
          title: "سبب الخصم اليدوي مطلوب",
          description: "يجب إدخال سبب/ملاحظة واضحة للخصم اليدوي",
          variant: "error",
        });
        return;
      }
      if (valResult === "EXCEEDS_SUBTOTAL") {
        toast({
          title: "قيمة الخصم غير صالحة",
          description: "قيمة الخصم تتجاوز إجمالي الفاتورة",
          variant: "error",
        });
        return;
      }
    }

    try {
      const paymentRows: { method: "CASH" | "INSTAPAY" | "CARD"; amount: Minor; reference?: string }[] = [];
      if (cashPiasters > 0) paymentRows.push({ method: "CASH", amount: cashPiasters });
      if (instapayPiasters > 0)
        paymentRows.push({ method: "INSTAPAY", amount: instapayPiasters, reference: instapayRef });
      if (cardPiasters > 0) paymentRows.push({ method: "CARD", amount: cardPiasters });

      const invoice = await sellApi.createInvoice({
        memberId: selectedMember?.id || null,
        items: cart.map((i) => ({
          kind: i.kind,
          planId: i.planId,
          serviceId: i.serviceId,
          productId: i.productId,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          subscription:
            i.kind === "SUBSCRIPTION"
              ? {
                  startDate: i.startDate,
                  coachId: i.coachId,
                  classSlotIds: i.classSlotId ? [i.classSlotId] : undefined,
                  freezeMaxCount: i.freezeMaxCount,
                  freezeMaxTotalDays: i.freezeMaxTotalDays,
                }
              : undefined,
        })),
        promotionId: appliedPromo?.id,
        promotionCode: appliedPromo?.code,
        manualDiscount: manualDiscountActive
          ? {
              amount: discount,
              note: manualDiscountNote,
            }
          : null,
        payments: paymentRows,
        useWallet,
        note: invoiceNote || null,
      });

      setCompletedInvoice(invoice);
      setPrintModalOpen(true);
      clearCart();
      if (selectedMember) {
        handleSelectMember(selectedMember);
      }

      toast({
        title: "تم إصدار الفاتورة بنجاح!",
        description: `فاتورة رقم #${invoice.number} · تم تحصيل ${formatMoney(invoice.collectedAmount)}`,
        variant: "success",
      });

      if (invoice.rotation) {
        if (invoice.rotation.status === "PENDING") {
          toast({
            title: "ترشيح المدرب في الدور",
            description: `تم ترشيح الكابتن ${invoice.rotation.coachName} للمتدرب الجديد، بانتظار موافقته`,
            variant: "success",
          });
        } else {
          toast({
            title: "تنبيه: لا يوجد مدرب متاح على الوردية",
            description: "تعذر ترشيح كابتن في الدور، يرجى التعيين اليدوي للمتدرب الجديد",
            variant: "warning",
          });
        }
      }
    } catch (err: any) {
      toast({
        title: "فشل إتمام البيع",
        description: err.message || String(err),
        variant: "error",
      });
    }
  };

  // Quick Test Presets
  const runPreset1 = () => {
    // 3-Month PT + SUMMER25 + Cash/Wallet leaving balance
    const m = members.find((x) => x.code === "1001") || members[0];
    handleSelectMember(m!);
    clearCart();
    const ptPlan = plans.find((p) => p.id === "plan_pt_3m") || plans.find((p) => p.kind === "PT")!;
    setCart([
      {
        cartId: "test_pt_3m",
        kind: "SUBSCRIPTION",
        title: `${ptPlan.name} · كابتن أحمد`,
        planId: ptPlan.id,
        unitPrice: ptPlan.price,
        quantity: 1,
        startDate: "2026-11-04",
        coachId: coaches[0]?.id,
        coachName: coaches[0]?.name,
        minUpfrontPercent: 50,
        durationDays: 90,
      },
    ]);
    setTimeout(() => {
      handleApplyPromoCode("SUMMER25");
      setUseWallet(true);
      setCashAmountStr("2500");
    }, 100);
  };

  const runPreset2 = () => {
    // Pay 49% when min is 50%
    const m = members.find((x) => x.code === "1005") || members[0];
    handleSelectMember(m!);
    clearCart();
    const gymPlan = plans.find((p) => p.id === "plan_gym_3m") || plans[0]!;
    setCart([
      {
        cartId: "test_gym_3m",
        kind: "SUBSCRIPTION",
        title: gymPlan.name,
        planId: gymPlan.id,
        unitPrice: gymPlan.price,
        quantity: 1,
        startDate: "2026-11-04",
        minUpfrontPercent: 50,
        durationDays: 90,
      },
    ]);
    setTimeout(() => {
      setUseWallet(false);
      // 49% of 2400 EGP is 1176 EGP
      setCashAmountStr("1176");
    }, 100);
  };

  const runPreset3 = () => {
    // Overpayment credits excess into wallet
    const m = members.find((x) => x.code === "1002") || members[0];
    handleSelectMember(m!);
    clearCart();
    const water = products.find((p) => p.id === "prod_water") || products[0]!;
    setCart([
      {
        cartId: "test_prod_water",
        kind: "PRODUCT",
        title: water.name,
        productId: water.id,
        unitPrice: water.price,
        quantity: 2, // 30.00 EGP
      },
    ]);
    setTimeout(() => {
      setUseWallet(false);
      setCashAmountStr("50"); // 50 EGP tendered -> 20 EGP credit to wallet
    }, 100);
  };

  // Collect Balance action
  const handleOpenCollectBalance = async () => {
    try {
      const invs = await sellApi.listInvoices();
      const openInvs = invs.filter((i: InvoiceDetail) => i.status === "OPEN" && i.remainingAmount > 0);
      setRecentInvoicesList(openInvs);
      if (openInvs.length > 0 && openInvs[0]) {
        setSelectedInvoiceToPay(openInvs[0]);
        setCollectAmountStr(fromMinor(openInvs[0].remainingAmount).toString());
      }
      setCollectBalanceModalOpen(true);
    } catch (err) {
      toast({ title: "خطأ", description: String(err), variant: "error" });
    }
  };

  const handleConfirmCollectPayment = async () => {
    if (!selectedInvoiceToPay) return;
    const amountMinor = toMinor(parseFloat(collectAmountStr) || 0);
    if (amountMinor <= 0) {
      toast({ title: "المبلغ غير صالح", description: "يرجى إدخال مبلغ صحيح", variant: "warning" });
      return;
    }
    try {
      const updated = await sellApi.collectPayment(selectedInvoiceToPay.id, {
        payments: [{ method: collectMethod, amount: amountMinor }],
      });
      toast({
        title: "تم التحصيل بنجاح",
        description: `تم سداد ${formatMoney(amountMinor)} على الفاتورة #${updated.number}`,
        variant: "success",
      });
      setCollectBalanceModalOpen(false);
      if (selectedMember) handleSelectMember(selectedMember);
    } catch (err: any) {
      toast({ title: "فشل التحصيل", description: err.message || String(err), variant: "error" });
    }
  };

  // Voucher submission
  const handleCreateVoucher = async () => {
    const amountMinor = toMinor(parseFloat(voucherAmountStr) || 0);
    if (amountMinor <= 0 || !voucherReason.trim()) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى كتابة المبلغ والسبب بوضوح",
        variant: "warning",
      });
      return;
    }
    try {
      const v = await sellApi.createVoucher({
        type: voucherType,
        method: voucherMethod,
        amount: amountMinor,
        reason: voucherReason,
        memberId: selectedMember?.id || null,
        creditToWallet: voucherCreditWallet,
      });
      toast({
        title: voucherType === "RECEIPT" ? "تم إصدار سند القبض" : "تم إصدار سند الصرف",
        description: `المبلغ: ${formatMoney(v.amount)} · ${v.reason}`,
        variant: "success",
      });
      setVouchersModalOpen(false);
      setVoucherAmountStr("");
      setVoucherReason("");
      if (selectedMember) handleSelectMember(selectedMember);
    } catch (err: any) {
      toast({ title: "خطأ في إنشاء السند", description: err.message || String(err), variant: "error" });
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#F2F4F1] text-[#14181F]">
      {/* Top Header / Bar */}
      <header className="bg-white border-b border-[#E1E5DF] p-4 md:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-black">
            <ShoppingBag className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-[20px] font-bold tracking-tight">نقطة البيع والاشتراكات (POS)</h1>
            <p className="text-[13px] text-[#5B6470]">
              إصدار فواتير الاشتراكات والخدمات والمنتجات وتطبيق الخصومات والمحفظة
            </p>
          </div>
        </div>

        {/* Quick Actions & Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenCollectBalance}
            className="border-[#E1E5DF] text-[13px] font-semibold"
          >
            <RotateCcw className="h-4 w-4 me-1.5 text-blue-600" />
            تحصيل متبقي
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setVouchersModalOpen(true)}
            className="border-[#E1E5DF] text-[13px] font-semibold"
          >
            <Receipt className="h-4 w-4 me-1.5 text-emerald-600" />
            سند قبض / صرف
          </Button>

          {/* Preset Buttons for Quick Testing */}
          <div className="flex items-center gap-1.5 bg-[#F2F4F1] p-1 rounded-xl border border-[#E1E5DF]">
            <span className="text-[11px] font-bold text-[#5B6470] px-1.5">حالات الاختبار:</span>
            <button
              onClick={runPreset1}
              className="text-[11px] font-bold px-2 py-1 bg-white hover:bg-emerald-50 text-emerald-800 rounded-lg border border-[#E1E5DF] transition-colors"
            >
              1. برايفت + عروض الصيف
            </button>
            <button
              onClick={runPreset2}
              className="text-[11px] font-bold px-2 py-1 bg-white hover:bg-amber-50 text-amber-800 rounded-lg border border-[#E1E5DF] transition-colors"
            >
              2. سداد 49% (عجز تفعيل)
            </button>
            <button
              onClick={runPreset3}
              className="text-[11px] font-bold px-2 py-1 bg-white hover:bg-blue-50 text-blue-800 rounded-lg border border-[#E1E5DF] transition-colors"
            >
              3. زيادة كاش (محفظة)
            </button>
          </div>
        </div>
      </header>

      {/* Main 2-Column POS Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_440px] xl:grid-cols-[1fr_480px]">
        {/* Left Column: Catalog & Item Selection */}
        <main className="p-4 md:p-6 flex flex-col gap-5 border-e border-[#E1E5DF] overflow-y-auto">
          {/* Customer Selection Banner */}
          <div className="bg-white rounded-2xl border border-[#E1E5DF] p-4 shadow-subtle flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5 flex-1 w-full">
              <div className="h-11 w-11 rounded-full bg-[#F2F4F1] border border-[#E1E5DF] flex items-center justify-center text-[#14181F] font-bold shrink-0">
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-bold text-[#5B6470] uppercase">العميل الحالي:</span>
                  {isWalkIn ? (
                    <span className="inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold leading-normal select-none bg-slate-100 text-slate-800 border border-slate-300">
                      عميل زائر (Walk-in)
                    </span>
                  ) : selectedMember ? (
                    <div className="flex items-center gap-2">
                      <b className="text-[15px] font-bold text-[#14181F]">{selectedMember.name}</b>
                      <span className="text-[12px] bg-[#E1E5DF] px-2 py-0.5 rounded-md font-mono font-bold">
                        كود: {selectedMember.code}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[14px] text-red-600 font-bold">لم يتم تحديد عضو</span>
                  )}
                </div>

                {selectedMember && !isWalkIn && (
                  <div className="flex items-center gap-4 mt-1 text-[13px]">
                    <span className="text-[#5B6470]">الهاتف: {selectedMember.phone}</span>
                    <span className="font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200 flex items-center gap-1">
                      <WalletIcon className="h-3.5 w-3.5" />
                      رصيد المحفظة: {formatMoney(walletBalance)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Member search & Quick selector */}
            <div className="flex items-center gap-2 w-full md:w-auto shrink-0">
              <select
                className="h-10 px-3 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-semibold text-[#14181F] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
                value={selectedMember?.id || (isWalkIn ? "walkin" : "")}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === "walkin") {
                    setIsWalkIn(true);
                    setSelectedMember(null);
                    setMemberWallet(null);
                  } else {
                    const m = members.find((x) => x.id === val);
                    handleSelectMember(m || null);
                  }
                }}
              >
                <option value="">-- اختر العضو من القائمة --</option>
                <option value="walkin">عميل زائر (Walk-in - خدمات ومنتجات فقط)</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Catalog Tabs & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-[#E1E5DF] self-start">
              <button
                type="button"
                onClick={() => setActiveTab("plans")}
                className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${
                  activeTab === "plans"
                    ? "bg-[#14181F] text-white shadow-sm"
                    : "text-[#5B6470] hover:text-[#14181F]"
                }`}
              >
                الاشتراكات ({plans.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("services")}
                className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${
                  activeTab === "services"
                    ? "bg-[#14181F] text-white shadow-sm"
                    : "text-[#5B6470] hover:text-[#14181F]"
                }`}
              >
                الخدمات ({services.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("products")}
                className={`px-4 py-2 rounded-lg text-[14px] font-bold transition-colors ${
                  activeTab === "products"
                    ? "bg-[#14181F] text-white shadow-sm"
                    : "text-[#5B6470] hover:text-[#14181F]"
                }`}
              >
                البار والمنتجات ({products.length})
              </button>
            </div>

            {/* Catalog search */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#5B6470]" />
              <input
                type="text"
                value={catalogSearch}
                onChange={(e) => setCatalogSearch(e.target.value)}
                placeholder="بحث في الكتالوج..."
                className="w-full ps-9 pe-4 py-2 bg-white border border-[#E1E5DF] rounded-xl text-[13px] focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
              />
            </div>
          </div>

          {/* Catalog Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {loading && (
              <div className="col-span-full py-12 text-center text-[#5B6470] text-[14px] font-bold">
                جاري تحميل الكتالوج والبيانات...
              </div>
            )}
            {/* PLANS TAB */}
            {activeTab === "plans" &&
              plans
                .filter((p) => p.isActive !== false && p.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                .map((plan) => (
                  <div
                    key={plan.id}
                    className="bg-white rounded-2xl border border-[#E1E5DF] p-4 flex flex-col justify-between hover:border-[#14181F] transition-all shadow-subtle group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span
                          className={`text-[11px] font-black px-2.5 py-0.5 rounded-full ${
                            plan.kind === "PT"
                              ? "bg-purple-100 text-purple-800"
                              : plan.kind === "CLASS"
                              ? "bg-blue-100 text-blue-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {plan.kind === "PT" ? "تدريب شخصي PT" : plan.kind === "CLASS" ? "حصص جماعية" : "جيم عام"}
                        </span>
                        <span className="text-[12px] font-bold text-[#5B6470]">
                          {plan.durationDays} يوم
                        </span>
                      </div>
                      <h3 className="text-[16px] font-bold text-[#14181F] line-clamp-2 mb-1.5">
                        {plan.name}
                      </h3>
                      <div className="text-[12px] text-[#5B6470] space-y-1">
                        {plan.totalSessions && (
                          <div>• الجلسات: {plan.totalSessions} جلسة</div>
                        )}
                        <div>• الحد الأدنى للتفعيل: {plan.minUpfrontPercent ?? 50}%</div>
                        <div>
                          • التجميد: {plan.freezeMaxCount} مرات / {plan.freezeMaxTotalDays} يوم
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E1E5DF] flex items-center justify-between">
                      <b className="text-[18px] font-black text-[#14181F]">
                        {formatMoney(plan.price)}
                      </b>
                      <Button
                        size="sm"
                        onClick={() => handleOpenPlanConfig(plan)}
                        className="bg-[#14181F] text-white hover:bg-[#262D38] font-bold rounded-xl"
                      >
                        <Plus className="h-4 w-4 me-1" />
                        اختيار
                      </Button>
                    </div>
                  </div>
                ))}

            {/* SERVICES TAB */}
            {activeTab === "services" &&
              services
                .filter((s) => s.isActive !== false && s.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                .map((srv) => (
                  <div
                    key={srv.id}
                    className="bg-white rounded-2xl border border-[#E1E5DF] p-4 flex flex-col justify-between hover:border-[#14181F] transition-all shadow-subtle"
                  >
                    <div>
                      <div className="text-[11px] font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full inline-block mb-2">
                        خدمة إضافية
                      </div>
                      <h3 className="text-[16px] font-bold text-[#14181F] mb-1">{srv.name}</h3>
                      <p className="text-[12px] text-[#5B6470]">متاحة للبيع المباشر للبار والأعضاء والزوار</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E1E5DF] flex items-center justify-between">
                      <b className="text-[18px] font-black text-[#14181F]">
                        {formatMoney(srv.price)}
                      </b>
                      <Button
                        size="sm"
                        onClick={() => handleAddService(srv)}
                        className="bg-[#14181F] text-white hover:bg-[#262D38] font-bold rounded-xl"
                      >
                        <Plus className="h-4 w-4 me-1" />
                        إضافة
                      </Button>
                    </div>
                  </div>
                ))}

            {/* PRODUCTS TAB */}
            {activeTab === "products" &&
              products
                .filter((p) => p.isActive !== false && p.name.toLowerCase().includes(catalogSearch.toLowerCase()))
                .map((prod) => (
                  <div
                    key={prod.id}
                    className="bg-white rounded-2xl border border-[#E1E5DF] p-4 flex flex-col justify-between hover:border-[#14181F] transition-all shadow-subtle"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-mono text-[#5B6470]">
                          كود: {prod.barcode || "N/A"}
                        </span>
                        <span
                          className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                            prod.stock > 10
                              ? "bg-emerald-100 text-emerald-800"
                              : prod.stock > 0
                              ? "bg-amber-100 text-amber-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          المخزن: {prod.stock}
                        </span>
                      </div>
                      <h3 className="text-[16px] font-bold text-[#14181F] mb-1">{prod.name}</h3>
                    </div>

                    <div className="mt-4 pt-3 border-t border-[#E1E5DF] flex items-center justify-between">
                      <b className="text-[18px] font-black text-[#14181F]">
                        {formatMoney(prod.price)}
                      </b>
                      <Button
                        size="sm"
                        disabled={prod.stock <= 0}
                        onClick={() => handleAddProduct(prod)}
                        className="bg-[#14181F] text-white hover:bg-[#262D38] font-bold rounded-xl"
                      >
                        <Plus className="h-4 w-4 me-1" />
                        {prod.stock > 0 ? "إضافة" : "نفد"}
                      </Button>
                    </div>
                  </div>
                ))}
          </div>
        </main>

        {/* Right Column: Cart, Discounts & Checkout Panel */}
        <aside className="bg-white p-5 flex flex-col justify-between overflow-y-auto">
          <div className="flex flex-col gap-5">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF]">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-5 w-5 text-[#14181F]" />
                <h2 className="text-[18px] font-bold text-[#14181F]">سلة الفاتورة</h2>
                <span className="bg-[#14181F] text-white text-[12px] font-bold px-2 py-0.5 rounded-full">
                  {cart.length}
                </span>
              </div>
              {cart.length > 0 && (
                <button
                  type="button"
                  onClick={clearCart}
                  className="text-[12px] text-red-600 font-bold hover:underline"
                >
                  تفريغ السلة
                </button>
              )}
            </div>

            {/* Cart Items List */}
            {cart.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center gap-2 text-[#5B6470]">
                <div className="h-14 w-14 rounded-2xl bg-[#F2F4F1] flex items-center justify-center text-[#5B6470]">
                  <ShoppingBag className="h-7 w-7" />
                </div>
                <b className="text-[15px] text-[#14181F]">السلة فارغة</b>
                <p className="text-[13px] max-w-xs">
                  اختر اشتراكات أو خدمات أو منتجات من الكتالوج لإضافتها للفاتورة الحالية
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-2.5 max-h-56 overflow-y-auto pe-1">
                {cart.map((item) => {
                  const itemDisc =
                    discountCalculation.perItem.find((p) => p.id === item.cartId)?.discount || 0;
                  return (
                    <div
                      key={item.cartId}
                      className="p-3 rounded-xl border border-[#E1E5DF] bg-[#F2F4F1]/50 flex items-center justify-between gap-3 text-[13px]"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-[#14181F] truncate">{item.title}</div>
                        <div className="text-[12px] text-[#5B6470] flex items-center gap-2 mt-0.5">
                          <span>{formatMoney(item.unitPrice)}</span>
                          {itemDisc > 0 && (
                            <span className="text-emerald-700 font-bold">
                              (خصم -{formatMoney(itemDisc)})
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Quantity & Actions */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center border border-[#E1E5DF] rounded-lg bg-white overflow-hidden">
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartId, -1)}
                            className="p-1 hover:bg-[#F2F4F1] text-[#14181F]"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="px-2 font-mono font-bold text-[12px]">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(item.cartId, 1)}
                            className="p-1 hover:bg-[#F2F4F1] text-[#14181F]"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCartItem(item.cartId)}
                          className="text-red-500 hover:text-red-700 p-1"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Discounts Section */}
            <div className="pt-3 border-t border-[#E1E5DF] flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#14181F] flex items-center gap-1.5">
                  <Tag className="h-4 w-4 text-[#14181F]" />
                  الخصومات والعروض الترويجية
                </span>
                {appliedPromo && (
                  <button
                    onClick={() => {
                      setAppliedPromo(null);
                      setPromoCodeInput("");
                    }}
                    className="text-[11px] text-red-600 font-bold hover:underline"
                  >
                    إلغاء الكود
                  </button>
                )}
              </div>

              {/* Promo code entry */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={promoCodeInput}
                  onChange={(e) => setPromoCodeInput(e.target.value)}
                  placeholder="أدخل كود الخصم (مثال: SUMMER25)..."
                  className="flex-1 px-3 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleApplyPromoCode()}
                  className="border-[#14181F] font-bold rounded-xl text-[12px]"
                >
                  تطبيق
                </Button>
              </div>

              {promoError && (
                <div className="text-[12px] font-bold text-red-600 bg-red-50 p-2 rounded-lg border border-red-200 flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{promoError}</span>
                </div>
              )}

              {/* Manual Discount Toggle */}
              <div className="pt-2">
                <label className="flex items-center gap-2 cursor-pointer text-[12px] font-bold text-[#5B6470]">
                  <input
                    type="checkbox"
                    checked={manualDiscountActive}
                    onChange={(e) => {
                      setManualDiscountActive(e.target.checked);
                      if (e.target.checked) setAppliedPromo(null);
                    }}
                    className="rounded border-[#E1E5DF]"
                  />
                  تطبيق خصم يدوي خاص
                </label>

                {manualDiscountActive && (
                  <div className="mt-2.5 p-3 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF] flex flex-col gap-2">
                    <div className="flex gap-2">
                      <select
                        value={manualDiscountType}
                        onChange={(e) => setManualDiscountType(e.target.value as any)}
                        className="h-8 px-2 bg-white border border-[#E1E5DF] rounded-lg text-[12px] font-bold"
                      >
                        <option value="fixed">مبلغ ثابت (ج.م)</option>
                        <option value="percent">نسبة مئوية (%)</option>
                      </select>
                      <input
                        type="number"
                        placeholder="قيمة الخصم..."
                        value={manualDiscountValue}
                        onChange={(e) => setManualDiscountValue(e.target.value)}
                        className="flex-1 px-2.5 py-1 bg-white border border-[#E1E5DF] rounded-lg text-[12px] font-bold"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="سبب الخصم وملاحظة الإدارة (مطلوب)..."
                      value={manualDiscountNote}
                      onChange={(e) => setManualDiscountNote(e.target.value)}
                      className="px-2.5 py-1 bg-white border border-[#E1E5DF] rounded-lg text-[12px]"
                    />
                    {parseFloat(manualDiscountValue) > 10 && (
                      <span className="text-[11px] text-amber-800 bg-amber-50 p-1.5 rounded border border-amber-200 font-bold">
                        تنبيه: الخصم يتجاوز 10% وسيتطلب اعتماد المدير.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="p-3.5 bg-[#F2F4F1] rounded-2xl border border-[#E1E5DF] flex flex-col gap-2 text-[13px]">
              <div className="flex justify-between text-[#5B6470]">
                <span>المجموع الفرعي:</span>
                <span className="font-mono font-bold">{formatMoney(subtotal)}</span>
              </div>

              {discount > 0 && (
                <div className="flex justify-between text-emerald-700 font-bold">
                  <span>الخصم المطبق:</span>
                  <span className="font-mono">-{formatMoney(discount)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-2 border-t border-[#E1E5DF] text-[16px] font-black text-[#14181F]">
                <span>الإجمالي الصافي:</span>
                <span className="font-mono text-[18px] text-[#14181F]">{formatMoney(netTotal)}</span>
              </div>
            </div>

            {/* Multi-tender Payment Panel */}
            <div className="pt-2 flex flex-col gap-3">
              <span className="text-[13px] font-bold text-[#14181F] flex items-center gap-1.5">
                <CreditCard className="h-4 w-4" />
                طرق الدفع والسداد
              </span>

              {/* Wallet auto-deduct option */}
              {selectedMember && walletBalance > 0 && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer text-[13px] font-bold text-emerald-900">
                    <input
                      type="checkbox"
                      checked={useWallet}
                      onChange={(e) => setUseWallet(e.target.checked)}
                      className="rounded border-emerald-400 text-emerald-600"
                    />
                    خصم تلقائي من المحفظة ({formatMoney(walletBalance)})
                  </label>
                  {useWallet && fromWallet > 0 && (
                    <span className="font-mono font-black text-emerald-700 text-[13px]">
                      -{formatMoney(fromWallet)}
                    </span>
                  )}
                </div>
              )}

              {/* Payment inputs */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-[#5B6470] block mb-1 flex items-center gap-1">
                    <Banknote className="h-3 w-3" />
                    كاش (نقداً)
                  </label>
                  <input
                    type="number"
                    value={cashAmountStr}
                    onChange={(e) => setCashAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5B6470] block mb-1 flex items-center gap-1">
                    <Smartphone className="h-3 w-3" />
                    إنستاباي
                  </label>
                  <input
                    type="number"
                    value={instapayAmountStr}
                    onChange={(e) => setInstapayAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-bold text-[#5B6470] block mb-1 flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    فيزا / كارت
                  </label>
                  <input
                    type="number"
                    value={cardAmountStr}
                    onChange={(e) => setCardAmountStr(e.target.value)}
                    placeholder="0"
                    className="w-full px-2.5 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[13px] font-mono font-bold"
                  />
                </div>
              </div>

              {/* Optional reference / notes */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div>
                  <input
                    type="text"
                    value={instapayRef}
                    onChange={(e) => setInstapayRef(e.target.value)}
                    placeholder="مرجع / رقم عملية إنستاباي"
                    className="w-full px-2.5 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[12px]"
                  />
                </div>
                <div>
                  <input
                    type="text"
                    value={invoiceNote}
                    onChange={(e) => setInvoiceNote(e.target.value)}
                    placeholder="ملاحظات الفاتورة (اختياري)"
                    className="w-full px-2.5 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[12px]"
                  />
                </div>
              </div>

              {/* Real-time Tender & Activation Feedback */}
              <div className="space-y-1.5 text-[12px]">
                <div className="flex justify-between font-bold">
                  <span className="text-[#5B6470]">إجمالي المدفوع:</span>
                  <span className="font-mono text-emerald-800">{formatMoney(totalCollected)}</span>
                </div>

                {remainingDue > 0 && (
                  <div className="flex justify-between font-bold text-amber-800">
                    <span>متبقي مستحق (آجل):</span>
                    <span className="font-mono">{formatMoney(remainingDue)}</span>
                  </div>
                )}

                {excessCreditToWallet > 0 && (
                  <div className="p-2 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 font-bold flex items-center justify-between">
                    <span>فائض نقدي يضاف لمحفظة العضو:</span>
                    <span className="font-mono">+{formatMoney(excessCreditToWallet)}</span>
                  </div>
                )}

                {/* Activation Decision Banner */}
                {activation && (
                  <div
                    className={`p-2.5 rounded-xl border mt-2 flex items-start gap-2 ${
                      activation.canActivate
                        ? "bg-emerald-50 border-emerald-300 text-emerald-900"
                        : "bg-amber-50 border-amber-300 text-amber-900"
                    }`}
                  >
                    {activation.canActivate ? (
                      <CheckCircle className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      {activation.canActivate ? (
                        <div>
                          <b className="font-bold">جاهز للتفعيل الفوري:</b> تم استيفاء الحد الأدنى بنجاح
                          ({activation.minPercent}%).
                        </div>
                      ) : (
                        <div>
                          <b className="font-bold">تفعيل معلق (غير مفعل):</b> تم دفع أقل من الحد الأدنى (
                          {activation.minPercent}%) · <b>متبقي {formatMoney(activation.shortfall)} للتفعيل</b>.
                        </div>
                      )}
                      {remainingDue > 0 && activation.dueDateFormatted && (
                        <div className="text-[11px] mt-1 text-[#5B6470]">
                          تاريخ استحقاق المتبقي: <b>{activation.dueDateFormatted}</b> (يتوقف الاشتراك تلقائياً بعد
                          هذا التاريخ إن لم يُسدد).
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Checkout Button */}
          <div className="pt-4 border-t border-[#E1E5DF] mt-4">
            <Button
              size="lg"
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] font-bold text-[16px] py-6 rounded-2xl shadow-md transition-transform active:scale-[0.99]"
            >
              <CheckCircle className="h-5 w-5 me-2" />
              إتمام عملية البيع وإصدار الفاتورة
            </Button>
          </div>
        </aside>
      </div>

      {/* MODAL 1: PLAN CONFIGURATION (Dates, Coach, Classes, Freeze) */}
      <Dialog
        isOpen={!!configuringPlan}
        onClose={() => setConfiguringPlan(null)}
        title={`تحديد تفاصيل الاشتراك: ${configuringPlan?.name || ""}`}
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setConfiguringPlan(null)}>
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmAddPlan}
              className="bg-[#14181F] text-white hover:bg-[#262D38] font-bold"
            >
              تأكيد وإضافة للسلة
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-3 text-[13px]">
          <div>
            <label className="font-bold block mb-1">تاريخ بدء الاشتراك:</label>
            <input
              type="date"
              value={planStartDate}
              onChange={(e) => setPlanStartDate(e.target.value)}
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[14px] font-mono font-bold"
            />
          </div>

          {configuringPlan?.kind === "PT" && (
            <div>
              <label className="font-bold block mb-1">المدرب الشخصي المسؤول (Coach):</label>
              <select
                value={planCoachId}
                onChange={(e) => setPlanCoachId(e.target.value)}
                className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[14px] font-bold"
              >
                {coaches.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {configuringPlan?.kind === "CLASS" && (
            <div>
              <label className="font-bold block mb-1">الحصة المجدولة (Class Schedule):</label>
              <select
                value={planClassSlotId}
                onChange={(e) => setPlanClassSlotId(e.target.value)}
                className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-[14px] font-bold"
              >
                {classSchedules.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.name} ({cs.coachName})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#E1E5DF]">
            <div>
              <label className="font-bold block mb-1 text-[12px] text-[#5B6470]">
                مرات التجميد المسموحة:
              </label>
              <input
                type="number"
                value={planFreezeCount}
                onChange={(e) => setPlanFreezeCount(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl font-bold"
              />
            </div>

            <div>
              <label className="font-bold block mb-1 text-[12px] text-[#5B6470]">
                إجمالي أيام التجميد:
              </label>
              <input
                type="number"
                value={planFreezeDays}
                onChange={(e) => setPlanFreezeDays(parseInt(e.target.value) || 0)}
                className="w-full px-2.5 py-1.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl font-bold"
              />
            </div>
          </div>
        </div>
      </Dialog>

      {/* MODAL 2: INVOICE RECEIPT & PRINT (80mm & A4) */}
      <Dialog
        isOpen={printModalOpen}
        onClose={() => {
          setPrintModalOpen(false);
          setCompletedInvoice(null);
        }}
        title={
          <div className="flex items-center justify-between w-full pe-6">
            <span>فاتورة مبيعات #{completedInvoice?.number || ""}</span>
            <div className="flex items-center gap-1 bg-[#F2F4F1] p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setPrintFormat("80mm")}
                className={`px-3 py-1 text-[12px] font-bold rounded-lg ${
                  printFormat === "80mm" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                }`}
              >
                إيصال 80 مم
              </button>
              <button
                type="button"
                onClick={() => setPrintFormat("a4")}
                className={`px-3 py-1 text-[12px] font-bold rounded-lg ${
                  printFormat === "a4" ? "bg-white shadow text-[#14181F]" : "text-[#5B6470]"
                }`}
              >
                فاتورة A4
              </button>
            </div>
          </div>
        }
        maxWidth="xl"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => {
                setPrintModalOpen(false);
                setCompletedInvoice(null);
              }}
            >
              إغلاق
            </Button>
            <Button
              onClick={() => window.print()}
              className="bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] font-bold"
            >
              <Printer className="h-4 w-4 me-1.5" />
              طباعة الآن
            </Button>
          </div>
        }
      >

          {/* Printable Layout Container */}
          <div className="py-2">
            {completedInvoice?.rotation && (
              <div className="mb-4 text-start">
                {completedInvoice.rotation.status === "PENDING" ? (
                  <div className="bg-[#E3F5EA] text-[#1B7F4B] p-3.5 rounded-xl border border-[#1B7F4B]/30 flex items-center gap-3">
                    <CheckCircle className="h-5 w-5 shrink-0 text-[#1B7F4B]" />
                    <div>
                      <p className="font-bold text-sm">
                        تم ترشيح الكابتن {completedInvoice.rotation.coachName} للمتدرب الجديد، بانتظار موافقته
                      </p>
                      <p className="text-xs opacity-80 mt-0.5">
                        تم إرسال إشعار فوري للمدرب، وستتم إضافة العضو لقائمة متدربيه ومنحه الجلسات المجانية فور القبول.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-amber-50 text-amber-900 p-3.5 rounded-xl border border-amber-200 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
                      <div>
                        <p className="font-bold text-sm">تعذر ترشيح كابتن تلقائياً</p>
                        <p className="text-xs opacity-80 mt-0.5">
                          لا يوجد مدربين متاحين على الوردية حالياً
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => {
                        if (completedInvoice.rotation?.profileId) {
                          setManualAssignProfileId(completedInvoice.rotation.profileId);
                          setSelectedManualCoachId(coaches[0]?.id || "");
                        }
                      }}
                      className="bg-[#14181F] text-[#C6F24E] hover:bg-black font-bold text-xs shrink-0"
                    >
                      تعيين كابتن يدوياً
                    </Button>
                  </div>
                )}
              </div>
            )}
            {printFormat === "80mm" ? (
              /* 80mm Thermal Receipt Layout */
              <div className="bg-white border-2 border-dashed border-[#E1E5DF] p-4 rounded-xl max-w-sm mx-auto font-mono text-[13px] text-center">
                <div className="font-bold text-[18px] text-[#14181F]">EazyGym - المعادي</div>
                <div className="text-[11px] text-[#5B6470]">رقم ضريبي: 492-881-019</div>
                <div className="my-2 border-t border-dashed border-[#14181F]" />

                <div className="text-start space-y-0.5 text-[12px]">
                  <div>فاتورة رقم: #{completedInvoice?.number}</div>
                  <div>التاريخ: {new Date().toLocaleString("ar-EG")}</div>
                  <div>الكاشير: سارة حسن (استقبال)</div>
                  {completedInvoice?.member && (
                    <div>
                      العميل: {completedInvoice.member.name} ({completedInvoice.member.code})
                    </div>
                  )}
                </div>

                <div className="my-2 border-t border-dashed border-[#14181F]" />

                {/* Items */}
                <div className="text-start space-y-1 text-[12px]">
                  {completedInvoice?.items.map((i) => (
                    <div key={i.id} className="flex justify-between">
                      <span>
                        {i.quantity}x {i.description}
                      </span>
                      <span>{formatMoney(i.total)}</span>
                    </div>
                  ))}
                </div>

                <div className="my-2 border-t border-dashed border-[#14181F]" />

                {/* Summary */}
                <div className="space-y-1 text-[12px] font-bold text-start">
                  <div className="flex justify-between">
                    <span>المجموع:</span>
                    <span>{formatMoney(completedInvoice?.subtotal || 0)}</span>
                  </div>
                  {(completedInvoice?.discount || 0) > 0 && (
                    <div className="flex justify-between text-emerald-800">
                      <span>الخصم:</span>
                      <span>-{formatMoney(completedInvoice?.discount || 0)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[14px] text-[#14181F] pt-1 border-t border-dashed border-[#14181F]">
                    <span>الإجمالي:</span>
                    <span>{formatMoney(completedInvoice?.total || 0)}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700">
                    <span>المدفوع:</span>
                    <span>{formatMoney(completedInvoice?.collectedAmount || 0)}</span>
                  </div>
                  {(completedInvoice?.remainingAmount || 0) > 0 && (
                    <div className="flex justify-between text-red-700">
                      <span>المتبقي المستحق:</span>
                      <span>{formatMoney(completedInvoice?.remainingAmount || 0)}</span>
                    </div>
                  )}
                </div>

                <div className="my-2 border-t border-dashed border-[#14181F]" />
                <div className="text-[11px] text-[#5B6470] mt-2">
                  شكراً لزيارتكم إيزي جيم! احتفظ بالإيصال للمراجعة.
                </div>
              </div>
            ) : (
              /* Formal A4 Invoice Layout */
              <div className="bg-white border border-[#E1E5DF] p-6 rounded-xl text-[13px] space-y-4">
                <div className="flex justify-between items-start border-b border-[#E1E5DF] pb-4">
                  <div>
                    <h2 className="text-[20px] font-bold text-[#14181F]">EazyGym Egypt</h2>
                    <p className="text-[#5B6470] text-[12px]">فرع المعادي الرئيسي · سجل تجاري: 109283</p>
                  </div>
                  <div className="text-end">
                    <b className="text-[18px] text-[#14181F]">فاتورة رقم: #{completedInvoice?.number}</b>
                    <p className="text-[#5B6470] text-[12px]">التاريخ: {new Date().toLocaleDateString("ar-EG")}</p>
                  </div>
                </div>

                {completedInvoice?.member && (
                  <div className="bg-[#F2F4F1] p-3 rounded-xl flex justify-between">
                    <div>
                      <span className="text-[#5B6470] block text-[11px]">بيانات العضو:</span>
                      <b>{completedInvoice.member.name}</b>
                    </div>
                    <div>
                      <span className="text-[#5B6470] block text-[11px]">كود العضو:</span>
                      <b>{completedInvoice.member.code}</b>
                    </div>
                    <div>
                      <span className="text-[#5B6470] block text-[11px]">رقم الهاتف:</span>
                      <b>{completedInvoice.member.phone}</b>
                    </div>
                  </div>
                )}

                <table className="w-full text-start border-collapse text-[13px]">
                  <thead>
                    <tr className="border-b border-[#E1E5DF] text-[#5B6470]">
                      <th className="py-2 text-start">البند</th>
                      <th className="py-2 text-center">الكمية</th>
                      <th className="py-2 text-end">سعر الوحدة</th>
                      <th className="py-2 text-end">الإجمالي</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedInvoice?.items.map((it) => (
                      <tr key={it.id} className="border-b border-[#E1E5DF]">
                        <td className="py-2 font-bold">{it.description}</td>
                        <td className="py-2 text-center">{it.quantity}</td>
                        <td className="py-2 text-end">{formatMoney(it.unitPrice)}</td>
                        <td className="py-2 text-end font-bold">{formatMoney(it.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="flex justify-end">
                  <div className="w-64 space-y-1.5 pt-2 font-bold text-[13px]">
                    <div className="flex justify-between text-[#5B6470]">
                      <span>المجموع الفرعي:</span>
                      <span>{formatMoney(completedInvoice?.subtotal || 0)}</span>
                    </div>
                    {(completedInvoice?.discount || 0) > 0 && (
                      <div className="flex justify-between text-emerald-800">
                        <span>الخصم:</span>
                        <span>-{formatMoney(completedInvoice?.discount || 0)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-[16px] border-t border-[#14181F] pt-1">
                      <span>الإجمالي الصافي:</span>
                      <span>{formatMoney(completedInvoice?.total || 0)}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700">
                      <span>المدفوع:</span>
                      <span>{formatMoney(completedInvoice?.collectedAmount || 0)}</span>
                    </div>
                    {(completedInvoice?.remainingAmount || 0) > 0 && (
                      <div className="flex justify-between text-red-700">
                        <span>المتبقي المستحق:</span>
                        <span>{formatMoney(completedInvoice?.remainingAmount || 0)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
      </Dialog>

      {/* MANUAL ASSIGN COACH DIALOG */}
      <Dialog
        isOpen={!!manualAssignProfileId}
        onClose={() => setManualAssignProfileId(null)}
        title="تعيين كابتن يدوياً للمتدرب الجديد"
        maxWidth="sm"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button
              variant="outline"
              onClick={() => setManualAssignProfileId(null)}
              disabled={isManualAssignLoading}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmManualAssign}
              disabled={isManualAssignLoading || !selectedManualCoachId}
              className="bg-[#14181F] text-[#C6F24E] hover:bg-black font-bold"
            >
              {isManualAssignLoading ? "جاري التعيين..." : "تأكيد التعيين"}
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-2 text-start">
          <p className="text-xs text-[#5B6470]">
            اختر المدرب الذي سيتم تكليفه بمتابعة المتدرب الجديد ومنحه الجلسات المجانية المحددة في النظام:
          </p>
          <div>
            <label className="text-xs font-bold text-[#14181F] block mb-1">
              الكابتن المكلّف:
            </label>
            <select
              value={selectedManualCoachId}
              onChange={(e) => setSelectedManualCoachId(e.target.value)}
              className="w-full text-xs font-bold p-2.5 bg-white border border-[#E1E5DF] rounded-xl outline-none focus:ring-2 focus:ring-[#C6F24E]"
            >
              <option value="">-- اختر المدرب --</option>
              {coaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.isActive ? "" : "(غير نشط)"}
                </option>
              ))}
            </select>
          </div>
        </div>
      </Dialog>

      {/* MODAL 3: COLLECT BALANCE (تحصيل متبقي) */}
      <Dialog
        isOpen={collectBalanceModalOpen}
        onClose={() => setCollectBalanceModalOpen(false)}
        title="تحصيل متبقي على الفواتير المفتوحة"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setCollectBalanceModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleConfirmCollectPayment}
              disabled={!selectedInvoiceToPay}
              className="bg-[#14181F] text-white hover:bg-[#262D38] font-bold"
            >
              تأكيد التحصيل
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-[13px]">
          {recentInvoicesList.length === 0 ? (
            <div className="text-center py-6 text-[#5B6470]">
              لا توجد فواتير مفتوحة عليها متبقي حالياً.
            </div>
          ) : (
            <>
              <div>
                <label className="font-bold block mb-1">اختر الفاتورة للتحصيل:</label>
                <select
                  value={selectedInvoiceToPay?.id || ""}
                  onChange={(e) => {
                    const inv = recentInvoicesList.find((x) => x.id === e.target.value);
                    setSelectedInvoiceToPay(inv || null);
                    if (inv) setCollectAmountStr(fromMinor(inv.remainingAmount).toString());
                  }}
                  className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl font-bold"
                >
                  {recentInvoicesList.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      فاتورة #{inv.number} - {inv.member?.name || "عميل"} (متبقي:{" "}
                      {formatMoney(inv.remainingAmount)})
                    </option>
                  ))}
                </select>
              </div>

              {selectedInvoiceToPay && (
                <div className="p-3 bg-[#F2F4F1] rounded-xl space-y-1 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">إجمالي الفاتورة:</span>
                    <b className="font-mono">{formatMoney(selectedInvoiceToPay.total)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">المحصل سابقاً:</span>
                    <b className="font-mono text-emerald-800">
                      {formatMoney(selectedInvoiceToPay.collectedAmount)}
                    </b>
                  </div>
                  <div className="flex justify-between text-red-700 font-bold border-t border-[#E1E5DF] pt-1">
                    <span>المتبقي المستحق:</span>
                    <span className="font-mono">{formatMoney(selectedInvoiceToPay.remainingAmount)}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold block mb-1">طريقة السداد:</label>
                  <select
                    value={collectMethod}
                    onChange={(e) => setCollectMethod(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl font-bold"
                  >
                    <option value="CASH">كاش (نقداً)</option>
                    <option value="INSTAPAY">إنستاباي</option>
                    <option value="CARD">فيزا / كارت</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold block mb-1">المبلغ المحصل (ج.م):</label>
                  <input
                    type="number"
                    value={collectAmountStr}
                    onChange={(e) => setCollectAmountStr(e.target.value)}
                    className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl font-mono font-bold"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      </Dialog>

      {/* MODAL 4: VOUCHERS (سند قبض / صرف) */}
      <Dialog
        isOpen={vouchersModalOpen}
        onClose={() => setVouchersModalOpen(false)}
        title="إصدار سند قبض / صرف نقدي"
        maxWidth="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setVouchersModalOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleCreateVoucher}
              className="bg-[#14181F] text-white hover:bg-[#262D38] font-bold"
            >
              إصدار السند
            </Button>
          </div>
        }
      >
        <div className="space-y-4 py-2 text-[13px]">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setVoucherType("RECEIPT")}
              className={`py-2 rounded-xl text-[13px] font-bold border transition-colors ${
                voucherType === "RECEIPT"
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "bg-[#F2F4F1] text-[#14181F] border-[#E1E5DF]"
              }`}
            >
              سند قبض (توريد نقدية)
            </button>
            <button
              type="button"
              onClick={() => setVoucherType("DISBURSEMENT")}
              className={`py-2 rounded-xl text-[13px] font-bold border transition-colors ${
                voucherType === "DISBURSEMENT"
                  ? "bg-red-600 text-white border-red-600"
                  : "bg-[#F2F4F1] text-[#14181F] border-[#E1E5DF]"
              }`}
            >
              سند صرف (خروج نقدية)
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold block mb-1">طريقة المعاملة:</label>
              <select
                value={voucherMethod}
                onChange={(e) => setVoucherMethod(e.target.value as any)}
                className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl font-bold"
              >
                <option value="CASH">كاش (خزينة الوردية)</option>
                <option value="INSTAPAY">إنستاباي</option>
                <option value="CARD">بطاقة بنكية</option>
              </select>
            </div>

            <div>
              <label className="font-bold block mb-1">المبلغ (ج.م):</label>
              <input
                type="number"
                value={voucherAmountStr}
                onChange={(e) => setVoucherAmountStr(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl font-mono font-bold"
              />
            </div>
          </div>

          <div>
            <label className="font-bold block mb-1">سبب السند والبيان:</label>
            <input
              type="text"
              value={voucherReason}
              onChange={(e) => setVoucherReason(e.target.value)}
              placeholder="مثال: إيداع نقدي لمحفظة العضو / شراء مستلزمات نظافة..."
              className="w-full px-3 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl"
            />
          </div>

          {selectedMember && (
            <label className="flex items-center gap-2 cursor-pointer pt-1 font-bold text-[#5B6470]">
              <input
                type="checkbox"
                checked={voucherCreditWallet}
                onChange={(e) => setVoucherCreditWallet(e.target.checked)}
                className="rounded border-[#E1E5DF]"
              />
              {voucherType === "RECEIPT"
                ? `إيداع هذا المبلغ في محفظة العضو (${selectedMember.name})`
                : `خصم هذا المبلغ من محفظة العضو (${selectedMember.name})`}
            </label>
          )}
        </div>
      </Dialog>
    </div>
  );
}
