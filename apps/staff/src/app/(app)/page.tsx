"use client";

import React, { useState } from "react";
import { useToast, Button, Chip, Badge } from "@gym/ui";
import { Search, CheckCircle2, Clock, Play, Square, AlertTriangle } from "lucide-react";

export default function ReceptionScanPage() {
  const { toast } = useToast();
  const [scanQuery, setScanQuery] = useState("100245");
  const [isScanning, setIsScanning] = useState(false);

  const handleManualScan = (e: React.FormEvent) => {
    e.preventDefault();
    if (!scanQuery.trim()) return;
    setIsScanning(true);
    setTimeout(() => {
      setIsScanning(false);
      toast({
        title: "تم مسح العضو بنجاح",
        description: `العضو: محمد أحمد (كود ${scanQuery}) - تم تسجيل الدخول`,
        variant: "success",
      });
    }, 300);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_330px] min-h-[calc(100vh-1px)]">
      {/* Center Main Scan Area */}
      <main className="p-6 md:p-[26px_30px] flex flex-col gap-[18px]">
        {/* Header Row */}
        <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <h1 className="text-[28px] font-bold tracking-tight text-[#14181F]">
            مسح الدخول
          </h1>
          <Chip>
            <span>وردية سارة مفتوحة منذ 09:00 · الكاش المتوقع 2,550.00 ج.م</span>
          </Chip>
        </header>

        {/* Scan Input */}
        <form onSubmit={handleManualScan} className="flex flex-col gap-1.5">
          <label htmlFor="scan-input" className="text-[13px] text-[#5B6470] font-medium">
            امسح الباركود أو اكتب الاسم أو رقم الموبايل
          </label>
          <div className="relative flex items-center">
            <input
              id="scan-input"
              type="text"
              value={scanQuery}
              onChange={(e) => setScanQuery(e.target.value)}
              placeholder="اكتب كود العضو أو رقم الهاتف..."
              className="w-full text-[22px] font-medium p-[14px_18px] pe-12 border-2 border-[#14181F] rounded-[12px] bg-white text-[#14181F] outline-none transition-all focus:ring-4 focus:ring-[#C6F24E]/40"
              autoFocus
            />
            <button
              type="submit"
              disabled={isScanning}
              className="absolute end-3 text-[#14181F] p-2 hover:bg-[#F2F4F1] rounded-lg transition-colors"
            >
              <Search className="h-6 w-6" />
            </button>
          </div>
        </form>

        {/* Scan Result Card (Dark Green) */}
        <section className="bg-[#1B7F4B] text-white rounded-[18px] p-7 md:p-[28px_32px] grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6 shadow-sm">
          <div>
            <p className="text-[15px] font-semibold opacity-85 uppercase tracking-wider">ACTIVE</p>
            <h2 className="text-[40px] md:text-[48px] font-bold leading-[1.1] mt-0.5">
              تفضل بالدخول
            </h2>
          </div>

          <div className="sm:text-end">
            <p className="text-[26px] font-bold">محمد أحمد</p>
            <p className="text-sm opacity-90">كود 100245</p>
          </div>

          <div className="mt-2">
            <p className="text-sm font-medium">جيم 90 يوم · متبقي 21 يوم</p>
            {/* Progress Bar */}
            <div className="h-[10px] bg-white/25 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-white rounded-full w-[77%]" />
            </div>
          </div>

          <div className="sm:text-end mt-2">
            <p className="text-sm font-medium">برايفت مع الكابتن أحمد · متبقي 6 جلسات</p>
          </div>

          {/* Warning inner banner */}
          <div className="col-span-full mt-2 bg-[#FFF1D6] text-[#6B4400] rounded-[10px] p-[10px_14px] font-semibold text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 text-[#8A5A00]" />
            <span>اشتراك البرايفت ينتهي خلال 3 أيام. اعرض التجديد على العضو.</span>
          </div>
        </section>

        {/* Recent Check-ins Card */}
        <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px]">
          <h3 className="text-base font-bold text-[#14181F] mb-1.5">
            آخر عمليات الدخول
          </h3>

          <div className="flex flex-col">
            <div className="flex items-center justify-between gap-3 py-3 border-t border-[#E1E5DF]">
              <span className="font-medium text-[#14181F] flex-1">نور حسن</span>
              <Badge variant="g">ACTIVE</Badge>
              <span className="text-[13px] text-[#5B6470] tabular-nums">10:42</span>
            </div>

            <div className="flex items-center justify-between gap-3 py-3 border-t border-[#E1E5DF]">
              <span className="font-medium text-[#14181F] flex-1">كريم سامي</span>
              <Badge variant="r">متوقف لوجود متبقي مستحق</Badge>
              <Button
                variant="lime"
                size="sm"
                onClick={() =>
                  toast({
                    title: "تحصيل المتبقي",
                    description: "تم تحويل كريم سامي إلى نافذة التحصيل (1,500 ج.م)",
                  })
                }
              >
                تحصيل المتبقي
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 py-3 border-t border-[#E1E5DF]">
              <span className="font-medium text-[#14181F] flex-1">منى فؤاد</span>
              <Badge variant="r">الاشتراك منتهي</Badge>
              <Button
                variant="default"
                size="sm"
                onClick={() =>
                  toast({
                    title: "تجديد اشتراك",
                    description: "تم فتح نافذة تجديد باقة منى فؤاد",
                  })
                }
              >
                تجديد
              </Button>
            </div>

            <div className="flex items-center justify-between gap-3 py-3 border-t border-[#E1E5DF]">
              <span className="font-medium text-[#14181F] flex-1">هاني علي (كيك بوكس)</span>
              <Badge variant="w">الحصة لم تبدأ بعد</Badge>
              <span className="text-[13px] text-[#5B6470] tabular-nums">10:31</span>
            </div>
          </div>
        </section>
      </main>

      {/* Right Column: Today's Classes Panel (330px) */}
      <aside className="p-6 md:p-[26px_22px] flex flex-col gap-[14px] border-inline-start border-[#E1E5DF] bg-white">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-[#14181F]">حصص اليوم</h3>
          <span className="text-xs text-[#5B6470] font-medium">الأربعاء، 12 حصة</span>
        </div>

        {/* Class 1 */}
        <div className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px] flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[15px] font-bold text-[#14181F]">كيك بوكس 18:00</b>
            <Badge variant="w">لم تبدأ</Badge>
          </div>
          <p className="text-[13px] text-[#5B6470] my-2">
            المدرب لم يصل بعد · 14 مسجل
          </p>
          <Button
            variant="lime"
            className="w-full mt-1 font-bold"
            onClick={() =>
              toast({
                title: "بدء الكلاس",
                description: "تم بدء تسجيل حضور حصة كيك بوكس 18:00",
                variant: "success",
              })
            }
          >
            <Play className="h-4 w-4 me-1.5 fill-current" />
            <span>ابدأ الكلاس</span>
          </Button>
        </div>

        {/* Class 2 */}
        <div className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px] flex flex-col">
          <div className="flex items-center justify-between gap-2">
            <b className="text-[15px] font-bold text-[#14181F]">يوجا 16:00</b>
            <Badge variant="g">جارية</Badge>
          </div>
          <p className="text-[13px] text-[#5B6470] my-2">
            بدأت 16:10 · تنتهي 17:10 · دخل 9
          </p>
          <Button
            variant="default"
            className="w-full mt-1 font-bold"
            onClick={() =>
              toast({
                title: "إنهاء الكلاس",
                description: "تم إنهاء حصة يوجا 16:00 وتأكيد حضور 9 أعضاء",
              })
            }
          >
            <Square className="h-4 w-4 me-1.5 fill-current" />
            <span>إنهاء الكلاس</span>
          </Button>
        </div>
      </aside>
    </div>
  );
}
