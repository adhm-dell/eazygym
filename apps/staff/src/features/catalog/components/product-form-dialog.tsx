"use client";

import React, { useEffect, useState } from "react";
import { Package, AlertCircle } from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { catalogApi } from "../api";
import type { Product } from "@gym/contracts";

interface ProductFormDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (product: Product) => void;
  productToEdit?: Product | null;
}

export function ProductFormDialog({
  isOpen,
  onClose,
  onSuccess,
  productToEdit,
}: ProductFormDialogProps) {
  const isEditing = Boolean(productToEdit);

  const [name, setName] = useState("");
  const [priceEgp, setPriceEgp] = useState("");
  const [stock, setStock] = useState("0");
  const [isActive, setIsActive] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [generalError, setGeneralError] = useState<string | null>(null);

  useEffect(() => {
    if (productToEdit) {
      setName(productToEdit.name);
      setPriceEgp((productToEdit.price / 100).toString());
      setStock(productToEdit.stock.toString());
      setIsActive(productToEdit.isActive);
    } else {
      setName("");
      setPriceEgp("");
      setStock("0");
      setIsActive(true);
    }
    setFieldError(null);
    setGeneralError(null);
  }, [productToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldError(null);
    setGeneralError(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldError("اسم المنتج مطلوب");
      return;
    }

    const priceNum = parseFloat(priceEgp);
    if (isNaN(priceNum) || priceNum < 0) {
      setGeneralError("يرجى إدخال سعر صحيح (0 أو أكثر)");
      return;
    }

    const stockNum = parseInt(stock, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setGeneralError("يرجى إدخال كمية مخزن صحيحة (0 أو أكثر)");
      return;
    }

    const pricePiasters = Math.round(priceNum * 100);

    setIsSubmitting(true);
    try {
      let result: Product;
      if (isEditing && productToEdit) {
        result = await catalogApi.updateProduct(productToEdit.id, {
          name: trimmedName,
          price: pricePiasters,
          stock: stockNum,
          isActive,
        });
      } else {
        result = await catalogApi.createProduct({
          name: trimmedName,
          price: pricePiasters,
          stock: stockNum,
        });
      }
      onSuccess(result);
      onClose();
    } catch (err: any) {
      if (err?.code === "PRODUCT_EXISTS" || err?.statusCode === 409) {
        setFieldError("يوجد منتج بنفس هذا الاسم بالفعل في الجيم");
      } else {
        setGeneralError(err?.message || "حدث خطأ أثناء حفظ المنتج");
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
          <Package className="h-5 w-5 text-[#C6F24E]" />
          <span>{isEditing ? "تعديل منتج البار" : "إضافة منتج بار جديد"}</span>
        </div>
      }
      description={
        isEditing
          ? "تعديل اسم المنتج، سعره، رصيد المخزن وحالته"
          : "حدد اسم المنتج (مشروب، مكمل، سناك)، السعر، والكمية الافتتاحية للمخزن"
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
            {isEditing ? "حفظ التعديلات" : "إضافة المنتج"}
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
            اسم المنتج <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setFieldError(null);
            }}
            placeholder="مثال: مشروب بروتين شيك شوكولاتة"
            className={`w-full px-3.5 py-2.5 bg-[#F2F4F1] border rounded-xl text-sm font-medium text-[#14181F] focus:outline-none ${
              fieldError ? "border-red-500 bg-red-50/50" : "border-[#E1E5DF] focus:border-[#14181F]"
            }`}
          />
          {fieldError && <p className="text-xs text-red-500 mt-1 font-bold">{fieldError}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                placeholder="45"
                className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
              <span className="absolute end-3 top-2.5 text-xs text-[#5B6470] font-bold">ج.م</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#5B6470] mb-1">
              {isEditing ? "رصيد المخزن الحالي" : "رصيد المخزن الافتتاحي"}{" "}
              <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="0"
              value={stock}
              onChange={(e) => setStock(e.target.value)}
              placeholder="20"
              className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
            />
          </div>
        </div>

        {isEditing && (
          <div className="pt-2 border-t border-[#E1E5DF]">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-[#14181F] focus:ring-0"
              />
              <div>
                <span className="text-xs font-bold text-[#14181F] block">
                  منتج نشط ومتاح في شاشة الـ POS
                </span>
                <span className="text-[11px] text-[#5B6470] block">
                  تعطيل المنتج يخفيه من بار الجيم وشاشة البيع دون التأثير على فواتير المبيعات السابقة.
                </span>
              </div>
            </label>
          </div>
        )}
      </form>
    </Dialog>
  );
}

