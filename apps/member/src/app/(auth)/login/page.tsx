"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginMember } from "../../../lib/api";
import { Dumbbell, Phone, Lock, AlertCircle, ArrowLeft, HelpCircle } from "lucide-react";

export default function MemberLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !password) {
      setError("يرجى إدخال رقم الهاتف المسجل وكلمة المرور");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await loginMember(phone, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "رقم الهاتف أو كلمة المرور غير صحيحة");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F4F1] text-[#14181F] flex flex-col justify-center items-center p-4 selection:bg-[#C6F24E]">
      <div className="w-full max-w-[420px] bg-white rounded-3xl border border-[#E1E5DF] p-6 shadow-xl space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="h-14 w-14 rounded-2xl bg-[#14181F] text-[#C6F24E] mx-auto flex items-center justify-center font-black shadow-md">
            <Dumbbell className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#14181F]">
            بوابة الأعضاء | EazyGym
          </h1>
          <p className="text-xs text-[#5B6470]">
            أدخل رقم هاتفك وكلمة المرور لمتابعة اشتراكك وحصصك
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
              رقم الهاتف المسجل
            </label>
            <div className="relative">
              <Phone className="absolute right-3 top-3 h-4 w-4 text-[#5B6470]" />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01xxxxxxxxx"
                required
                className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl pr-9 pl-3 py-2.5 text-sm font-mono text-left focus:outline-none focus:border-[#14181F]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-[#5B6470] block">
                كلمة المرور
              </label>
              <span className="text-[11px] text-[#5B6470]">
                (كود العضوية أو الباركود)
              </span>
            </div>
            <div className="relative">
              <Lock className="absolute right-3 top-3 h-4 w-4 text-[#5B6470]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كود العضوية أو الباركود"
                required
                className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl pr-9 pl-3 py-2.5 text-sm font-mono text-left focus:outline-none focus:border-[#14181F]"
              />
            </div>
            <p className="text-[11px] text-[#5B6470] pt-0.5">
              كلمة المرور الافتراضية هي كود عضويتك / الباركود المطبوع على كارت الجيم.
            </p>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] font-bold text-sm py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span>{loading ? "جاري الدخول..." : "تسجيل الدخول"}</span>
            <ArrowLeft className="h-4 w-4" />
          </button>
        </form>

        {/* Support & Recovery Hint */}
        <div className="p-3 rounded-xl bg-[#F9FAF8] border border-[#E1E5DF] text-xs text-[#5B6470] flex items-center gap-2">
          <HelpCircle className="h-4 w-4 shrink-0 text-[#14181F]" />
          <span>نسيت كلمة السر؟ تواصل مع موظف الاستقبال بالجيم.</span>
        </div>

        <div className="pt-2 text-center text-xs text-[#5B6470] border-t border-[#E1E5DF]">
          <span>EazyGym Member Portal v2.0 · جميع الحقوق محفوظة</span>
        </div>
      </div>
    </div>
  );
}
