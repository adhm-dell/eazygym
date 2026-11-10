"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Globe,
  Plus,
  RefreshCw,
  Building2,
  Users,
  CreditCard,
  CheckCircle2,
  XCircle,
  Power,
  ShieldAlert,
  Calendar,
  Lock,
  Mail,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { Button, Badge, Dialog, useToast } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import { platformApi, type PlatformGym, type CreateGymDto } from "../../../features/platform/api";
import { useShift } from "../../../lib/shift-context";

export default function PlatformAdminPage() {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const { toast } = useToast();
  const { currentUser } = useShift();

  const [gyms, setGyms] = useState<PlatformGym[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create Gym Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [timezone, setTimezone] = useState("Africa/Cairo");
  const [adminName, setAdminName] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchGyms = async () => {
    setIsLoading(true);
    try {
      const data = await platformApi.listGyms();
      setGyms(data);
    } catch (err: any) {
      toast({
        title: "تعذر تحميل قائمة الفروع",
        description: err?.message || "حدث خطأ أثناء الاتصال بالخادم",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchGyms();
  }, []);

  const handleToggleGymStatus = async (gym: PlatformGym) => {
    try {
      await platformApi.toggleGymStatus(gym.id, !gym.isActive);
      toast({
        title: !gym.isActive ? "تم تفعيل الجيم" : "تم تعطيل الجيم",
        description: `فرع ${gym.name} أصبح الآن ${!gym.isActive ? "نشطاً" : "معطلاً"}`,
        variant: "success",
      });
      fetchGyms();
    } catch (err: any) {
      toast({
        title: "تعذر تغيير حالة الفرع",
        description: err?.message || "حدث خطأ أثناء حفظ التغيير",
        variant: "error",
      });
    }
  };

  const handleCreateGym = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim() || !slug.trim() || !adminName.trim() || !adminEmail.trim()) {
      setModalError("جميع الحقول الإلزامية مطلوبة");
      return;
    }
    if (!adminPassword.trim() || adminPassword.trim().length < 10) {
      setModalError("كلمة مرور مسؤول الفرع مطلوبة وتتكون من 10 أحرف على الأقل");
      return;
    }

    setIsSubmitting(true);
    try {
      const dto: CreateGymDto = {
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        timezone,
        admin: {
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          password: adminPassword.trim() || undefined,
        },
      };

      await platformApi.createGym(dto);
      toast({
        title: t("platformAdmin.saveSuccess"),
        description: `تم إنشاء فرع ${name} وحساب المسؤول بنجاح`,
        variant: "success",
      });
      setIsDialogOpen(false);
      setName("");
      setSlug("");
      setAdminName("");
      setAdminEmail("");
      setAdminPassword("");
      fetchGyms();
    } catch (err: any) {
      if (err?.code === "SLUG_EXISTS") {
        setModalError("المعرف المختصر (Slug) مستخدم بالفعل لنادٍ آخر");
      } else if (err?.code === "EMAIL_EXISTS") {
        setModalError("البريد الإلكتروني للمسؤول مسجل بالفعل");
      } else {
        setModalError(err?.message || "حدث خطأ أثناء إنشاء الفرع");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stats calculation
  const totalGyms = gyms.length;
  const activeGyms = gyms.filter((g) => g.isActive).length;
  const totalMembers = gyms.reduce((sum, g) => sum + (g.membersCount || 0), 0);
  const totalStaff = gyms.reduce((sum, g) => sum + (g.staffCount || 0), 0);

  // Role check guard (SUPER_ADMIN only)
  const isSuperAdmin = currentUser?.role === "SUPER_ADMIN";

  if (currentUser && !isSuperAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 pt-16" dir={isRtl ? "rtl" : "ltr"}>
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl space-y-3 shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
          <h2 className="text-lg font-black text-red-900">
            {isRtl ? "غير مصرح بالدخول" : "Unauthorized Access"}
          </h2>
          <p className="text-xs text-red-700 leading-relaxed font-medium">
            {isRtl
              ? "صفحة إدارة المنصة والنوادي مخصصة لمالك المنصة فقط (SUPER_ADMIN)."
              : "Platform administration and gym creation is restricted to platform owners (SUPER_ADMIN)."}
          </p>
          <div className="pt-2">
            <Link href="/">
              <Button variant="outline" size="sm" className="text-xs font-bold border-red-300 hover:bg-red-100">
                {isRtl ? "العودة لشاشة الدخول الرئيسية" : "Return to Home"}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#E1E5DF]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl md:text-3xl font-black text-[#14181F]">
              {t("platformAdmin.title")}
            </h1>
            <Badge variant="lime" className="font-mono text-xs">
              SUPER_ADMIN
            </Badge>
          </div>
          <p className="text-sm text-[#5B6470] mt-1">{t("platformAdmin.description")}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchGyms}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </Button>

          <Button
            variant="lime"
            onClick={() => {
              setModalError(null);
              setIsDialogOpen(true);
            }}
            className="font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t("platformAdmin.createGym")}</span>
          </Button>
        </div>
      </div>

      {/* Top KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl shadow-xs">
          <p className="text-xs text-[#5B6470] font-medium">{t("platformAdmin.totalGyms")}</p>
          <p className="text-2xl font-black text-[#14181F] mt-1">{totalGyms}</p>
        </div>

        <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl shadow-xs">
          <p className="text-xs text-[#5B6470] font-medium">{t("platformAdmin.activeGyms")}</p>
          <p className="text-2xl font-black text-emerald-600 mt-1">{activeGyms}</p>
        </div>

        <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl shadow-xs">
          <p className="text-xs text-[#5B6470] font-medium">{t("platformAdmin.totalMembers")}</p>
          <p className="text-2xl font-black text-[#14181F] mt-1">{totalMembers}</p>
        </div>

        <div className="p-4 bg-white border border-[#E1E5DF] rounded-2xl shadow-xs">
          <p className="text-xs text-[#5B6470] font-medium">{t("platformAdmin.totalStaff")}</p>
          <p className="text-2xl font-black text-[#14181F] mt-1">{totalStaff}</p>
        </div>
      </div>

      {/* Gyms Table */}
      <div className="bg-white border border-[#E1E5DF] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead className="bg-[#F6F8F5] border-b border-[#E1E5DF] text-[#5B6470] font-bold">
              <tr>
                <th className="p-3.5 text-start">{t("platformAdmin.gymName")}</th>
                <th className="p-3.5 text-start">{t("platformAdmin.slug")}</th>
                <th className="p-3.5 text-start">{t("platformAdmin.timezone")}</th>
                <th className="p-3.5 text-center">{t("platformAdmin.members")}</th>
                <th className="p-3.5 text-center">{t("platformAdmin.staff")}</th>
                <th className="p-3.5 text-center">{t("platformAdmin.subscriptions")}</th>
                <th className="p-3.5 text-start">{t("platformAdmin.status")}</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E5DF]">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#5B6470]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#4D6B00] mb-2" />
                    <span>جاري تحميل فروع المنصة...</span>
                  </td>
                </tr>
              ) : gyms.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-16 text-center text-[#5B6470]">
                    <Building2 className="w-10 h-10 mx-auto text-[#5B6470]/40 mb-2" />
                    <p className="font-bold text-sm text-[#14181F]">لا توجد فروع مسجلة</p>
                  </td>
                </tr>
              ) : (
                gyms.map((g) => (
                  <tr
                    key={g.id}
                    className={`hover:bg-[#F6F8F5]/60 transition-colors ${
                      !g.isActive ? "opacity-60 bg-gray-50/50" : ""
                    }`}
                  >
                    <td className="p-3.5 font-bold text-[#14181F] text-sm">{g.name}</td>
                    <td className="p-3.5 font-mono text-[11px] text-[#5B6470]">
                      <span className="px-2 py-0.5 rounded bg-gray-100 font-mono">
                        {g.slug}
                      </span>
                    </td>
                    <td className="p-3.5 font-mono text-[11px] text-[#5B6470]">{g.timezone}</td>
                    <td className="p-3.5 text-center font-bold font-mono">{g.membersCount}</td>
                    <td className="p-3.5 text-center font-bold font-mono">{g.staffCount}</td>
                    <td className="p-3.5 text-center font-bold font-mono">{g.subscriptionsCount}</td>
                    <td className="p-3.5">
                      <Badge variant={g.isActive ? "g" : "default"} className="font-bold text-[11px]">
                        {g.isActive ? "نشط" : "معطل"}
                      </Badge>
                    </td>
                    <td className="p-3.5 text-center">
                      <button
                        type="button"
                        onClick={() => handleToggleGymStatus(g)}
                        className={`px-3 py-1 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1 mx-auto ${
                          g.isActive
                            ? "border-red-200 text-red-600 hover:bg-red-50"
                            : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                        }`}
                        title={g.isActive ? "تعطيل الجيم" : "تفعيل الجيم"}
                      >
                        <Power className="w-3.5 h-3.5" />
                        <span>{g.isActive ? "تعطيل" : "تفعيل"}</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE GYM DIALOG */}
      {isDialogOpen && (
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#C6F24E]/20 text-[#14181F]">
                <Building2 className="w-5 h-5 text-[#4D6B00]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#14181F]">
                  {t("platformAdmin.createGym")}
                </h3>
              </div>
            </div>
          }
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <Button
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={isSubmitting}
              >
                إلغاء
              </Button>
              <Button
                variant="lime"
                onClick={handleCreateGym}
                disabled={isSubmitting}
                className="font-bold"
              >
                {isSubmitting ? "جاري الإنشاء..." : "إنشاء الجيم والمسؤول"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleCreateGym} className="space-y-4 text-xs">
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#14181F] block mb-1">
                  {t("platformAdmin.gymName")} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slug) {
                      setSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, "-")
                          .replace(/-+/g, "-")
                      );
                    }
                  }}
                  placeholder="مثلاً: Power Core - التجمع"
                  className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs"
                />
              </div>

              <div>
                <label className="font-bold text-[#14181F] block mb-1">
                  {t("platformAdmin.slug")} *
                </label>
                <input
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="gym-branch-slug"
                  className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-[#14181F] block mb-1">
                {t("platformAdmin.timezone")}
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs"
              >
                <option value="Africa/Cairo">Africa/Cairo (توقيت القاهرة)</option>
                <option value="Asia/Riyadh">Asia/Riyadh (توقيت الرياض)</option>
                <option value="Asia/Dubai">Asia/Dubai (توقيت دبي)</option>
              </select>
            </div>

            {/* First Admin details */}
            <div className="pt-3 border-t border-[#E1E5DF] space-y-3">
              <h4 className="font-bold text-xs text-[#14181F] flex items-center gap-1.5">
                <UserCheck className="w-4 h-4 text-[#4D6B00]" />
                <span>{t("platformAdmin.firstAdminTitle")}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-[#14181F] block mb-1">
                    {t("platformAdmin.adminName")} *
                  </label>
                  <input
                    type="text"
                    required
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                    placeholder="اسم مدير الفرع"
                    className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-[#14181F] block mb-1">
                    {t("platformAdmin.adminEmail")} *
                  </label>
                  <input
                    type="email"
                    required
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                    placeholder="admin@branch.gym"
                    className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-[#14181F] block mb-1">
                  {t("platformAdmin.adminPassword")} *
                </label>
                <input
                  type="password"
                  required
                  minLength={10}
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="كلمة المرور (10 أحرف على الأقل)"
                  className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs font-mono"
                />
              </div>
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

