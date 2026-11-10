"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
  Dumbbell,
  ShieldAlert,
  LogOut,
  Layers,
  Package,
  Tag,
  CreditCard,
  UserCheck,
  Settings,
  Globe,
} from "lucide-react";
import { cn, Button } from "@gym/ui";
import { ShiftProvider, useShift } from "../../lib/shift-context";
import { clearStoredAuth } from "../../lib/api";
import { OpenShiftDialog } from "../../features/shift/components/open-shift-dialog";
import { NotificationHeaderBell } from "../../features/notifications/components/notification-header-bell";
import { coachOpsApi } from "../../features/coach-ops/api";

interface NavItem {
  href: string;
  label: string;
  icon: any;
  roles: string[];
}

const allNavItems: NavItem[] = [
  { href: "/", label: "مسح الدخول", icon: QrCode, roles: ["RECEPTION", "GYM_ADMIN", "SUPER_ADMIN"] },
  { href: "/pos", label: "بيع (البار والخدمات)", icon: ShoppingCart, roles: ["RECEPTION", "BAR_CASHIER", "GYM_ADMIN"] },
  { href: "/admin", label: "لوحة التحكم", icon: LayoutDashboard, roles: ["GYM_ADMIN"] },
  { href: "/members", label: "الأعضاء", icon: Users, roles: ["RECEPTION", "GYM_ADMIN"] },
  { href: "/subscriptions", label: "الاشتراكات", icon: CreditCard, roles: ["RECEPTION", "GYM_ADMIN"] },
  { href: "/plans", label: "الباقات", icon: Layers, roles: ["GYM_ADMIN"] },
  { href: "/catalog", label: "الخدمات والمنتجات", icon: Package, roles: ["GYM_ADMIN"] },
  { href: "/promotions", label: "العروض", icon: Tag, roles: ["GYM_ADMIN"] },
  { href: "/coach-ops", label: "عمليات المدربين", icon: Dumbbell, roles: ["RECEPTION", "GYM_ADMIN"] },
  { href: "/classes", label: "الحصص", icon: CalendarDays, roles: ["RECEPTION", "GYM_ADMIN"] },
  { href: "/shift", label: "الوردية", icon: Clock, roles: ["RECEPTION", "BAR_CASHIER", "GYM_ADMIN"] },
  { href: "/expenses", label: "المصروفات", icon: DollarSign, roles: ["RECEPTION", "BAR_CASHIER", "GYM_ADMIN"] },
  { href: "/staff", label: "الموظفين", icon: UserCheck, roles: ["GYM_ADMIN"] },
  { href: "/settings", label: "الإعدادات", icon: Settings, roles: ["GYM_ADMIN"] },
  { href: "/platform", label: "إدارة المنصة", icon: Globe, roles: ["SUPER_ADMIN"] },
  ...(process.env.NODE_ENV !== "production"
    ? [{ href: "/design", label: "دليل التصميم", icon: Palette, roles: ["RECEPTION", "BAR_CASHIER", "GYM_ADMIN"] }]
    : []),
];

