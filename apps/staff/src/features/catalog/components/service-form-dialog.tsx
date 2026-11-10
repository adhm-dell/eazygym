"use client";

import React, { useEffect, useState } from "react";
import { Sparkles, AlertCircle } from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { catalogApi } from "../api";
import type { Service } from "@gym/contracts";

interface ServiceFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (service: Service) => void;
  serviceToEdit?: Service | null;
}

export function ServiceFormDialog({
  isOpen,
  onClose,
  onSuccess,
  serviceToEdit,
}: ServiceFormDialogProps) {
  const isEditing = Boolean(serviceToEdit);

  const [name, setName] = useState("");
  const [priceEgp, setPriceEgp] = useState("");
  const [sellableAtPos, setSellableAtPos] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (serviceToEdit) {
      setName(serviceToEdit.name);
      setPriceEgp((serviceToEdit.price / 100).toString());
      setSellableAtPos(serviceToEdit.sellableAtPos);
      setIsActive(serviceToEdit.isActive);
    } else {
      setName("");
      setPriceEgp("");
      setSellableAtPos(true);
      setIsActive(true);
    }
    setFieldError(null);
    setGeneralError(null);
  }, [serviceToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setGeneralError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldError("اسم الخدمة مطلوب");
      return;
    }

    const priceNum = parseFloat(priceEgp);
    if (isNaN(priceNum) || priceNum < 0) {
      setGeneralError("يرجى إدخال سعر صحيح (0 أو أكثر)");
      return;
    }

    const pricePiasters = Math.round(priceNum * 100);

    setIsSubmitting(true);
    try {
      let result: Service;
      if (isEditing && serviceToEdit) {
        result = await catalogApi.updateService(serviceToEdit.id, {
          name: trimmedName,
          price: pricePiasters,
          sellableAtPos,
          isActive,
        });
      } else {
        result = await catalogApi.createService({
          name: trimmedName,
          price: pricePiasters,
          sellableAtPos,
        });
      }
      onSuccess(result);
      onClose();
    } catch (err: any) {
      if (err?.code === "SERVICE_EXISTS" || err?.statusCode === 409 || err?.code === "CONFLICT") {
        setFieldError("يوجد خدمة بنفس هذا الاسم بالفعل في الجيم");
      } else {
        setGeneralError(err?.message || "حدث خطأ أثناء حفظ الخدمة");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2 text-[#14181F]">
          <Sparkles className="h-5 w-5 text-[#C6F24E]" />
          <span>{isEditing ? "تعديل الخدمة" : "إضافة خدمة جديدة"}</span>
        </div>
      }
      description={
        isEditing
          ? "تعديل سعر وتفاصيل الخدمة الإضافية"
          : "حدد اسم الخدمة (مثل: ساونا، دخول يومي، جلسة مساج) والسعر"
      }
      footer={
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            variant="lime"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={isSubmitting}
            className="font-bold"
          >
            {isEditing ? "حفظ التعديلات" : "إضافة الخدمة"}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-start" dir="rtl">
        {generalError && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{generalError}</span>
          </div>
        )}

        <div>
          <label className="block text-xs font-bold text-[#5B6470] mb-1">
            اسم الخدمة <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFieldError(null);
            }}
            placeholder="مثال: جلسة ساونا وجاكوزي"
            className={`w-full px-3.5 py-2.5 bg-[#F2F4F1] border rounded-xl text-sm font-medium text-[#14181F] focus:outline-none ${
              fieldError ? "border-red-500 bg-red-50/50" : "border-[#E1E5DF] focus:border-[#14181F]"
            }`}
          />
          {fieldError && <p className="text-xs text-red-500 mt-1 font-bold">{fieldError}</p>}
        </div>

        <div>
          <label className="block text-xs font-bold text-[#5B6470] mb-1">
            السعر (ج.م) <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="any"
              min="0"
              value={priceEgp}
              onChange={(e) => setPriceEgp(e.target.value)}
              placeholder="100"
              className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
            />
            <span className="absolute end-3 top-2.5 text-xs text-[#5B6470] font-bold">ج.م</span>
          </div>
        </div>

        <div className="pt-2 space-y-3 border-t border-[#E1E5DF]">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={sellableAtPos}
              onChange={(e) => setSellableAtPos(e.target.checked)}
              className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#14181F] focus:ring-0"
            />
            <div>
              <span className="text-xs font-bold text-[#14181F] block">
                متاحة للبيع السريع في نقطة البيع (POS)
              </span>
              <span className="text-[11px] text-[#5B6470] block">
                تظهر في تبويب الخدمات بشاشة الاستقبال والكاشير للبيع الفوري.
              </span>
            </div>
          </label>

          {isEditing && (
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#14181F] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-[#14181F] block">
                  خدمة نشطة ومفعلة
                </span>
                <span className="text-[11px] text-[#5B6470] block">
                  تعطيل الخدمة يخفيها من شاشات البيع دون حذف سجلاتها السابقة.
                </span>
              </div>
            </label>
          )}
        </div>
      </form>
    </Dialog>
  );
}

