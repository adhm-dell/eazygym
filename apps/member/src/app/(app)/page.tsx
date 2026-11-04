"use client";

import React, { useState } from "react";
import { Badge } from "@gym/ui";
import { Snowflake, Wallet, Calendar, Home, CreditCard } from "lucide-react";

export default function MemberHomePage() {
  const [activeTab, setActiveTab] = useState<"home" | "subscriptions" | "wallet" | "classes">("home");
  const [frozen, setFrozen] = useState(false);

  return (
    <div className="min-h-screen bg-[#E5E9E3] flex justify-center items-center sm:py-6">
      <div className="w-full max-w-[390px] min-h-screen sm:min-h-[844px] bg-[#F2F4F1] flex flex-col justify-between sm:rounded-[36px] sm:shadow-2xl sm:border-[8px] sm:border-[#14181F] overflow-hidden">
        {/* Mobile Header & Body */}
        <div className="flex-1 p-5 flex flex-col gap-3.5 overflow-y-auto">
          {/* Header */}
          <header className="flex items-center justify-between pt-2">
            <div>
              <p className="text-[13px] text-[#5B6470] font-medium">أهلاً</p>
              <h1 className="text-[26px] font-bold text-[#14181F] tracking-tight">محمد أحمد</h1>
            </div>
            <Badge variant="g">اشتراكك ساري</Badge>
          </header>

          {/* QR Code Card */}
          <section className="bg-white border border-[#E1E5DF] rounded-[18px] p-4 flex items-center gap-4 shadow-sm">
            <svg
              width="120"
              height="120"
              viewBox="0 0 21 21"
              role="img"
              aria-label="رمز QR للدخول"
              className="shrink-0 rounded-lg p-1 border border-[#E1E5DF]"
            >
              <rect width="21" height="21" fill="#fff" />
              <g fill="#14181F">
                <path d="M0 0h7v7H0zM14 0h7v7h-7zM0 14h7v7H0z" />
                <path d="M9 1h2v2H9zM9 5h3v2H9zM1 9h2v2H1zM5 9h3v3H5zM10 9h2v2h-2zM14 10h3v2h-3zM18 9h2v3h-2zM9 14h3v2H9zM14 14h2v3h-2zM17 17h3v3h-3zM10 18h3v2h-3z" />
              </g>
              <g fill="#fff">
                <path d="M1 1h5v5H1zM15 1h5v5h-5zM1 15h5v5H1z" />
              </g>
              <g fill="#14181F">
                <path d="M2 2h3v3H2zM16 2h3v3h-3zM2 16h3v3H2z" />
              </g>
            </svg>

            <div className="flex flex-col">
              <p className="text-[13px] text-[#5B6470] font-medium">كود العضو</p>
              <b className="text-[28px] font-bold text-[#14181F] tracking-wide tabular-nums">
                100245
              </b>
              <p className="text-[13px] text-[#5B6470]">اعرضه عند الدخول</p>
            </div>
          </section>

          {/* Gym Membership Card */}
          <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <b className="text-base font-bold text-[#14181F]">جيم 90 يوم</b>
              <Badge variant="w">ينتهي بعد 21 يوم</Badge>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-[#E1E5DF] rounded-full my-2 overflow-hidden">
              <div className="h-full bg-[#14181F] rounded-full w-[77%]" />
            </div>
            <p className="text-[13px] text-[#5B6470]">من 01/09 إلى 30/11</p>
          </section>

          {/* PT Membership Card */}
          <section className="bg-white border border-[#E1E5DF] rounded-[14px] p-[18px]">
            <div className="flex items-center justify-between gap-2">
              <b className="text-base font-bold text-[#14181F]">برايفت مع كابتن أحمد</b>
              <Badge variant="w">3 أيام</Badge>
            </div>
            {/* Progress bar */}
            <div className="h-2 bg-[#E1E5DF] rounded-full my-2 overflow-hidden">
              <div className="h-full bg-[#14181F] rounded-full w-[50%]" />
            </div>
            <p className="text-[13px] text-[#5B6470]">الجلسات: 6 من 12 متبقية</p>

            {/* Warning due box */}
            <div className="flex items-center justify-between mt-2.5 bg-[#FDE7E4] text-[#8F1F18] rounded-[10px] p-[10px_12px] text-sm">
              <span className="font-medium">متبقي عليك 500.00 ج.م</span>
              <b className="font-bold">قبل 20/11</b>
            </div>
          </section>

          {/* Actions & Wallet row */}
          <section className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setFrozen(!frozen)}
              className="flex-1 bg-[#14181F] text-white hover:bg-[#262D38] font-bold text-[15px] p-3 rounded-[10px] min-h-[44px] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Snowflake className="h-4 w-4 text-[#C6F24E]" />
              <span>{frozen ? "إلغاء التجميد" : "تجميد الاشتراك"}</span>
            </button>

            <div className="bg-white border border-[#E1E5DF] rounded-[14px] p-[10px_14px] shrink-0">
              <span className="text-[13px] text-[#5B6470] font-medium block">المحفظة</span>
              <b className="text-[15px] font-bold text-[#14181F] tabular-nums">250.00 ج.م</b>
            </div>
          </section>

          <p className="text-[13px] text-[#5B6470]">التجميد: متبقي مرة واحدة و10 أيام</p>
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
            onClick={() => setActiveTab("subscriptions")}
            className={`py-3.5 px-1 text-center text-[13px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "subscriptions" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <CreditCard className="h-4 w-4" />
            <span>اشتراكاتي</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("wallet")}
            className={`py-3.5 px-1 text-center text-[13px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "wallet" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Wallet className="h-4 w-4" />
            <span>المحفظة</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("classes")}
            className={`py-3.5 px-1 text-center text-[13px] min-h-[48px] flex flex-col items-center justify-center gap-1 transition-colors ${
              activeTab === "classes" ? "text-[#14181F] font-bold" : "text-[#5B6470]"
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>حصصي</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
