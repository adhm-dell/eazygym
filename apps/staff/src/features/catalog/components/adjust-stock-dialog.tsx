"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ArrowUpDown, AlertCircle, PlusCircle, RotateCcw } from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { catalogApi } from "../api";
import type { Product } from "@gym/contracts";

interface AdjustStockDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updatedProduct: Product) => void;
  product: Product | null;
}

export function AdjustStockDialog({
  isOpen,
  onClose,
  onSuccess,
  product,
}: AdjustStockDialogProps) {
  const [mode, setMode] = useState<"ADD" | "SET">("ADD");
  const [quantity, setQuantity] = useState("10");
  const [note, setNote] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMode("ADD");
    setQuantity("10");
    setNote("");
    setError(null);
  }, [product, isOpen]);

  const currentStock = product?.stock ?? 0;

  const targetStock = useMemo(() => {
    const val = parseInt(quantity, 10);
    if (isNaN(val)) return currentStock;
    if (mode === "ADD") {
      return currentStock + val;
    }
    return val;
  }, [currentStock, quantity, mode]);

  const isFormValid =
    note.trim().length >= 3 &&
    !isNaN(parseInt(quantity, 10)) &&
    (mode === "ADD" ? parseInt(quantity, 10) > 0 : parseInt(quantity, 10) >= 0);

  if (!product) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isFormValid) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await catalogApi.adjustStock(product.id, targetStock, note.trim());
      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "فشل تعديل المخزون");
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
          <ArrowUpDown className="h-5 w-5 text-[#C6F24E]" />
          <span>تعديل مخزون: {product.name}</span>
        </div>
      }
      description={`المخزون الحالي المسجل في النظام: ${currentStock} وحدة`}
      footer={
        <div className="flex items-center justify-end gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            إلغاء
          </Button>
          <Button
            variant="lime"
            onClick={handleSubmit}
            isLoading={isSubmitting}
            disabled={!isFormValid || isSubmitting}
            className="font-bold"
          >
            تأكيد تعديل المخزون
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4 pt-2 text-start" dir="rtl">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
            <span>{error}</span>
          </div>
        )}

        {/* Operation Type Switch */}
        <div className="grid grid-cols-2 gap-2 p-1 bg-[#F2F4F1] rounded-xl border border-[#E1E5DF]">
          <button
            type="button"
            onClick={() => setMode("ADD")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === "ADD"
                ? "bg-[#14181F] text-white shadow-sm"
                : "text-[#5B6470] hover:text-[#14181F]"
            }`}
          >
            <PlusCircle className="h-3.5 w-3.5" />
            <span>إضافة للمخزن (شحنة/توريد)</span>
          </button>

          <button
            type="button"
            onClick={() => setMode("SET")}
            className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              mode === "SET"
                ? "bg-[#14181F] text-white shadow-sm"
                : "text-[#5B6470] hover:text-[#14181F]"
            }`}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>تصحيح الجرد (تعديل مباشر)</span>
          </button>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#5B6470] mb-1">
            {mode === "ADD" ? "الكمية المضافة" : "الكمية الجديدة الإجمالية"}{" "}
            <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min={mode === "ADD" ? "1" : "0"}
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-mono font-bold text-[#14181F] focus:outline-none focus:border-[#14181F]"
          />
        </div>

        {/* Live Preview */}
        <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl flex items-center justify-between text-xs text-emerald-950 font-bold">
          <span>معاينة الرصيد:</span>
          <div className="flex items-center gap-2 font-mono">
            <span>{currentStock}</span>
            <span>←</span>
            <span className="text-sm font-black text-emerald-800">{targetStock} وحدة</span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-[#5B6470] mb-1">
            سبب / ملاحظة التعديل <span className="text-red-500">* (مطلوب للرقابة والتدقيق)</span>
          </label>
          <textarea
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="مثال: استلام شحنة جديدة بفاتورة رقم 458 / تسوية فروق الجرد الشهري..."
            className="w-full px-3.5 py-2.5 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-xs font-medium text-[#14181F] focus:outline-none focus:border-[#14181F]"
          />
          {note.length > 0 && note.trim().length < 3 && (
            <p className="text-[11px] text-red-500 mt-1 font-bold">يرجى كتابة سبب لا يقل عن 3 أحرف.</p>
          )}
        </div>
      </form>
    </Dialog>
  );
}
