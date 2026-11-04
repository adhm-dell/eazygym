"use client";

import React, { useState } from "react";
import { useToast, Button, Chip, Badge } from "@gym/ui";
import { ShoppingBag } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: number;
  category: "drinks" | "supplements" | "services";
  isService?: boolean;
}

const initialProducts: Product[] = [
  { id: "1", name: "مياه معدنية", price: 10, category: "drinks" },
  { id: "2", name: "بروتين شيك", price: 65, category: "drinks" },
  { id: "3", name: "قهوة", price: 35, category: "drinks" },
  { id: "4", name: "بار طاقة", price: 40, category: "supplements" },
  { id: "5", name: "ساونة", price: 50, category: "services", isService: true },
  { id: "6", name: "إنبودي", price: 80, category: "services", isService: true },
  { id: "7", name: "سيشن واحدة", price: 120, category: "services", isService: true },
  { id: "8", name: "عصير طازج", price: 45, category: "drinks" },
];

export default function PosCashierPage() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"all" | "drinks" | "supplements" | "services">("all");
  const [couponCode, setCouponCode] = useState("SUMMER");
  const [selectedPayment, setSelectedPayment] = useState<"cash" | "instapay" | "card" | "wallet">("wallet");

  // Cart items
  const [cart, setCart] = useState<{ [id: string]: number }>({
    "2": 2, // 2x بروتين شيك (130)
    "5": 1, // 1x ساونة (50)
    "1": 1, // 1x مياه معدنية (10)
  });

  const addToCart = (product: Product) => {
    setCart((prev) => ({
      ...prev,
      [product.id]: (prev[product.id] || 0) + 1,
    }));
    toast({
      title: "أضيف إلى الفاتورة",
      description: `${product.name} (+1)`,
    });
  };

  const filteredProducts =
    activeTab === "all"
      ? initialProducts
      : initialProducts.filter((p) => p.category === activeTab);

  // Subtotal calculation
  const subtotal = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = initialProducts.find((p) => p.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const discountAmount = couponCode.trim().toUpperCase() === "SUMMER" ? 19 : 0;
  const total = Math.max(0, subtotal - discountAmount);

  const handleCheckout = () => {
    toast({
      title: "تم إتمام عملية البيع بنجاح!",
      description: `تم خصم ${total.toFixed(2)} ج.م عبر المحفظة وطباعة الفاتورة`,
      variant: "success",
    });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] min-h-[calc(100vh-1px)]">
      {/* Product Catalog Area */}
      <main className="p-6 md:p-[24px_28px] flex flex-col gap-4">
        {/* Header */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold tracking-tight text-[#14181F]">
            البار والخدمات
          </h1>
          <Chip>
            <span>وردية عمر · مفتوحة</span>
          </Chip>
        </header>

        {/* Category Tabs */}
        <nav className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`px-[18px] py-2.5 rounded-full border text-[15px] font-medium transition-colors ${
              activeTab === "all"
                ? "bg-[#14181F] text-white border-[#14181F] font-bold"
                : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-[#F2F4F1]"
            }`}
          >
            الكل
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("drinks")}
            className={`px-[18px] py-2.5 rounded-full border text-[15px] font-medium transition-colors ${
              activeTab === "drinks"
                ? "bg-[#14181F] text-white border-[#14181F] font-bold"
                : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-[#F2F4F1]"
            }`}
          >
            مشروبات
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("supplements")}
            className={`px-[18px] py-2.5 rounded-full border text-[15px] font-medium transition-colors ${
              activeTab === "supplements"
                ? "bg-[#14181F] text-white border-[#14181F] font-bold"
                : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-[#F2F4F1]"
            }`}
          >
            مكملات
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("services")}
            className={`px-[18px] py-2.5 rounded-full border text-[15px] font-medium transition-colors ${
              activeTab === "services"
                ? "bg-[#14181F] text-white border-[#14181F] font-bold"
                : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-[#F2F4F1]"
            }`}
          >
            خدمات
          </button>
        </nav>

        {/* Product Grid (repeat 4 cols) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {filteredProducts.map((p) => (
            <button
              key={p.id}
              onClick={() => addToCart(p)}
              className="bg-white border border-[#E1E5DF] rounded-[14px] p-4 flex flex-col gap-2 min-h-[104px] text-start transition-all hover:border-[#14181F] hover:shadow-subtle active:scale-[0.98] cursor-pointer"
            >
              <b className="text-base font-bold text-[#14181F] leading-snug">{p.name}</b>
              <span className="text-sm text-[#5B6470] mt-auto">
                {p.isService ? `خدمة · ${p.price.toFixed(2)} ج.م` : `${p.price.toFixed(2)} ج.م`}
              </span>
            </button>
          ))}
        </div>
      </main>

      {/* Cart / Invoice Sidebar (400px) */}
      <aside className="bg-white border-inline-start border-[#E1E5DF] p-6 flex flex-col gap-3 shadow-sm">
        <h2 className="text-2xl font-bold text-[#14181F]">الفاتورة</h2>
        <p className="text-[13px] text-[#5B6470]">
          العضو: <strong className="text-[#14181F]">محمد أحمد</strong> · رصيد المحفظة 250.00 ج.م
        </p>

        {/* Cart Item rows */}
        <div className="flex flex-col my-1 divide-y divide-[#E1E5DF]">
          {Object.entries(cart).map(([id, qty]) => {
            const product = initialProducts.find((p) => p.id === id);
            if (!product) return null;
            return (
              <div key={id} className="flex justify-between items-center py-2.5 text-sm">
                <span className="font-medium text-[#14181F]">
                  {product.name} × {qty}
                </span>
                <b className="text-sm font-bold tabular-nums">
                  {(product.price * qty).toFixed(2)}
                </b>
              </div>
            );
          })}
        </div>

        {/* Coupon discount input */}
        <div className="flex items-center gap-2 mt-1">
          <input
            type="text"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            className="flex-1 text-sm font-semibold p-2.5 border border-[#C9CFD6] rounded-[10px] outline-none uppercase"
            placeholder="كود الخصم"
          />
          <Badge variant="g">خصم 10%</Badge>
        </div>

        {/* Discount breakdown */}
        <div className="flex justify-between items-center text-sm text-[#5B6470]">
          <span>الخصم</span>
          <span className="font-bold text-[#B3261E] tabular-nums">-{discountAmount.toFixed(2)}</span>
        </div>

        {/* Total Price */}
        <div className="flex justify-between items-baseline pt-2 border-t border-[#E1E5DF]">
          <span className="font-bold text-base text-[#14181F]">الإجمالي</span>
          <span className="text-[34px] font-bold text-[#14181F] tabular-nums">
            {total.toFixed(2)} ج.م
          </span>
        </div>

        {/* Payment Methods Grid */}
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button
            type="button"
            onClick={() => setSelectedPayment("cash")}
            className={`border-2 rounded-[10px] p-3 text-center text-[15px] font-bold transition-all cursor-pointer ${
              selectedPayment === "cash"
                ? "border-[#14181F] bg-[#14181F] text-white"
                : "border-[#E1E5DF] text-[#14181F] hover:bg-[#F2F4F1]"
            }`}
          >
            كاش
          </button>
          <button
            type="button"
            onClick={() => setSelectedPayment("instapay")}
            className={`border-2 rounded-[10px] p-3 text-center text-[15px] font-bold transition-all cursor-pointer ${
              selectedPayment === "instapay"
                ? "border-[#14181F] bg-[#14181F] text-white"
                : "border-[#E1E5DF] text-[#14181F] hover:bg-[#F2F4F1]"
            }`}
          >
            إنستا باي
          </button>
          <button
            type="button"
            onClick={() => setSelectedPayment("card")}
            className={`border-2 rounded-[10px] p-3 text-center text-[15px] font-bold transition-all cursor-pointer ${
              selectedPayment === "card"
                ? "border-[#14181F] bg-[#14181F] text-white"
                : "border-[#E1E5DF] text-[#14181F] hover:bg-[#F2F4F1]"
            }`}
          >
            كارت
          </button>
          <button
            type="button"
            onClick={() => setSelectedPayment("wallet")}
            className={`border-2 rounded-[10px] p-3 text-center text-[15px] font-bold transition-all cursor-pointer ${
              selectedPayment === "wallet"
                ? "border-[#14181F] bg-[#14181F] text-white"
                : "border-[#E1E5DF] text-[#14181F] hover:bg-[#F2F4F1]"
            }`}
          >
            محفظة {total.toFixed(2)}
          </button>
        </div>

        <p className="text-[13px] text-[#5B6470] mt-1">
          سيتم الخصم تلقائياً من رصيد العضو بما يسمح به.
        </p>

        {/* Big Action Button */}
        <Button
          variant="lime"
          size="lg"
          onClick={handleCheckout}
          className="w-full min-h-[56px] text-[18px] font-bold mt-auto"
        >
          <ShoppingBag className="h-5 w-5 me-2" />
          <span>إتمام البيع</span>
        </Button>
      </aside>
    </div>
  );
}

