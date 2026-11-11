"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { membersApi } from "../../../../features/members/api";
import { formatMoney } from "../../../../lib/money";
import { MemberFitnessTab } from "../../../../features/members/components/member-fitness-tab";
import { FreezeDialog } from "../../../../features/members/components/freeze-dialog";
import { UnfreezeDialog } from "../../../../features/members/components/unfreeze-dialog";
import { BlockMemberDialog } from "../../../../features/members/components/block-member-dialog";
import { EditMemberDialog } from "../../../../features/members/components/edit-member-dialog";
import { ChangeCoachDialog } from "../../../../features/members/components/change-coach-dialog";
import { ChangeClassSlotDialog } from "../../../../features/members/components/change-class-slot-dialog";
import { LogSessionDialog } from "../../../../features/members/components/log-session-dialog";
import { CancelSubscriptionDialog } from "../../../../features/members/components/cancel-subscription-dialog";
import { Button, Badge, useToast } from "@gym/ui";
import {
  ArrowRight,
  User,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Snowflake,
  ShieldAlert,
  ShieldCheck,
  ShoppingCart,
  Dumbbell,
  Play,
  RotateCcw,
  Sparkles,
  Layers,
  Clock,
  Edit3,
  XCircle,
  HelpCircle,
} from "lucide-react";

