"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { loginMember, switchMember } from "../../../lib/api";
import { Dumbbell, Phone, Lock, Sparkles, AlertCircle, ArrowLeft } from "lucide-react";

export default function MemberLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("01011122233");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const testMembers = [
    {
      name: "محمد أحمد",
      phone: "01011122233",
      code: "100245",
      badge: "عضو نشط (جيم + كابتن)",
      badgeColor: "bg-[#E3F5EA] text-[#1B7F4B]",
    },
    {
      name: "محمود حسن",
      phone: "01012345672",
      code: "100202",
      badge: "ينتهي بعد 3 أيام",
      badgeColor: "bg-[#FFF1D6] text-[#8A5A00]",
    },
    {
      name: "زياد محمود",
      phone: "01012345674",
      code: "100404",
      badge: "اشتراك مجمد (Frozen)",
      badgeColor: "bg-blue-100 text-blue-800",
    },
    {
      name: "كريم عادل",
      phone: "01012345675",
      code: "100505",
      badge: "قسط متأخر 500 ج.م",
      badgeColor: "bg-[#FDE7E4] text-[#B3261E]",
    },
  ];

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await loginMember(phone, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "فشل تسجيل الدخول");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = async (memberPhone: string) => {
    setLoading(true);
    setError(null);
    try {
      await switchMember(memberPhone);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "فشل التبديل للحساب");
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
            <label className="text-xs font-bold text-[#5B6470] block">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="absolute right-3 top-3 h-4 w-4 text-[#5B6470]" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••"
                required
                className="w-full bg-[#F2F4F1] border border-[#E1E5DF] rounded-xl pr-9 pl-3 py-2.5 text-sm font-mono text-left focus:outline-none focus:border-[#14181F]"
              />
            </div>
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

        {/* Quick Test Member Buttons (Live DB Seeders) */}
        <div className="pt-4 border-t border-[#E1E5DF] space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-[#14181F]">
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
            <span>تجربة فورية لحسابات تجريبية حقيقية بالـ DB:</span>
          </div>

          <div className="grid grid-cols-1 gap-2">
            {testMembers.map((m) => (
              <button
                key={m.phone}
                type="button"
                onClick={() => handleQuickSwitch(m.phone)}
                disabled={loading}
                className="w-full text-right p-2.5 rounded-xl border border-[#E1E5DF] hover:border-[#14181F] hover:bg-[#F2F4F1]/60 transition-all flex items-center justify-between cursor-pointer"
              >
                <div>
                  <div className="font-bold text-xs text-[#14181F]">{m.name}</div>
                  <div className="text-[10px] font-mono text-[#5B6470]">
                    كود: {m.code} | {m.phone}
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${m.badgeColor}`}>
                  {m.badge}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
