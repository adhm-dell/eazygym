"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import {
  Bell,
  CheckCircle2,
  Clock,
  Dumbbell,
  AlertTriangle,
  CreditCard,
  Tag,
  ArrowRight,
  ExternalLink,
  Radio,
  Check,
  RefreshCw,
} from "lucide-react";
import { Button, Badge } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import { useNotifications } from "../../../features/notifications/use-notifications";
import type { NotificationItem } from "../../../features/notifications/api";

function getDeepLink(type: string): { href: string; label: string } | null {
  switch (type) {
    case "BREAK_REQUESTED":
    case "BREAK_OVERRUN":
    case "NO_COACH_AVAILABLE":
    case "NEW_MEMBER_ASSIGNMENT":
    case "ASSIGNMENT_ACCEPTED":
    case "ASSIGNMENT_REJECTED":
      return { href: "/coach-ops", label: "الانتقال لعمليات المدربين" };

    case "DISCOUNT_PENDING":
      return { href: "/pos", label: "الانتقال للمبيعات ونقطة البيع" };

    case "SUBSCRIPTION_EXPIRING":
    case "PAYMENT_OVERDUE":
    case "SESSIONS_LOW":
      return { href: "/subscriptions", label: "الانتقال لإدارة الاشتراكات" };

    case "SHIFT_OPEN_TOO_LONG":
      return { href: "/shift", label: "الانتقال للوردية" };

    default:
      return null;
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case "BREAK_REQUESTED":
    case "BREAK_OVERRUN":
      return <Clock className="w-5 h-5 text-amber-600" />;
    case "DISCOUNT_PENDING":
      return <Tag className="w-5 h-5 text-purple-600" />;
    case "PAYMENT_OVERDUE":
      return <AlertTriangle className="w-5 h-5 text-red-600" />;
    case "SUBSCRIPTION_EXPIRING":
      return <CreditCard className="w-5 h-5 text-blue-600" />;
    case "NO_COACH_AVAILABLE":
    case "NEW_MEMBER_ASSIGNMENT":
    case "ASSIGNMENT_ACCEPTED":
    case "ASSIGNMENT_REJECTED":
      return <Dumbbell className="w-5 h-5 text-emerald-600" />;
    default:
      return <Bell className="w-5 h-5 text-[#5B6470]" />;
  }
}

export default function NotificationsPage() {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const { items, unreadCount, isLoading, isConnected, fetchNotifications, markRead, markAllRead } =
    useNotifications();

  // Group notifications by date
  const grouped = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const todayItems: NotificationItem[] = [];
    const yesterdayItems: NotificationItem[] = [];
    const earlierItems: NotificationItem[] = [];

    items.forEach((item) => {
      const itemDate = item.createdAt.slice(0, 10);
      if (itemDate === today) {
        todayItems.push(item);
      } else if (itemDate === yesterday) {
        yesterdayItems.push(item);
      } else {
        earlierItems.push(item);
      }
    });

    return [
      { key: "today", title: t("notificationsCenter.today"), items: todayItems },
      { key: "yesterday", title: t("notificationsCenter.yesterday"), items: yesterdayItems },
      { key: "earlier", title: t("notificationsCenter.earlier"), items: earlierItems },
    ].filter((g) => g.items.length > 0);
  }, [items, t]);

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1000px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E1E5DF]">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl md:text-3xl font-black text-[#14181F]">
              {t("notificationsCenter.title")}
            </h1>
            {unreadCount > 0 && (
              <Badge variant="r" className="font-mono text-xs">
                {unreadCount} {t("notificationsCenter.unread")}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <p className="text-sm text-[#5B6470]">{t("notificationsCenter.description")}</p>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              <span className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-gray-400"}`} />
              <span>{t("notificationsCenter.liveConnected")}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchNotifications}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </Button>

          {unreadCount > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={markAllRead}
              className="font-bold flex items-center gap-1.5 bg-[#14181F] text-white"
            >
              <Check className="w-4 h-4" />
              <span>{t("notificationsCenter.markAllRead")}</span>
            </Button>
          )}
        </div>
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="py-24 text-center text-[#5B6470]">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-[#4D6B00] mb-2" />
          <p className="text-sm">جاري تحميل الإشعارات...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="py-20 text-center bg-white border border-dashed border-[#E1E5DF] rounded-2xl p-8 space-y-3">
          <Bell className="w-12 h-12 text-[#5B6470]/40 mx-auto" />
          <h3 className="text-lg font-bold text-[#14181F]">{t("notificationsCenter.empty")}</h3>
          <p className="text-xs text-[#5B6470]">
            ستصلك التنبيهات المباشرة فور حدوث أي نشاط في النظام (مثل طلبات استراحة المدربين أو انتهاء الاشتراكات)
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map((group) => (
            <div key={group.key} className="space-y-3">
              <h3 className="text-xs font-bold text-[#5B6470] px-1 uppercase tracking-wider">
                {group.title} ({group.items.length})
              </h3>

              <div className="bg-white border border-[#E1E5DF] rounded-2xl overflow-hidden divide-y divide-[#E1E5DF] shadow-xs">
                {group.items.map((item) => {
                  const deepLink = getDeepLink(item.type);

                  return (
                    <div
                      key={item.id}
                      className={`p-4 flex items-start justify-between gap-4 transition-colors ${
                        !item.isRead ? "bg-amber-50/20" : "hover:bg-[#F6F8F5]/60"
                      }`}
                    >
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className="p-2.5 rounded-xl bg-[#F6F8F5] border border-[#E1E5DF] shrink-0 mt-0.5">
                          {getNotificationIcon(item.type)}
                        </div>

                        <div className="space-y-1 min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-[#14181F] text-sm">
                              {item.title}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.2 rounded-full bg-gray-100 text-[#5B6470]">
                              {t(`notificationsCenter.types.${item.type}`) || item.type}
                            </span>
                            {!item.isRead && (
                              <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" title="غير مقروء" />
                            )}
                          </div>

                          <p className="text-xs text-[#5B6470] leading-relaxed">
                            {item.body}
                          </p>

                          <div className="flex items-center gap-4 pt-1 text-[11px] text-[#5B6470]">
                            <span className="font-mono dir-ltr">
                              {new Date(item.createdAt).toLocaleTimeString("ar-EG", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>

                            {deepLink && (
                              <Link
                                href={deepLink.href}
                                className="font-bold text-[#4D6B00] hover:underline flex items-center gap-1"
                              >
                                <span>{deepLink.label}</span>
                                <ExternalLink className="w-3 h-3" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Action to mark as read */}
                      {!item.isRead && (
                        <button
                          type="button"
                          onClick={() => markRead(item.id)}
                          className="px-2.5 py-1 text-[11px] font-bold rounded-lg border border-[#E1E5DF] bg-white hover:bg-[#F6F8F5] text-[#5B6470] shrink-0 transition-colors"
                        >
                          {t("notificationsCenter.markRead")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