export default function MemberProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const memberId = params?.id as string;

  const [member, setMember] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"subscriptions" | "fitness" | "wallet">("subscriptions");

  // Selected subscription for action dialogs
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [isFreezeOpen, setIsFreezeOpen] = useState(false);
  const [isUnfreezeOpen, setIsUnfreezeOpen] = useState(false);
  const [isChangeCoachOpen, setIsChangeCoachOpen] = useState(false);
  const [isChangeSlotOpen, setIsChangeSlotOpen] = useState(false);
  const [isLogSessionOpen, setIsLogSessionOpen] = useState(false);
  const [isCancelSubOpen, setIsCancelSubOpen] = useState(false);

  // Member modals
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isBlockOpen, setIsBlockOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!memberId) return;
    setIsLoading(true);
    try {
      const data = await membersApi.getMemberById(memberId);
      setMember(data);
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message || "تعذر تحميل بيانات العضو",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }, [memberId, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (isLoading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center" dir="rtl">
        <div className="h-8 w-8 rounded-full border-2 border-[#14181F] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (!member) {
    return (
      <div className="p-8 text-center space-y-4 max-w-md mx-auto mt-20 bg-white border border-[#E1E5DF] rounded-2xl" dir="rtl">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-[#14181F]">العضو غير موجود</h2>
        <p className="text-xs text-[#5B6470]">لم يتم العثور على العضو المطلوب أو تم حذفه</p>
        <Link href="/members">
          <Button variant="default" size="sm">
            <span>العودة لقائمة الأعضاء</span>
          </Button>
        </Link>
      </div>
    );
  }

  const subscriptions: any[] = member.subscriptions || [];
  const now = new Date();

  // Active / Future subscriptions
  const activeSubs = subscriptions.filter((s) => s.status !== "CANCELLED" && new Date(s.endDate) > now);
  const hasMultipleActive = activeSubs.length > 1;
  const hasFutureRenewal = subscriptions.some((s) => s.status !== "CANCELLED" && new Date(s.startDate) > now);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12" dir="rtl">
      {/* Top Breadcrumb & Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/members"
            className="p-2 rounded-xl border border-[#E1E5DF] bg-white text-[#5B6470] hover:text-[#14181F] transition-colors"
            title="العودة لقائمة الأعضاء"
          >
            <ArrowRight className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-black text-[#14181F] tracking-tight">{member.name}</h1>
              <span className="font-mono text-xs bg-[#14181F] text-[#C6F24E] px-2 py-0.5 rounded-md font-bold">
                {member.code}
              </span>
              {member.isBlocked && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                  <ShieldAlert className="h-3 w-3" />
                  محظور إدارياً
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 text-xs text-[#5B6470] mt-1 font-medium">
              <span className="flex items-center gap-1 font-mono">
                <Phone className="h-3.5 w-3.5" />
                {member.phone}
              </span>
              {member.email && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Mail className="h-3.5 w-3.5" />
                    {member.email}
                  </span>
                </>
              )}
              {member.gender && (
                <>
                  <span>·</span>
                  <span>{member.gender === "FEMALE" ? "أنثى" : "ذكر"}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {member.remainingBalance > 0 && (
            <Link href={`/pos?memberId=${member.id}`}>
              <Button variant="destructive" size="sm" className="font-bold flex items-center gap-1.5 shadow-sm">
                <CreditCard className="h-4 w-4" />
                <span>تحصيل متبقي ({formatMoney(member.remainingBalance)})</span>
              </Button>
            </Link>
          )}

          <Link href={`/pos?memberId=${member.id}`}>
            <Button variant="lime" size="sm" className="font-bold flex items-center gap-1.5 shadow-sm">
              <ShoppingCart className="h-4 w-4" />
              <span>بيع اشتراك جديد / منتج</span>
            </Button>
          </Link>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditOpen(true)}
            className="flex items-center gap-1.5"
          >
            <Edit3 className="h-4 w-4" />
            <span>تعديل البيانات</span>
          </Button>

          <Button
            variant={member.isBlocked ? "outline" : "destructive"}
            size="sm"
            onClick={() => setIsBlockOpen(true)}
            className="flex items-center gap-1.5"
          >
            {member.isBlocked ? (
              <>
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span>إلغاء الحظر</span>
              </>
            ) : (
              <>
                <ShieldAlert className="h-4 w-4" />
                <span>حظر العضو</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Blocked Alert Banner if applicable */}
      {member.isBlocked && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-red-600 shrink-0" />
            <span>
              <b>العضو محظور من دخول الصالة:</b> {member.blockedReason || "تم الحظر بواسطة الإدارة"}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsBlockOpen(true)}
            className="text-xs bg-white text-red-700 hover:bg-red-100"
          >
            رفع الحظر الآن
          </Button>
        </div>
      )}

      {/* Key Financial & Access KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Wallet Balance */}
        <div className="p-4 rounded-2xl bg-white border border-[#E1E5DF] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-[#5B6470] font-medium">رصيد المحفظة</p>
            <p className="text-xl font-black text-[#14181F] mt-1 font-mono">
              {formatMoney(member.walletBalance || 0)}
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold">
            <Wallet className="h-5 w-5" />
          </div>
        </div>

        {/* Outstanding Debt */}
        <div className="p-4 rounded-2xl bg-white border border-[#E1E5DF] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-[#5B6470] font-medium">المديونية المتبقية</p>
            <p className={`text-xl font-black mt-1 font-mono ${member.remainingBalance > 0 ? "text-red-600" : "text-gray-700"}`}>
              {formatMoney(member.remainingBalance || 0)}
            </p>
            {member.remainingBalance > 0 && (
              <Link
                href={`/pos?memberId=${member.id}`}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 mt-1"
              >
                <span>تحصيل المتبقي بالـ POS</span>
                <ArrowRight className="h-3 w-3 rotate-180" />
              </Link>
            )}
          </div>
          <div className="h-10 w-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
            <CreditCard className="h-5 w-5" />
          </div>
        </div>

        {/* Active Subscriptions Count */}
        <div className="p-4 rounded-2xl bg-white border border-[#E1E5DF] shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs text-[#5B6470] font-medium">الاشتراكات النشطة المتزامنة</p>
            <p className="text-xl font-black text-[#14181F] mt-1">
              {activeSubs.length}{" "}
              <span className="text-xs font-normal text-[#5B6470]">
                {activeSubs.length === 1 ? "اشتراك" : "اشتراكات"}
              </span>
            </p>
          </div>
          <div className="h-10 w-10 rounded-xl bg-[#C6F24E]/30 text-[#14181F] flex items-center justify-center font-bold">
            <Layers className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[#E1E5DF] gap-2">
        <button
          type="button"
          onClick={() => setActiveTab("subscriptions")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "subscriptions"
              ? "border-[#14181F] text-[#14181F]"
              : "border-transparent text-[#5B6470] hover:text-[#14181F]"
          }`}
        >
          <CreditCard className="h-4 w-4" />
          <span>الاشتراكات والباقات ({subscriptions.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("fitness")}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 text-xs font-bold transition-all cursor-pointer ${
            activeTab === "fitness"
              ? "border-[#14181F] text-[#14181F]"
              : "border-transparent text-[#5B6470] hover:text-[#14181F]"
          }`}
        >
          <Dumbbell className="h-4 w-4" />
          <span>الملف الرياضي والتقييمات</span>
        </button>
      </div>

      {/* TAB CONTENT: Subscriptions */}
      {activeTab === "subscriptions" && (
        <div className="space-y-4">
          {/* Multiple Active Subscriptions Banner */}
          {hasMultipleActive && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <b className="font-bold text-emerald-950">العضو لديه {activeSubs.length} اشتراكات نشطة في نفس الوقت:</b>
                <p className="mt-0.5 text-emerald-800">
                  يدعم النظام الجمع بين اشتراك الجيم والتدريب الخاص (PT) والحصص الجماعية (Class) معاً، ويتم حساب دخول الصالة والجلسات لكل اشتراك باستقلالية.
                </p>
              </div>
            </div>
          )}

          {/* Early Renewal Scheduled Banner */}
          {hasFutureRenewal && (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-900 text-xs flex items-center gap-3">
              <Clock className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <b className="font-bold text-amber-950">يوجد اشتراك تجديد مسبق مجدول:</b>
                <p className="mt-0.5 text-amber-800">
                  تم شراء تجديد مسبق، وسيبدأ تفعيله وتاريخه تلقائياً فور انتهاء الاشتراك الحالي للعضو مباشرة.
                </p>
              </div>
            </div>
          )}

          {/* Subscriptions List */}
          {subscriptions.length === 0 ? (
            <div className="p-12 text-center bg-white border border-[#E1E5DF] rounded-2xl space-y-3">
              <CreditCard className="h-10 w-10 text-gray-300 mx-auto" />
              <p className="text-sm font-bold text-gray-700">لا يوجد اشتراكات مسجلة لهذا العضو بعد</p>
              <Link href={`/pos?memberId=${member.id}`}>
                <Button variant="lime" size="sm" className="font-bold">
                  <span>شراء أول اشتراك للعضو الآن</span>
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {subscriptions.map((sub: any) => {
                const isPT = sub.kind === "PT";
                const isClass = sub.kind === "CLASS";
                const isGym = sub.kind === "GYM";
                const isFuture = new Date(sub.startDate) > now;
                const isExpired = new Date(sub.endDate) <= now && sub.status !== "CANCELLED";
                const isFrozen = sub.status === "FROZEN";
                const isActive = sub.status === "ACTIVE" && !isFuture && !isExpired;

                return (
                  <div
                    key={sub.id}
                    className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 transition-all ${
                      isFrozen
                        ? "border-blue-200 bg-blue-50/20"
                        : isActive
                        ? "border-[#E1E5DF]"
                        : "border-gray-200 opacity-90"
                    }`}
                  >
                    {/* Header: Plan kind badge + Name + Status */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                            isPT
                              ? "bg-purple-100 text-purple-800"
                              : isClass
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {isPT ? "تدريب شخصي PT" : isClass ? "كلاس لياقة CLASS" : "اشتراك جيم GYM"}
                        </span>
                        <h3 className="font-bold text-[#14181F] text-base">{sub.planName}</h3>
                        {isFuture && (
                          <span className="bg-amber-100 text-amber-800 text-[11px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            تجديد مسبق مجدول
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {isFrozen ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                            <Snowflake className="h-3 w-3" />
                            مجمد (Frozen)
                          </span>
                        ) : sub.status === "CANCELLED" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-600">
                            <XCircle className="h-3 w-3" />
                            ملغي
                          </span>
                        ) : isExpired ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-gray-100 text-gray-500">
                            منتهي الصلاحية
                          </span>
                        ) : sub.status === "PENDING_PAYMENT" ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800">
                            بانتظار السداد
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                            <CheckCircle2 className="h-3 w-3" />
                            نشط (Active)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                      <div>
                        <span className="text-gray-400 block mb-0.5">تاريخ البدء</span>
                        <span className="font-semibold text-gray-800 font-mono">
                          {new Date(sub.startDate).toLocaleDateString("ar-EG")}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-400 block mb-0.5">تاريخ الانتهاء</span>
                        <span className="font-semibold text-gray-800 font-mono">
                          {new Date(sub.endDate).toLocaleDateString("ar-EG")}
                        </span>
                      </div>

                      <div>
                        <span className="text-gray-400 block mb-0.5">سعر الاشتراك</span>
                        <span className="font-semibold text-gray-800 font-mono">
                          {formatMoney(sub.price)}
                        </span>
                      </div>

                      {/* Sessions (PT or CLASS) */}
                      {(isPT || isClass) && (
                        <div>
                          <span className="text-gray-400 block mb-0.5">الجلسات المتبقية</span>
                          <span className="font-bold text-purple-700 font-mono">
                            {sub.sessionsLeft ?? 0} من أصل {sub.totalSessions ?? 0} حصة
                          </span>
                        </div>
                      )}

                      {/* Assigned Coach for PT */}
                      {isPT && (
                        <div>
                          <span className="text-gray-400 block mb-0.5">الكابتن المسؤول</span>
                          <span className="font-bold text-[#14181F]">
                            {sub.activeCoach ? sub.activeCoach.name : "لم يتم التعيين"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons for this specific subscription */}
                    <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-2">
                      {/* Freeze / Unfreeze */}
                      {sub.status === "FROZEN" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSub(sub);
                            setIsUnfreezeOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          <Play className="h-3.5 w-3.5" />
                          <span>إلغاء التجميد واستئناف</span>
                        </Button>
                      ) : sub.status === "ACTIVE" ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSub(sub);
                            setIsFreezeOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-xs text-blue-700 border-blue-200 hover:bg-blue-50"
                        >
                          <Snowflake className="h-3.5 w-3.5" />
                          <span>تجميد الاشتراك (Freeze)</span>
                        </Button>
                      ) : null}

                      {/* PT Specific Actions */}
                      {isPT && sub.status === "ACTIVE" && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSub(sub);
                              setIsLogSessionOpen(true);
                            }}
                            className="flex items-center gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                          >
                            <Dumbbell className="h-3.5 w-3.5" />
                            <span>تسجيل حصة تدريب</span>
                          </Button>

                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedSub(sub);
                              setIsChangeCoachOpen(true);
                            }}
                            className="flex items-center gap-1.5 text-xs text-purple-700 border-purple-200 hover:bg-purple-50"
                          >
                            <RotateCcw className="h-3.5 w-3.5" />
                            <span>نقل / تغيير الكابتن</span>
                          </Button>
                        </>
                      )}

                      {/* Class Specific Actions */}
                      {isClass && sub.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSub(sub);
                            setIsChangeSlotOpen(true);
                          }}
                          className="flex items-center gap-1.5 text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        >
                          <Calendar className="h-3.5 w-3.5" />
                          <span>تعديل الحصة / الموعد المحجوز</span>
                        </Button>
                      )}

                      {/* Cancel Subscription */}
                      {sub.status !== "CANCELLED" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSelectedSub(sub);
                            setIsCancelSubOpen(true);
                          }}
                          className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 ms-auto"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          <span>إلغاء الاشتراك</span>
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: Fitness Profile */}
      {activeTab === "fitness" && (
        <div className="bg-white border border-[#E1E5DF] rounded-2xl p-6 shadow-sm">
          <MemberFitnessTab memberId={member.id} />
        </div>
      )}

      {/* Dialogs */}
      {selectedSub && isFreezeOpen && (
        <FreezeDialog
          subscription={selectedSub}
          member={member}
          isOpen={isFreezeOpen}
          onClose={() => {
            setIsFreezeOpen(false);
            setSelectedSub(null);
          }}
          onSuccess={() => {
            setIsFreezeOpen(false);
            setSelectedSub(null);
            loadData();
          }}
        />
      )}

      {selectedSub && isUnfreezeOpen && (
        <UnfreezeDialog
          subscription={selectedSub}
          member={member}
          isOpen={isUnfreezeOpen}
          onClose={() => {
            setIsUnfreezeOpen(false);
            setSelectedSub(null);
          }}
          onSuccess={() => {
            setIsUnfreezeOpen(false);
            setSelectedSub(null);
            loadData();
          }}
        />
      )}

      {selectedSub && isChangeCoachOpen && (
        <ChangeCoachDialog
          subscription={selectedSub}
          member={member}
          isOpen={isChangeCoachOpen}
          onClose={() => {
            setIsChangeCoachOpen(false);
            setSelectedSub(null);
          }}
          onSuccess={() => {
            setIsChangeCoachOpen(false);
            setSelectedSub(null);
            loadData();
          }}
        />
      )}

      {selectedSub && isChangeSlotOpen && (
        <ChangeClassSlotDialog
          subscription={selectedSub}
          member={member}
          isOpen={isChangeSlotOpen}
          onClose={() => {
            setIsChangeSlotOpen(false);
            setSelectedSub(null);
          }}
          onSuccess={() => {
            setIsChangeSlotOpen(false);
            setSelectedSub(null);
            loadData();
          }}
        />
      )}

      {selectedSub && isLogSessionOpen && (
        <LogSessionDialog
          subscription={selectedSub}
          member={member}
          isOpen={isLogSessionOpen}
          onClose={() => {
            setIsLogSessionOpen(false);
            setSelectedSub(null);
          }}
          onSuccess={() => {
            setIsLogSessionOpen(false);
            setSelectedSub(null);
            loadData();
          }}
        />
      )}

      {selectedSub && isCancelSubOpen && (
        <CancelSubscriptionDialog
          subscription={selectedSub}
          member={member}
          isOpen={isCancelSubOpen}
          onClose={() => {
            setIsCancelSubOpen(false);
            setSelectedSub(null);
          }}
          onSuccess={() => {
            setIsCancelSubOpen(false);
            setSelectedSub(null);
            loadData();
          }}
        />
      )}

      {isEditOpen && (
        <EditMemberDialog
          member={member}
          isOpen={isEditOpen}
          onClose={() => setIsEditOpen(false)}
          onSuccess={() => {
            setIsEditOpen(false);
            loadData();
          }}
        />
      )}

      {isBlockOpen && (
        <BlockMemberDialog
          member={member}
          isOpen={isBlockOpen}
          onClose={() => setIsBlockOpen(false)}
          onSuccess={() => {
            setIsBlockOpen(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
