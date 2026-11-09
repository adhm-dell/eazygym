"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Package,
  Sparkles,
  Search,
  Plus,
  ArrowUpDown,
  Edit2,
  AlertCircle,
  AlertTriangle,
  Power,
  Check,
  X,
} from "lucide-react";
import { formatMoney } from "../../../lib/money";
import { catalogApi } from "../../../features/catalog/api";
import { ServiceFormDialog } from "../../../features/catalog/components/service-form-dialog";
import { ProductFormDialog } from "../../../features/catalog/components/product-form-dialog";
import { AdjustStockDialog } from "../../../features/catalog/components/adjust-stock-dialog";
import { Button } from "@gym/ui";
import type { Service, Product } from "@gym/contracts";

// Configurable threshold for low-stock warning highlight
const LOW_STOCK_THRESHOLD = 5;

export default function CatalogPage() {
  const [activeTab, setActiveTab] = useState<"services" | "products">("services");

  // Data states
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search queries
  const [servicesSearch, setServicesSearch] = useState("");
  const [productsSearch, setProductsSearch] = useState("");

  // Modals state
  const [isServiceFormOpen, setIsServiceFormOpen] = useState(false);
  const [selectedServiceForEdit, setSelectedServiceForEdit] = useState<Service | null>(null);

  const [isProductFormOpen, setIsProductFormOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);

  const [isAdjustStockOpen, setIsAdjustStockOpen] = useState(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [sList, pList] = await Promise.all([
        catalogApi.listServices(),
        catalogApi.listProducts(),
      ]);
      setServices(sList);
      setProducts(pList);
    } catch (err: any) {
      console.error("Error loading catalog data:", err);
      setError(err?.message || "فشل في تحميل بيانات الخدمات والمنتجات");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filtered Services
  const filteredServices = useMemo(() => {
    return services.filter((s) =>
      !servicesSearch.trim() ||
      s.name.toLowerCase().includes(servicesSearch.trim().toLowerCase())
    );
  }, [services, servicesSearch]);

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter((p) =>
      !productsSearch.trim() ||
      p.name.toLowerCase().includes(productsSearch.trim().toLowerCase())
    );
  }, [products, productsSearch]);

  // Summary statistics
  const stats = useMemo(() => {
    const totalServices = services.length;
    const activeServices = services.filter((s) => s.isActive).length;

    const totalProducts = products.length;
    const activeProducts = products.filter((p) => p.isActive).length;
    const lowStockCount = products.filter((p) => p.stock > 0 && p.stock <= LOW_STOCK_THRESHOLD).length;
    const outOfStockCount = products.filter((p) => p.stock <= 0).length;

    return {
      totalServices,
      activeServices,
      totalProducts,
      activeProducts,
      lowStockCount,
      outOfStockCount,
    };
  }, [services, products]);

  // Toggle Service Active Status
  const handleToggleServiceActive = async (service: Service) => {
    try {
      await catalogApi.toggleServiceActive(service.id, !service.isActive);
      setServices((prev) =>
        prev.map((s) => (s.id === service.id ? { ...s, isActive: !service.isActive } : s))
      );
    } catch (err: any) {
      alert(err?.message || "فشل تعديل حالة الخدمة");
    }
  };

  // Toggle Product Active Status
  const handleToggleProductActive = async (product: Product) => {
    try {
      await catalogApi.toggleProductActive(product.id, !product.isActive);
      setProducts((prev) =>
        prev.map((p) => (p.id === product.id ? { ...p, isActive: !product.isActive } : p))
      );
    } catch (err: any) {
      alert(err?.message || "فشل تعديل حالة المنتج");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#14181F] flex items-center gap-2.5">
            <Package className="h-7 w-7 text-[#14181F]" />
            <span>إدارة الخدمات ومنتجات البار</span>
          </h1>
          <p className="text-sm text-[#5B6470] mt-1">
            إعداد قائمة الخدمات الإضافية، مشروبات وسناكس البار، ومتابعة وضبط أرصدة المخزون
          </p>
        </div>

        <div className="flex items-center gap-3">
          {activeTab === "services" ? (
            <Button
              variant="lime"
              onClick={() => {
                setSelectedServiceForEdit(null);
                setIsServiceFormOpen(true);
              }}
              className="rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة خدمة جديدة</span>
            </Button>
          ) : (
            <Button
              variant="lime"
              onClick={() => {
                setSelectedProductForEdit(null);
                setIsProductFormOpen(true);
              }}
              className="rounded-xl font-bold flex items-center gap-2 shadow-sm text-sm"
            >
              <Plus className="h-4 w-4" />
              <span>إضافة منتج جديد</span>
            </Button>
          )}
        </div>
      </div>

      {/* Top Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-[#5B6470] block">إجمالي الخدمات</span>
          <b className="text-xl font-black text-[#14181F] font-mono mt-1 block">
            {stats.totalServices}
          </b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-emerald-700 block">خدمات نشطة</span>
          <b className="text-xl font-black text-emerald-800 font-mono mt-1 block">
            {stats.activeServices}
          </b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-[#14181F] block">إجمالي المنتجات</span>
          <b className="text-xl font-black text-[#14181F] font-mono mt-1 block">
            {stats.totalProducts}
          </b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-emerald-700 block">منتجات نشطة</span>
          <b className="text-xl font-black text-emerald-800 font-mono mt-1 block">
            {stats.activeProducts}
          </b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-amber-700 block">
            مخزون منخفض (≤ {LOW_STOCK_THRESHOLD})
          </span>
          <b className="text-xl font-black text-amber-800 font-mono mt-1 block">
            {stats.lowStockCount}
          </b>
        </div>

        <div className="p-3.5 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle">
          <span className="text-[11px] font-bold text-red-700 block">نفد من المخزن</span>
          <b className="text-xl font-black text-red-800 font-mono mt-1 block">
            {stats.outOfStockCount}
          </b>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E1E5DF] pb-1">
        <button
          type="button"
          onClick={() => setActiveTab("services")}
          className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "services"
              ? "bg-white text-[#14181F] border-[#14181F] shadow-sm"
              : "text-[#5B6470] border-transparent hover:text-[#14181F] hover:bg-white/50"
          }`}
        >
          <Sparkles className="h-4 w-4 text-[#C6F24E]" />
          <span>الخدمات الإضافية ({services.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("products")}
          className={`px-5 py-3 rounded-xl text-sm font-bold transition-all flex items-center gap-2 border-b-2 ${
            activeTab === "products"
              ? "bg-white text-[#14181F] border-[#14181F] shadow-sm"
              : "text-[#5B6470] border-transparent hover:text-[#14181F] hover:bg-white/50"
          }`}
        >
          <Package className="h-4 w-4 text-[#14181F]" />
          <span>منتجات البار والمخزن ({products.length})</span>
        </button>
      </div>

      {/* Main Content Area */}
      {isLoading ? (
        <div className="p-16 text-center text-[#5B6470] bg-white rounded-2xl border border-[#E1E5DF] space-y-3">
          <div className="w-8 h-8 border-3 border-[#14181F] border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="text-sm font-bold">جاري تحميل بيانات الكتالوج...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-700 bg-red-50 rounded-2xl border border-red-200 space-y-2">
          <AlertCircle className="h-6 w-6 text-red-500 mx-auto" />
          <p className="text-sm font-bold">{error}</p>
          <Button variant="outline" onClick={fetchData} className="mt-2 text-xs">
            إعادة المحاولة
          </Button>
        </div>
      ) : activeTab === "services" ? (
        /* ================= SERVICES TAB ================= */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="p-4 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute start-3.5 top-3 text-[#5B6470]" />
              <input
                type="text"
                value={servicesSearch}
                onChange={(e) => setServicesSearch(e.target.value)}
                placeholder="بحث باسم الخدمة..."
                className="w-full ps-10 pe-3.5 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-medium text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
            </div>
            <div className="text-xs text-[#5B6470] font-bold">
              عرض {filteredServices.length} من أصل {services.length} خدمة
            </div>
          </div>

          {filteredServices.length === 0 ? (
            <div className="p-12 text-center text-[#5B6470] bg-white rounded-2xl border border-[#E1E5DF] space-y-3">
              <Sparkles className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-base font-bold text-[#14181F]">لم يتم العثور على خدمات</p>
              <p className="text-xs text-[#5B6470]">
                لا توجد خدمات تطابق البحث الحالي. يمكنك إضافة خدمة جديدة للبدء.
              </p>
              <Button
                variant="lime"
                onClick={() => {
                  setSelectedServiceForEdit(null);
                  setIsServiceFormOpen(true);
                }}
                className="text-xs font-bold rounded-xl mt-2"
              >
                إضافة أول خدمة
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E1E5DF] overflow-hidden shadow-subtle">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E1E5DF] bg-[#F8F9F7] text-[#5B6470] text-[11px] font-bold">
                      <th className="py-3 px-4 text-start">اسم الخدمة</th>
                      <th className="py-3 px-4 text-start">السعر</th>
                      <th className="py-3 px-4 text-start">متاحة في شاشة الـ POS</th>
                      <th className="py-3 px-4 text-start">الحالة</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E5DF]">
                    {filteredServices.map((service) => (
                      <tr
                        key={service.id}
                        className={`hover:bg-[#F8F9F7] transition-colors ${
                          !service.isActive ? "opacity-60 bg-gray-50/50" : ""
                        }`}
                      >
                        <td className="py-3.5 px-4 font-bold text-[#14181F]">
                          <div className="flex items-center gap-2">
                            <span>{service.name}</span>
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-black font-mono text-[#14181F] text-sm">
                          {formatMoney(service.price)}
                        </td>

                        <td className="py-3.5 px-4">
                          {service.sellableAtPos ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>نعم (بيع مباشر)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                              <X className="h-3 w-3 text-gray-400" />
                              <span>ضمن باقات فقط</span>
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          {service.isActive ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              نشطة
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                              معطلة
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedServiceForEdit(service);
                                setIsServiceFormOpen(true);
                              }}
                              title="تعديل الخدمة"
                              className="p-1.5 rounded-lg text-[#5B6470] hover:text-[#14181F] hover:bg-[#F2F4F1] transition-all"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleServiceActive(service)}
                              title={service.isActive ? "تعطيل الخدمة" : "تفعيل الخدمة"}
                              className={`p-1.5 rounded-lg transition-all ${
                                service.isActive
                                  ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                  : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                              }`}
                            >
                              <Power className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ================= PRODUCTS TAB ================= */
        <div className="space-y-4">
          {/* Search bar */}
          <div className="p-4 bg-white rounded-2xl border border-[#E1E5DF] shadow-subtle flex items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="h-4 w-4 absolute start-3.5 top-3 text-[#5B6470]" />
              <input
                type="text"
                value={productsSearch}
                onChange={(e) => setProductsSearch(e.target.value)}
                placeholder="بحث باسم المنتج..."
                className="w-full ps-10 pe-3.5 py-2 bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl text-sm font-medium text-[#14181F] focus:outline-none focus:border-[#14181F]"
              />
            </div>
            <div className="text-xs text-[#5B6470] font-bold">
              عرض {filteredProducts.length} من أصل {products.length} منتج
            </div>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="p-12 text-center text-[#5B6470] bg-white rounded-2xl border border-[#E1E5DF] space-y-3">
              <Package className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-base font-bold text-[#14181F]">لم يتم العثور على منتجات بار</p>
              <p className="text-xs text-[#5B6470]">
                لا توجد منتجات تطابق البحث الحالي. يمكنك إضافة منتج جديد للبدء.
              </p>
              <Button
                variant="lime"
                onClick={() => {
                  setSelectedProductForEdit(null);
                  setIsProductFormOpen(true);
                }}
                className="text-xs font-bold rounded-xl mt-2"
              >
                إضافة أول منتج
              </Button>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-[#E1E5DF] overflow-hidden shadow-subtle">
              <div className="overflow-x-auto">
                <table className="w-full text-start text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[#E1E5DF] bg-[#F8F9F7] text-[#5B6470] text-[11px] font-bold">
                      <th className="py-3 px-4 text-start">اسم المنتج</th>
                      <th className="py-3 px-4 text-start">السعر</th>
                      <th className="py-3 px-4 text-start">الكمية بالمخزن</th>
                      <th className="py-3 px-4 text-start">حالة المخزون</th>
                      <th className="py-3 px-4 text-start">الحالة</th>
                      <th className="py-3 px-4 text-center">الإجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E1E5DF]">
                    {filteredProducts.map((product) => {
                      const isOutOfStock = product.stock <= 0;
                      const isLowStock = product.stock > 0 && product.stock <= LOW_STOCK_THRESHOLD;

                      return (
                        <tr
                          key={product.id}
                          className={`hover:bg-[#F8F9F7] transition-colors ${
                            !product.isActive ? "opacity-60 bg-gray-50/50" : ""
                          }`}
                        >
                          <td className="py-3.5 px-4 font-bold text-[#14181F]">
                            <span>{product.name}</span>
                          </td>

                          <td className="py-3.5 px-4 font-black font-mono text-[#14181F] text-sm">
                            {formatMoney(product.price)}
                          </td>

                          <td className="py-3.5 px-4">
                            <span
                              className={`font-mono font-bold text-xs px-2.5 py-1 rounded-lg ${
                                isOutOfStock
                                  ? "bg-red-100 text-red-800"
                                  : isLowStock
                                  ? "bg-amber-100 text-amber-900"
                                  : "bg-[#F2F4F1] text-[#14181F]"
                              }`}
                            >
                              {product.stock} وحدة
                            </span>
                          </td>

                          <td className="py-3.5 px-4">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-red-700 bg-red-50 px-2 py-0.5 rounded-md">
                                <AlertCircle className="h-3 w-3 text-red-500" />
                                <span>نفد المخزون</span>
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-md">
                                <AlertTriangle className="h-3 w-3 text-amber-500" />
                                <span>مخزون منخفض (≤ {LOW_STOCK_THRESHOLD})</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md">
                                <Check className="h-3 w-3 text-emerald-500" />
                                <span>متوفر</span>
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            {product.isActive ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                نشط
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-200 text-gray-700">
                                <span className="w-1.5 h-1.5 rounded-full bg-gray-500"></span>
                                معطل
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4">
                            <div className="flex items-center justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForAdjust(product);
                                  setIsAdjustStockOpen(true);
                                }}
                                title="تعديل رصيد المخزن (توريد / جرد)"
                                className="p-1.5 rounded-lg text-emerald-700 hover:text-emerald-900 hover:bg-emerald-50 transition-all font-bold flex items-center gap-1"
                              >
                                <ArrowUpDown className="h-4 w-4" />
                                <span className="text-[11px]">جرد</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedProductForEdit(product);
                                  setIsProductFormOpen(true);
                                }}
                                title="تعديل المنتج"
                                className="p-1.5 rounded-lg text-[#5B6470] hover:text-[#14181F] hover:bg-[#F2F4F1] transition-all"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => handleToggleProductActive(product)}
                                title={product.isActive ? "تعطيل المنتج" : "تفعيل المنتج"}
                                className={`p-1.5 rounded-lg transition-all ${
                                  product.isActive
                                    ? "text-amber-600 hover:text-amber-800 hover:bg-amber-50"
                                    : "text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50"
                                }`}
                              >
                                <Power className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <ServiceFormDialog
        isOpen={isServiceFormOpen}
        onClose={() => {
          setIsServiceFormOpen(false);
          setSelectedServiceForEdit(null);
        }}
        onSuccess={() => {
          fetchData();
        }}
        serviceToEdit={selectedServiceForEdit}
      />

      <ProductFormDialog
        isOpen={isProductFormOpen}
        onClose={() => {
          setIsProductFormOpen(false);
          setSelectedProductForEdit(null);
        }}
        onSuccess={() => {
          fetchData();
        }}
        productToEdit={selectedProductForEdit}
      />

      <AdjustStockDialog
        isOpen={isAdjustStockOpen}
        onClose={() => {
          setIsAdjustStockOpen(false);
          setSelectedProductForAdjust(null);
        }}
        onSuccess={() => {
          fetchData();
        }}
        product={selectedProductForAdjust}
      />
    </div>
  );
}
