"use client";

import React from "react";
import { useToast, Button, Chip, Badge, StatCard } from "@gym/ui";
import { Lock, Wallet, Users, AlertCircle, FileSpreadsheet } from "lucide-react";

export default function AdminDashboardPage() {
  const { toast } = useToast();

  return (
    <div className="p-6 md:p-[26px_30px] flex flex-col gap-[18px]">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-[28px] font-bold tracking-tight text-[#14181F]">
          لوحة التحكم · اليوم
        </h1>
        <Chip>
          <span>أدمن · منى السيد</span>
        </Chip>
      </header>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-[14px]">
        <StatCard
          title="إيراد اليوم"
          value="18,450 ج.م"
          icon={<Wallet className="h-4 w-4" />}
        />
        <StatCard
          title="ورديات مفتوحة"
          value="2"
          icon={<Lock className="h-4 w-4" />}
        />
        <StatCard
          title="تنتهي خلال 7 أيام"
          value="14"
          icon={<Users className="h-4 w-4" />}
        />
        <StatCard
          title="متبقي متأخر"
          value="6 · 4,200 ج.م"
          valueClassName="text-[#B3261E]"
          icon={<AlertCircle className="h-4 w-4 text-[#B3261E]" />}
        />
      </div>

      {/* Two columns section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[18px]">
        {/* Open Shifts & Revenue by Payment Method */}
        <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px] flex flex-col">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-base font-bold text-[#14181F]">الورديات المفتوحة</h3>
            <Button
              variant="default"
              size="sm"
              onClick={() =>
                toast({
                  title: "قفل جميع الورديات",
                  description: "تم إرسال طلب جرد وقفل لجميع الورديات المفتوحة",
                })
              }
            >
              قفل الكل
            </Button>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E1E5DF] text-start text-[#5B6470] font-medium">
                <th className="text-start py-2 px-1.5">الموظف</th>
                <th className="text-start py-2 px-1.5">منذ</th>
                <th className="text-start py-2 px-1.5">الكاش المتوقع</th>
                <th className="text-end py-2 px-1.5"></th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E1E5DF]">
                <td className="py-2.5 px-1.5 font-medium">سارة (ريسبشن)</td>
                <td className="py-2.5 px-1.5 text-[#5B6470]">09:00</td>
                <td className="py-2.5 px-1.5 font-bold tabular-nums">2,550.00 ج.م</td>
                <td className="py-2.5 px-1.5 text-end">
                  <Button
                    variant="default"
                    size="sm"
                    className="min-h-[38px] px-3.5"
                    onClick={() =>
                      toast({
                        title: "قفل الوردية",
                        description: "فتح نموذج تقفيل وردية سارة (2,550.00 ج.م)",
                      })
                    }
                  >
                    قفل
                  </Button>
                </td>
              </tr>
              <tr className="border-b border-[#E1E5DF]">
                <td className="py-2.5 px-1.5 font-medium">عمر (بار)</td>
                <td className="py-2.5 px-1.5 text-[#5B6470]">12:00</td>
                <td className="py-2.5 px-1.5 font-bold tabular-nums">840.00 ج.م</td>
                <td className="py-2.5 px-1.5 text-end">
                  <Button
                    variant="default"
                    size="sm"
                    className="min-h-[38px] px-3.5"
                    onClick={() =>
                      toast({
                        title: "قفل الوردية",
                        description: "فتح نموذج تقفيل وردية عمر (840.00 ج.م)",
                      })
                    }
                  >
                    قفل
                  </Button>
                </td>
              </tr>
            </tbody>
          </table>

          {/* Revenue breakdown by payment method */}
          <h3 className="text-base font-bold text-[#14181F] mt-[22px] mb-2">
            الإيراد حسب طريقة الدفع
          </h3>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#5B6470] font-medium mb-1">
                <span>كاش 9,800 ج.م</span>
                <span>53%</span>
              </div>
              <div className="h-3 rounded-full bg-[#E1E5DF] overflow-hidden">
                <div className="h-full bg-[#14181F] rounded-full w-[53%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#5B6470] font-medium mb-1">
                <span>إنستا باي 5,600 ج.م</span>
                <span>30%</span>
              </div>
              <div className="h-3 rounded-full bg-[#E1E5DF] overflow-hidden">
                <div className="h-full bg-[#14181F] rounded-full w-[30%]" />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#5B6470] font-medium mb-1">
                <span>كارت 1,900 · محفظة 1,150 ج.م</span>
                <span>17%</span>
              </div>
              <div className="h-3 rounded-full bg-[#E1E5DF] overflow-hidden">
                <div className="h-full bg-[#14181F] rounded-full w-[17%]" />
              </div>
            </div>
          </div>
        </section>

        {/* Coach Commissions */}
        <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px] flex flex-col">
          <div className="flex items-center justify-between pb-3">
            <h3 className="text-base font-bold text-[#14181F]">عمولات الكباتن · الشهر الحالي</h3>
            <Badge variant="w">مسودة</Badge>
          </div>

          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-[#E1E5DF] text-start text-[#5B6470] font-medium">
                <th className="text-start py-2 px-1.5">الكابتن</th>
                <th className="text-start py-2 px-1.5">المحصل</th>
                <th className="text-start py-2 px-1.5">الشريحة</th>
                <th className="text-end py-2 px-1.5">العمولة</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-[#E1E5DF]">
                <td className="py-2.5 px-1.5 font-bold">أحمد</td>
                <td className="py-2.5 px-1.5 text-[#5B6470]">12,000</td>
                <td className="py-2.5 px-1.5">
                  <Badge variant="g">50%</Badge>
                </td>
                <td className="py-2.5 px-1.5 text-end font-bold tabular-nums">3,100 ج.م</td>
              </tr>
              <tr className="border-b border-[#E1E5DF]">
                <td className="py-2.5 px-1.5 font-bold">ياسر</td>
                <td className="py-2.5 px-1.5 text-[#5B6470]">8,400</td>
                <td className="py-2.5 px-1.5">
                  <Badge variant="w">40%</Badge>
                </td>
                <td className="py-2.5 px-1.5 text-end font-bold tabular-nums">1,960 ج.م</td>
              </tr>
              <tr className="border-b border-[#E1E5DF]">
                <td className="py-2.5 px-1.5 font-bold">هدى</td>
                <td className="py-2.5 px-1.5 text-[#5B6470]">3,200</td>
                <td className="py-2.5 px-1.5">
                  <Badge variant="w">40%</Badge>
                </td>
                <td className="py-2.5 px-1.5 text-end font-bold tabular-nums">720 ج.م</td>
              </tr>
            </tbody>
          </table>

          <p className="text-[13px] text-[#5B6470] my-3 leading-relaxed">
            الشريحة تُحدد بالمحصّل فعلاً وتُطبّق على كامل مبلغ الشهر.
          </p>

          <Button
            variant="lime"
            className="w-full mt-auto font-bold"
            onClick={() =>
              toast({
                title: "كشف المرتبات",
                description: "جاري تحميل تفاصيل كشف مرتبات وعمولات هذا الشهر",
              })
            }
          >
            <FileSpreadsheet className="h-4 w-4 me-1.5" />
            <span>فتح كشف المرتبات</span>
          </Button>
        </section>
      </div>

      {/* Actionable Alerts Card */}
      <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px]">
        <h3 className="text-base font-bold text-[#14181F] mb-1.5">تنبيهات تحتاج قرار</h3>

        <div className="flex flex-col">
          <div className="flex items-center justify-between gap-3 py-3 border-t border-[#E1E5DF]">
            <span className="font-medium text-[#14181F] text-sm">
              كريم سامي: اشتراك متوقف لعدم سداد 1,500 ج.م
            </span>
            <Badge variant="r">متأخر 5 أيام</Badge>
          </div>

          <div className="flex items-center justify-between gap-3 py-3 border-t border-[#E1E5DF]">
            <span className="font-medium text-[#14181F] text-sm">
              خصم يدوي 300 ج.م بانتظار الموافقة (سارة)
            </span>
            <Badge variant="w">موافقة</Badge>
          </div>
        </div>
      </section>
    </div>
  );
}

