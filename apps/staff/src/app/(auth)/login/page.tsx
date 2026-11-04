"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, useToast } from "@gym/ui";
import { Lock, Mail } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("reception@powercore.gym");
  const [password, setPassword] = useState("••••••••");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: "مرحباً بك في منظومة EazyGym",
        variant: "success",
      });
      router.push("/");
    }, 400);
  };

  const handleQuickSelectStaff = (staffEmail: string) => {
    setEmail(staffEmail);
    setPassword("123456");
  };

  return (
    <div className="min-h-screen bg-[#F2F4F1] text-[#14181F] flex items-center justify-center p-4 antialiased">
      <div className="w-full max-w-[420px] bg-white border border-[#E1E5DF] rounded-[18px] p-8 shadow-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="mx-auto h-12 w-12 rounded-2xl bg-[#14181F] text-[#C6F24E] flex items-center justify-center font-black text-xl shadow-sm">
            EG
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14181F]">
            EazyGym
          </h1>
          <p className="text-xs text-[#5B6470] font-medium">
            بوابة تسجيل الدخول لمنظومة الاستقبال والإدارة
          </p>
        </div>

        {/* Quick Staff Selector */}
        <div className="p-3 rounded-[12px] bg-[#F2F4F1] border border-[#E1E5DF] space-y-2 text-start">
          <span className="text-xs text-[#5B6470] font-bold block">
            حسابات تجريبية سريعة:
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => handleQuickSelectStaff("reception@powercore.gym")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                email === "reception@powercore.gym"
                  ? "bg-[#14181F] text-[#C6F24E] border-[#14181F]"
                  : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-slate-50"
              }`}
            >
              سارة (استقبال)
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelectStaff("bar@powercore.gym")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                email === "bar@powercore.gym"
                  ? "bg-[#14181F] text-[#C6F24E] border-[#14181F]"
                  : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-slate-50"
              }`}
            >
              عمر (كاشير البار)
            </button>
            <button
              type="button"
              onClick={() => handleQuickSelectStaff("admin@powercore.gym")}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                email === "admin@powercore.gym"
                  ? "bg-[#14181F] text-[#C6F24E] border-[#14181F]"
                  : "bg-white text-[#14181F] border-[#E1E5DF] hover:bg-slate-50"
              }`}
            >
              منى (أدمن)
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            startIcon={<Mail className="h-4 w-4 text-[#5B6470]" />}
            required
          />

          <Input
            label="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            startIcon={<Lock className="h-4 w-4 text-[#5B6470]" />}
            required
          />

          <Button
            type="submit"
            variant="lime"
            size="lg"
            isLoading={isLoading}
            className="w-full text-base font-bold shadow-sm"
          >
            <span>دخول المنظومة</span>
          </Button>
        </form>

        <div className="pt-2 text-center text-xs text-[#5B6470] border-t border-[#E1E5DF]">
          <span>EazyGym Management System v2.0 · جميع الحقوق محفوظة</span>
        </div>
      </div>
    </div>
  );
}
