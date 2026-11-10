"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginCoach } from "../../../lib/api";
import { Dumbbell, Mail, Lock, AlertCircle, HelpCircle } from "lucide-react";

export default function CoachLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("يرجى إدخال البريد الإلكتروني وكلمة المرور");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loginCoach(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "البريد الإلكتروني أو كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4F1] text-[#14181F] flex flex-col justify-center items-center p-4 selection:bg-[#C6F24E]" dir="rtl">
      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-[#E1E5DF] p-6 shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-[#14181F] text-[#C6F24E] mx-auto flex items-center justify-center font-black shadow-md">
            <Dumbbell className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14181F]">
            بوابة المدربين | EazyGym
          </h1>
          <p className="text-xs text-[#5B6470]">
            سجل دخولك لمتابعة تدريباتك، عمولاتك، وجدول الحصص
          </p>
        </div>

        {error && (
          <div className="p-3 bg-[#FDE7E4] border border-red-200 text-[#B3261E] rounded-xl text-xs flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
            <label className="text-xs font-bold text-[#5B6470] block">
              البريد الإلكتروني للمدرب
            </label>
            <div className="relative flex items-center">
              <Mail className="absolute start-3 h-4 w-4 text-[#5B6470]" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
                required
                className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl py-2.5 ps-10 pe-3 text-sm font-medium text-[#14181F] outline-none focus:border-[#14181F] transition-all dir-ltr text-right"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-[#5B6470] block">
              كلمة المرور
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute start-3 h-4 w-4 text-[#5B6470]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl py-2.5 ps-10 pe-3 text-sm font-medium text-[#14181F] outline-none focus:border-[#14181F] transition-all dir-ltr text-right"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#14181F] hover:bg-[#262D38] text-[#C6F24E] font-bold rounded-xl text-sm transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "جارٍ تسجيل الدخول..." : "تسجيل الدخول كمدرب"}
          </button>
        </form>

        {/* Support & Recovery Hint */}
        <div className="p-3 rounded-xl bg-[#F9FAF8] border border-[#E1E5DF] text-xs text-[#5B6470] flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0 text-[#14181F]" />
          <span>نسيت كلمة السر؟ تواصل مع إدارة الجيم لتحديثها.</span>
        </div>

        <div className="pt-2 text-center text-xs text-[#5B6470] border-t border-[#E1E5DF]">
          <span>EazyGym Coach Portal v2.0 · جميع الحقوق محفوظة</span>
        </div>
      </div>
    </div>
  );
}
