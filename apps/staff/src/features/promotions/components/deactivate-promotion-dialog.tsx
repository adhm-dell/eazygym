"use client";

import React, { useState } from "react";
import { AlertTriangle, CheckCircle, ShieldAlert } from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { promotionsApi, type Promotion } from "../api";
import { useTranslation } from "@gym/i18n";

interface DeactivatePromotionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  promotion: Promotion | null;
}

export function DeactivatePromotionDialog({
  isOpen,
  onClose,
  onSuccess,
  promotion,
}: DeactivatePromotionDialogProps) {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !promotion) return null;

  const isDeactivating = promotion.isActive;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    setError(null);
    try {
      if (isDeactivating) {
        await promotionsApi.deactivatePromotion(promotion.id);
      } else {
        await promotionsApi.activatePromotion(promotion.id);
      }
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          (isRtl ? "حدث خطأ أثناء تحديث حالة العرض" : "An error occurred updating promotion state")
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={
        <div className="flex items-center gap-3">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${
              isDeactivating
                ? "bg-amber-100 text-amber-700"
                : "bg-emerald-100 text-emerald-700"
            }`}
          >
            {isDeactivating ? (
              <AlertTriangle className="h-6 w-6" />
            ) : (
              <CheckCircle className="h-6 w-6" />
            )}
          </div>
          <div>
            <h3 className="font-bold text-lg text-[#14181F]">
              {isDeactivating
                ? (t("promotionsManagement.deactivateConfirmTitle") || "تأكيد تعطيل العرض الترويجي")
                : (t("promotionsManagement.reactivateConfirmTitle") || "تأكيد إعادة تفعيل العرض الترويجي")}
            </h3>
            <p className="text-xs text-[#5B6470] mt-0.5">
              {promotion.name} {promotion.code ? `(${promotion.code})` : ""}
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-end gap-2.5 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border-[#E1E5DF] font-medium"
          >
            {t("promotionsManagement.cancel") || "إلغاء"}
          </Button>
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={isSubmitting}
            className={`rounded-xl font-bold ${
              isDeactivating
                ? "bg-amber-600 hover:bg-amber-700 text-white"
                : "bg-[#C6F24E] hover:bg-[#b5e03f] text-[#14181F]"
            }`}
          >
            {isSubmitting
              ? (isRtl ? "جاري التحديث..." : "Updating...")
              : isDeactivating
              ? (t("promotionsManagement.deactivatePromotion") || "تعطيل العرض")
              : (t("promotionsManagement.reactivatePromotion") || "إعادة التفعيل")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4" dir={isRtl ? "rtl" : "ltr"}>
        <div className="p-3.5 rounded-xl bg-[#F2F4F1] border border-[#E1E5DF] text-xs text-[#262D38] leading-relaxed space-y-2">
          <p>
            {isDeactivating
              ? (t("promotionsManagement.deactivateConfirmDesc") ||
                "تعطيل العرض سيمنع تطبيقه على أي فواتير جديدة في الكاشير (POS). العروض التي تم استخدامها مسبقاً لا يمكن حذفها لضمان نزاهة ومطابقة السجلات المالية. يمكنك إعادة تفعيل هذا العرض في أي وقت.")
              : (t("promotionsManagement.reactivateConfirmDesc") ||
                "إعادة التفعيل ستجعل العرض متاحاً للاستخدام مجدداً في الكاشير طالما كانت شروط تاريخ الصلاحية وسقف الاستخدام مستوفاة.")}
          </p>
          {isDeactivating && (
            <div className="flex items-center gap-1.5 text-amber-800 font-semibold pt-1">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
              <span>
                {isRtl
                  ? "قاعدة النظام: لا يتم حذف العروض التي تحتوي على استخدامات أبداً."
                  : "System Rule: Promotions with redemptions are never deleted."}
              </span>
            </div>
          )}
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600 font-medium">
            {error}
          </div>
        )}
      </div>
    </Dialog>
  );
}
