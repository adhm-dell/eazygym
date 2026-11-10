"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, useToast } from "@gym/ui";
import { Lock, Mail, HelpCircle } from "lucide-react";

import { loginUser } from "../../../lib/api";

export default function StaffLoginPage() {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى إدخال البريد الإلكتروني وكلمة المرور",
        variant: "error",
      });
      return;
    }

    setIsLoading(true);

    try {
      const res = await loginUser(email, password);

      toast({
        title: "تم تسجيل الدخول بنجاح",
        description: `مرحباً بك: ${res.user.name} (${res.user.role})`,
        variant: "success",
      });
      router.push("/");
    } catch (err: any) {
      toast({
        title: "خطأ في تسجيل الدخول",
        description: err.message || "البريد الإلكتروني أو كلمة المرور غير صحيحة",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
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

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <Input
            label="البريد الإلكتروني"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            startIcon={<Mail className="h-4 w-4 text-[#5B6470]" />}
            required
          />

          <Input
            label="كلمة المرور"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
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

        {/* Support & Recovery Hint */}
        <div className="p-3 rounded-xl bg-[#F9FAF8] border border-[#E1E5DF] text-xs text-[#5B6470] flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0 text-[#14181F]" />
          <span>نسيت كلمة السر؟ تواصل مع مدير الجيم لإعادة تعيينها.</span>
        </div>

        <div className="pt-2 text-center text-xs text-[#5B6470] border-t border-[#E1E5DF]">
          <span>EazyGym Management System v2.0 · جميع الحقوق محفوظة</span>
        </div>
      </div>
    </div>
  );
}
