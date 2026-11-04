"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  QrCode,
  ShoppingCart,
  LayoutDashboard,
  Users,
  CalendarDays,
  Clock,
  DollarSign,
  Palette,
  Sparkles,
} from "lucide-react";
import { cn } from "@gym/ui";
import { ShiftProvider } from "../../lib/shift-context";
import { OpenShiftDialog } from "../../features/shift/components/open-shift-dialog";

const navItems = [
  { href: "/", label: "مسح الدخول", icon: QrCode },
  { href: "/pos", label: "بيع (البار والخدمات)", icon: ShoppingCart },
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard },
  { href: "/members", label: "الأعضاء", icon: Users },
  { href: "/classes", label: "الحصص", icon: CalendarDays },
  { href: "/shift", label: "الوردية", icon: Clock },
  { href: "/expenses", label: "المصروفات", icon: DollarSign },
  { href: "/design", label: "دليل التصميم", icon: Palette },
];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <ShiftProvider>
      <div className="min-h-screen bg-[#F2F4F1] text-[#14181F] flex flex-col md:flex-row antialiased selection:bg-[#C6F24E] selection:text-[#14181F]">
        {/* 220px Dark Sidebar */}
        <aside className="w-full md:w-[220px] md:min-h-screen bg-[#14181F] text-white p-[22px_14px] flex flex-col gap-1.5 shrink-0 z-20">
          <div className="flex items-center gap-2 px-2.5 pb-5">
            <div className="h-7 w-7 rounded-lg bg-[#C6F24E] text-[#14181F] flex items-center justify-center font-black text-sm">
              EG
            </div>
            <b className="text-[18px] text-[#C6F24E] font-bold tracking-tight">EazyGym</b>
          </div>

          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname.startsWith(item.href);
              const Icon = item.icon;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-[10px] text-[15px] font-medium transition-colors no-underline",
                    isActive
                      ? "bg-[#262D38] text-white font-bold"
                      : "text-[#C9CFD6] hover:text-white hover:bg-[#262D38]/60"
                  )}
                >
                  <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-[#C6F24E]" : "text-[#C9CFD6]")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="mt-auto pt-6 px-2.5 hidden md:block">
            <div className="p-3 rounded-xl bg-[#262D38]/50 border border-white/5 text-xs text-[#C9CFD6] space-y-1">
              <div className="flex items-center gap-1.5 text-white font-medium">
                <Sparkles className="h-3 w-3 text-[#C6F24E]" />
                <span>فرع المعادي الرئيسي</span>
              </div>
              <p className="text-[11px] opacity-75">المشغل: سارة حسن (استقبال)</p>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport */}
        <div className="flex-1 min-w-0 overflow-x-hidden">
          {children}
        </div>

        <OpenShiftDialog />
      </div>
    </ShiftProvider>
  );
}