function SidebarUserFooter() {
  const { currentUser } = useShift();

  return (
    <div className="mt-auto pt-6 px-2.5 hidden md:block">
      <div className="p-3 rounded-xl bg-[#262D38]/50 border border-white/5 text-xs text-[#C9CFD6] space-y-2">
        <div className="flex items-center gap-1.5 text-white font-medium">
          <Sparkles className="h-3 w-3 text-[#C6F24E]" />
          <span>{currentUser?.role === "SUPER_ADMIN" ? "المنصة المركزية" : (currentUser as any)?.gym?.name || (currentUser as any)?.gymName || "منظومة إدارة الجيم"}</span>
        </div>
        <div className="pt-2 border-t border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-white truncate max-w-[120px]">
              {currentUser ? currentUser.name : "تحميل..."}
            </p>
            {currentUser?.role && (
              <p className="text-[10px] text-[#C6F24E] font-medium truncate max-w-[120px]">
                {currentUser.role}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={() => {
              clearStoredAuth();
              window.location.href = "/login";
            }}
            className="text-[11px] text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer transition-colors p-1 rounded hover:bg-white/5"
            title="تسجيل الخروج والعودة لصفحة الدخول"
          >
            <LogOut className="h-3 w-3" />
            <span>خروج</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function MainLayoutContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { currentUser, isLoading } = useShift();
  const [coachBadgeCount, setCoachBadgeCount] = useState(0);

  useEffect(() => {
    if (!currentUser || currentUser.role === "SUPER_ADMIN" || !currentUser.gymId) {
      return;
    }
    let mounted = true;
    const fetchBadge = async () => {
      try {
        const summary = await coachOpsApi.getAssignmentsSummary();
        if (mounted && summary) {
          setCoachBadgeCount((summary.pending || 0) + (summary.noCoachAvailable || 0));
        }
      } catch {
        // ignore
      }
    };
    fetchBadge();
    const interval = setInterval(fetchBadge, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [currentUser]);

  const router = useRouter();
  const userRole = currentUser?.role || "GYM_ADMIN";

  useEffect(() => {
    if (!isLoading && userRole === "SUPER_ADMIN" && pathname === "/") {
      router.replace("/platform");
    }
  }, [isLoading, userRole, pathname, router]);

  // Filter navigation items by role
  const visibleNavItems = allNavItems.filter((item) => {
    if (userRole === "SUPER_ADMIN") {
      return item.href === "/platform";
    }
    return item.roles.includes(userRole);
  });

  // Check if current route is allowed for user's role
  const currentRouteItem = allNavItems.find((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  const isForbidden =
    currentRouteItem && !isLoading && !currentRouteItem.roles.includes(userRole);

  return (
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
          {visibleNavItems.map((item) => {
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
                {item.href === "/coach-ops" && coachBadgeCount > 0 && (
                  <span className="ms-auto bg-[#C6F24E] text-[#14181F] text-[11px] font-black px-1.5 py-0.5 rounded-full">
                    {coachBadgeCount}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <SidebarUserFooter />
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 min-w-0 overflow-x-hidden flex flex-col">
        {/* Top Header Bar */}
        <header className="h-14 border-b border-[#E1E5DF] bg-white px-6 flex items-center justify-between shrink-0 z-10">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-[#5B6470]">
              {(currentUser as any)?.gym?.name || (currentUser as any)?.gymName || "منظومة الاستقبال"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <NotificationHeaderBell />
          </div>
        </header>

        <main className="flex-1 min-w-0">
          {isForbidden ? (
            <div className="p-8 max-w-lg mx-auto text-center mt-20 space-y-4 bg-white border border-[#E1E5DF] rounded-2xl shadow-sm" dir="rtl">
              <div className="h-14 w-14 rounded-full bg-[#FDF2F2] text-[#B3261E] mx-auto flex items-center justify-center font-bold">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <h2 className="text-xl font-bold text-[#14181F]">غير مصرح بالدخول (403 Forbidden)</h2>
              <p className="text-sm text-[#5B6470] leading-relaxed">
                هذه الصفحة مخصصة للمدير (GYM_ADMIN) أو المالك. دورك الحالي في النظام هو:{" "}
                <b className="text-[#14181F]">{userRole}</b> ولا يملك الصلاحية للوصول إلى هذا القسم.
              </p>
              <div className="pt-2 flex justify-center gap-3">
                <Link href={userRole === "SUPER_ADMIN" ? "/platform" : "/"}>
                  <Button variant="lime" className="font-bold rounded-xl">
                    {userRole === "SUPER_ADMIN" ? "الانتقال إلى إدارة المنصة" : "العودة للرئيسية"}
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            children
          )}
        </main>
      </div>

      <OpenShiftDialog />
    </div>
  );
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ShiftProvider>
      <MainLayoutContent>{children}</MainLayoutContent>
    </ShiftProvider>
  );
}
