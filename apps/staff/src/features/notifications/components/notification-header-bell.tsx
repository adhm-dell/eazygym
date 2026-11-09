"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import { useNotifications } from "../use-notifications";
import { useTranslation } from "@gym/i18n";

export function NotificationHeaderBell() {
  const { t } = useTranslation();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-xl text-[#5B6470] hover:text-[#14181F] hover:bg-[#F6F8F5] transition-colors cursor-pointer"
        title="الإشعارات والتنبيهات المباشرة"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 end-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-600 text-white font-black text-[10px] flex items-center justify-center border-2 border-white animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div className="absolute end-0 mt-2 w-80 sm:w-96 bg-white border border-[#E1E5DF] rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="p-3.5 bg-[#F6F8F5] border-b border-[#E1E5DF] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#14181F]">الإشعارات</span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[#C6F24E] text-[#14181F]">
                  {unreadCount} جديد
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={markAllRead}
                className="text-xs text-[#5B6470] hover:text-[#14181F] font-semibold flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تحديد الكل كمقروء</span>
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-[#E1E5DF]">
            {items.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#5B6470]">
                لا توجد إشعارات جديدة حالياً
              </div>
            ) : (
              items.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  onClick={() => !item.isRead && markRead(item.id)}
                  className={`p-3 text-xs transition-colors cursor-pointer ${
                    !item.isRead ? "bg-amber-50/30 hover:bg-amber-50/50" : "hover:bg-[#F6F8F5]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-bold text-[#14181F] leading-tight">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-[#5B6470] font-mono shrink-0">
                      {new Date(item.createdAt).toLocaleTimeString("ar-EG", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5B6470] mt-1 line-clamp-2 leading-relaxed">
                    {item.body}
                  </p>
                </div>
              ))
            )}
          </div>

          <div className="p-2.5 bg-[#F6F8F5] border-t border-[#E1E5DF] text-center">
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs font-bold text-[#4D6B00] hover:underline flex items-center justify-center gap-1"
            >
              <span>عرض جميع الإشعارات</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

