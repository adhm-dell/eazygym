"use client";

import React, { useState } from "react";
import { Badge } from "@gym/ui";
import { UserCheck, Award, Calendar, Users, Home } from "lucide-react";

export default function CoachHomePage() {
  const [activeTab, setActiveTab] = useState<"home" | "trainees" | "classes" | "commission">("home");
  const [sessionRegistered, setSessionRegistered] = useState(false);

  return (
    <div className="min-h-screen bg-[#E5E9E3] flex justify-center items-center sm:py-6">
      <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-[#F2F4F1] flex flex-col justify-between sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-[#14181F] overflow-hidden">
        {/* Mobile Header & Body */}
        <div className="flex-1 p-5 flex flex-col gap-3.5 overflow-y-auto">
          {/* Header */}
          <header className="pt-2">
            <p className="text-[13px] text-[#5B6470] font-medium">صباح الخير</p>
            <h1 className="text-[26px] font-bold text-[#14181F] tracking-tight">كابتن أحمد</h1>
          </header>

          {/* Hero Commission Card */}
          <section className="bg-[#14181F] text-white rounded-[18px] p-5 shadow-sm">
            <span className="text-[13px] text-[#C9CFD6] font-medium">العمولة هذا الشهر حتى الآن</span>
            <b className="text-[34px] font-bold block my-1">3,100 ج.م</b>
            <div className="flex items-center justify-between text-[13px] text-white/90">
              <span>المحصل 12,000 ج.م · شريحة 50%</span>
            </div>
            {/* Progress bar */}
            <div className="h-2.5 bg-[#3A4350] rounded-full mt-2.5 overflow-hidden">
              <div className="h-full bg-[#C6F24E] rounded-full w-[100%]" />
            </div>
            <p className="text-[13px] text-[#C9CFD6] mt-2 font-medium">وصلت لأعلى شريحة هذا الشهر</p>
          </section>

          {/* Today's Private Sessions */}
          <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px]">
            <h3 className="text-base font-bold text-[#14181F] mb-1">جلسات اليوم</h3>
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2.5 py-3 border-t border-[#E1E5DF]">
                <span className="font-medium text-[#14181F] flex-1 text-sm">محمد أحمد</span>
                <span className="text-[13px] text-[#5B6470] tabular-nums">17:00</span>
                <Badge variant="g">باقي 6</Badge>
              </div>
              <div className="flex items-center justify-between gap-2.5 py-3 border-t border-[#E1E5DF]">
                <span className="font-medium text-[#14181F] flex-1 text-sm">نور حسن</span>
                <span className="text-[13px] text-[#5B6470] tabular-nums">18:30</span>
                <Badge variant="w">باقي 1</Badge>
              </div>
            </div>
          </section>

          {/* Expiring Trainees */}
          <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px]">
            <h3 className="text-base font-bold text-[#14181F] mb-1">متدربون ينتهي اشتراكهم</h3>
            <div className="flex flex-col">
              <div className="flex items-center justify-between gap-2.5 py-3 border-t border-[#E1E5DF]">
                <span className="font-medium text-[#14181F] flex-1 text-sm">محمد أحمد</span>
                <Badge variant="w">3 أيام</Badge>
              </div>
              <div className="flex items-center justify-between gap-2.5 py-3 border-t border-[#E1E5DF]">
                <span className="font-medium text-[#14181F] flex-1 text-sm">هاني علي</span>
                <Badge variant="w">6 أيام</Badge>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setSessionRegistered(true)}
              className="w-full mt-2.5 bg-[#C6F24E] text-[#14181F] hover:bg-[#b5e03e] font-bold text-[15px] p-3 rounded-[10px] min-h-[44px] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <UserCheck className="h-4 w-4" />
              <span>{sessionRegistered ? "تم تسجيل الجلسة ✓" : "تسجيل جلسة"}</span>
            </button>
          </section>
        </div>

        {/* 4-item Bottom Navigation Bar */}
        <nav className="grid grid-cols-4 bg-white border-t border-[#E1E5DF] shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("home")}
            className={`py-3.5 px-1 text-center text-[13px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "home" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Home className="h-4 w-4" />
            <span>الرئيسية</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("trainees")}
            className={`py-3.5 px-1 text-center text-[13px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "trainees" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>متدربيني</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("classes")}
            className={`py-3.5 px-1 text-center text-[13px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "classes" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>الحصص</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("commission")}
            className={`py-3.5 px-1 text-center text-[13px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "commission" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Award className="h-4 w-4" />
            <span>عمولتي</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
