"use client";

import React, { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import {
  Users,
  Search,
  ExternalLink,
  Phone,
  UserCheck,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { Dialog, Button } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import { classesApi, type ScheduleRegisteredMember, type ClassMember } from "../api";

interface RegisteredMembersDialogProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: {
    id: string;
    name: string;
    capacity?: number;
    registeredCount?: number;
    members?: ClassMember[];
  } | null;
}

export function RegisteredMembersDialog({
  isOpen,
  onClose,
  schedule,
}: RegisteredMembersDialogProps) {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";

  const [isLoading, setIsLoading] = useState(false);
  const [members, setMembers] = useState<ScheduleRegisteredMember[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !schedule?.id) {
      setMembers([]);
      setSearchQuery("");
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    classesApi
      .getScheduleMembers(schedule.id)
      .then((data) => {
        setMembers(data);
      })
      .catch((err) => {
        console.warn("Failed to load schedule members, falling back to passed members", err);
        // Fallback to schedule.members if available
        if (schedule.members && schedule.members.length > 0) {
          setMembers(
            schedule.members.map((m) => ({
              subscriptionId: "",
              subscriptionStatus: "ACTIVE",
              planName: "اشتراك حصص",
              member: m,
            }))
          );
        } else {
          setError(err?.message || "تعذر تحميل قائمة المشتركين");
        }
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [isOpen, schedule]);

  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const q = searchQuery.toLowerCase().trim();
    return members.filter(
      (m) =>
        m.member.name.toLowerCase().includes(q) ||
        m.member.code.toLowerCase().includes(q) ||
        (m.member.phone && m.member.phone.includes(q))
    );
  }, [members, searchQuery]);

  if (!schedule) return null;

  const count = members.length;
  const capacity = schedule.capacity || 0;
  const percent = capacity > 0 ? Math.min(100, Math.round((count / capacity) * 100)) : 0;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-[#C6F24E]/20 text-[#14181F]">
            <Users className="w-5 h-5 text-[#4D6B00]" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-[#14181F]">
              {t("classesTimetable.registeredMembers")} - {schedule.name}
            </h3>
            <p className="text-xs text-[#5B6470] mt-0.5">
              قائمة الأعضاء المسجلين في هذا الموعد وحالة اشتراكاتهم
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-[#5B6470]">
            إجمالي المسجلين: <strong className="text-[#14181F] font-bold">{count}</strong>
            {capacity > 0 && ` / ${capacity}`}
          </div>
          <Button variant="default" onClick={onClose}>
            {t("common.close")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* Capacity summary bar */}
        {capacity > 0 && (
          <div className="p-3.5 bg-[#F6F8F5] border border-[#E1E5DF] rounded-xl flex flex-col gap-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#14181F]">
                نسبة الامتلاء للمجموعة: {count} من {capacity} مشترك
              </span>
              <span className="font-bold text-[#4D6B00]">{percent}%</span>
            </div>
            <div className="h-2 w-full bg-[#E1E5DF] rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  percent >= 100 ? "bg-red-500" : percent >= 80 ? "bg-amber-500" : "bg-[#C6F24E]"
                }`}
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-[#5B6470]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث بالاسم أو الكود أو رقم الموبايل..."
            className="w-full h-10 ps-9 pe-3 text-sm bg-white border border-[#E1E5DF] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-transparent"
          />
        </div>

        {/* Members List */}
        {isLoading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-2 text-[#5B6470]">
            <Loader2 className="w-6 h-6 animate-spin text-[#4D6B00]" />
            <span className="text-sm">جاري تحميل قائمة المشتركين...</span>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="py-12 text-center text-[#5B6470] bg-[#F6F8F5] rounded-xl border border-dashed border-[#E1E5DF]">
            <Users className="w-10 h-10 mx-auto text-[#5B6470]/40 mb-2" />
            <p className="text-sm font-semibold">
              {searchQuery ? "لا توجد نتائج تطابق بحثك" : t("classesTimetable.noRegisteredMembers")}
            </p>
            <p className="text-xs text-[#5B6470] mt-1">
              يتم تسجيل الأعضاء في مواعيد الحصص تلقائياً عند بيع باقة حصص أو تجديدها
            </p>
          </div>
        ) : (
          <div className="border border-[#E1E5DF] rounded-xl overflow-hidden divide-y divide-[#E1E5DF]">
            {filteredMembers.map((item, idx) => (
              <div
                key={`${item.member.id}-${idx}`}
                className="p-3 bg-white hover:bg-[#F6F8F5] transition-colors flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-[#E1E5DF]/50 flex items-center justify-center font-bold text-[#14181F] text-sm shrink-0">
                    {item.member.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[#14181F] truncate">
                        {item.member.name}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-700 font-mono">
                        #{item.member.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-[#5B6470] mt-0.5">
                      {item.member.phone && (
                        <span className="flex items-center gap-1 font-mono dir-ltr">
                          <Phone className="w-3 h-3" />
                          {item.member.phone}
                        </span>
                      )}
                      {item.planName && (
                        <span className="truncate">
                          · {item.planName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Link
                    href={`/members/${item.member.id}`}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#14181F] bg-[#F6F8F5] border border-[#E1E5DF] rounded-lg hover:bg-[#E1E5DF] transition-colors"
                  >
                    <span>{t("classesTimetable.memberDetails")}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Dialog>
  );
}

