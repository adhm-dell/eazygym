"use client";

import React, { useEffect, useState, useMemo } from "react";
import {
  Users,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Power,
  Shield,
  ShieldAlert,
  UserCheck,
  DollarSign,
  Mail,
  Phone,
  Lock,
  AlertCircle,
} from "lucide-react";
import { Button, Badge, Dialog, useToast } from "@gym/ui";
import { useTranslation } from "@gym/i18n";
import Link from "next/link";
import { formatMoney } from "../../../lib/money";
import { staffApi, type StaffMember } from "../../../features/staff/api";
import { useShift } from "../../../lib/shift-context";
import type { StaffRole, CreateStaffDto, UpdateStaffDto } from "@gym/contracts";

export default function StaffManagementPage() {
  const { t, locale } = useTranslation();
  const isRtl = locale === "ar";
  const { toast } = useToast();
  const { currentUser } = useShift();
  const isAdmin =
    currentUser?.role === "GYM_ADMIN" || currentUser?.role === "SUPER_ADMIN";

  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");

  // Modal State
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState<StaffRole>("RECEPTION");
  const [baseSalaryEgp, setBaseSalaryEgp] = useState<string>("4000");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const fetchStaff = async () => {
    setIsLoading(true);
    try {
      const data = await staffApi.listStaff();
      setStaffList(data);
    } catch (err: any) {
      toast({
        title: "تعذر تحميل قائمة الموظفين",
        description: err?.message || "حدث خطأ أثناء الاتصال بالخادم",
        variant: "error",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStaff();
  }, []);

  const openCreateDialog = () => {
    setEditingStaff(null);
    setName("");
    setEmail("");
    setPhone("");
    setRole("RECEPTION");
    setBaseSalaryEgp("4000");
    setPassword("");
    setModalError(null);
    setIsDialogOpen(true);
  };

  const openEditDialog = (staff: StaffMember) => {
    setEditingStaff(staff);
    setName(staff.name);
    setEmail(staff.email);
    setPhone(staff.phone || "");
    setRole(staff.role);
    setBaseSalaryEgp((staff.baseSalary / 100).toString());
    setPassword("");
    setModalError(null);
    setIsDialogOpen(true);
  };

  const handleSaveStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!name.trim()) {
      setModalError("اسم الموظف مطلوب");
      return;
    }
    if (!editingStaff && !email.trim()) {
      setModalError("البريد الإلكتروني مطلوب");
      return;
    }

    const salaryPiasters = Math.round(parseFloat(baseSalaryEgp || "0") * 100);

    setIsSubmitting(true);
    try {
      if (editingStaff) {
        const dto: UpdateStaffDto = {
          name: name.trim(),
          phone: phone.trim() || undefined,
          role,
          baseSalary: salaryPiasters >= 0 ? salaryPiasters : undefined,
          password: password.trim() ? password.trim() : undefined,
        };
        await staffApi.updateStaff(editingStaff.id, dto);
        toast({
          title: t("staffManagement.saveSuccess"),
          description: `تم تحديث بيانات الموظف ${name}`,
          variant: "success",
        });
      } else {
        const dto: CreateStaffDto = {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim() || undefined,
          role,
          baseSalary: salaryPiasters >= 0 ? salaryPiasters : 0,
          password: password.trim() || undefined,
        };
        await staffApi.createStaff(dto);
        toast({
          title: t("staffManagement.saveSuccess"),
          description: `تم إنشاء حساب الموظف ${name}`,
          variant: "success",
        });
      }
      setIsDialogOpen(false);
      fetchStaff();
    } catch (err: any) {
      if (err?.code === "LAST_ADMIN" || err?.message?.includes("last admin") || err?.message?.includes("LAST_ADMIN")) {
        setModalError(t("staffManagement.lastAdminError"));
      } else if (err?.code === "EMAIL_EXISTS") {
        setModalError("البريد الإلكتروني مسجل بالفعل لموظف آخر");
      } else {
        setModalError(err?.message || "حدث خطأ أثناء حفظ بيانات الموظف");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (staff: StaffMember) => {
    try {
      const updated = await staffApi.updateStaff(staff.id, {
        isActive: !staff.isActive,
      });
      toast({
        title: updated.isActive ? "تم تفعيل حساب الموظف" : "تم تعطيل حساب الموظف",
        description: `أصبح حساب ${staff.name} ${updated.isActive ? "نشطاً" : "معطلاً"}`,
        variant: "success",
      });
      fetchStaff();
    } catch (err: any) {
      if (err?.code === "LAST_ADMIN" || err?.message?.includes("LAST_ADMIN") || err?.message?.includes("last admin")) {
        toast({
          title: "تعذر تعطيل الحساب",
          description: t("staffManagement.lastAdminError"),
          variant: "error",
        });
      } else {
        toast({
          title: "تعذر تحديث حالة الحساب",
          description: err?.message || "حدث خطأ غير متوقع",
          variant: "error",
        });
      }
    }
  };

  const filteredStaff = useMemo(() => {
    return staffList.filter((s) => {
      if (roleFilter !== "ALL" && s.role !== roleFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        return (
          s.name.toLowerCase().includes(q) ||
          s.email.toLowerCase().includes(q) ||
          (s.phone && s.phone.includes(q))
        );
      }
      return true;
    });
  }, [staffList, roleFilter, search]);

  if (currentUser && !isAdmin) {
    return (
      <div className="p-8 max-w-lg mx-auto text-center space-y-4 pt-16" dir={isRtl ? "rtl" : "ltr"}>
        <div className="p-8 bg-red-50 border border-red-200 rounded-3xl space-y-3 shadow-sm">
          <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
          <h2 className="text-lg font-black text-red-900">
            {isRtl ? "غير مصرح بالدخول" : "Unauthorized Access"}
          </h2>
          <p className="text-xs text-red-700 leading-relaxed font-medium">
            {isRtl
              ? "صفحة إدارة حسابات الموظفين والرواتب مخصصة لمدير النادي فقط (GYM_ADMIN / SUPER_ADMIN)."
              : "Staff management and payroll configuration is restricted to administrators."}
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
              {t("staffManagement.title")}
            </h1>
            <Badge variant="lime" className="font-mono text-xs">
              {staffList.length} موظف
            </Badge>
          </div>
          <p className="text-sm text-[#5B6470] mt-1">{t("staffManagement.description")}</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchStaff}
            disabled={isLoading}
            className="flex items-center gap-1.5"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            <span>تحديث</span>
          </Button>

          <Button
            variant="lime"
            onClick={openCreateDialog}
            className="font-bold flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>{t("staffManagement.createStaff")}</span>
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-[#5B6470]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو البريد أو الهاتف..."
            className="w-full h-10 ps-9 pe-3 text-xs bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 px-3 text-xs bg-white border border-[#E1E5DF] rounded-xl focus:outline-none focus:ring-2 focus:ring-[#C6F24E]"
          >
            <option value="ALL">كل الأدوار الوظيفية</option>
            <option value="GYM_ADMIN">{t("staffManagement.roles.GYM_ADMIN")}</option>
            <option value="RECEPTION">{t("staffManagement.roles.RECEPTION")}</option>
            <option value="COACH">{t("staffManagement.roles.COACH")}</option>
            <option value="BAR_CASHIER">{t("staffManagement.roles.BAR_CASHIER")}</option>
          </select>
        </div>
      </div>

      {/* Staff Table */}
      <div className="bg-white border border-[#E1E5DF] rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-xs border-collapse">
            <thead className="bg-[#F6F8F5] border-b border-[#E1E5DF] text-[#5B6470] font-bold">
              <tr>
                <th className="p-3.5 text-start">{t("staffManagement.name")}</th>
                <th className="p-3.5 text-start">{t("staffManagement.email")}</th>
                <th className="p-3.5 text-start">{t("staffManagement.role")}</th>
                <th className="p-3.5 text-start">{t("staffManagement.baseSalary")}</th>
                <th className="p-3.5 text-start">{t("staffManagement.status")}</th>
                <th className="p-3.5 text-start">{t("staffManagement.lastLogin")}</th>
                <th className="p-3.5 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E1E5DF]">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#5B6470]">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#4D6B00] mb-2" />
                    <span>جاري تحميل بيانات الموظفين...</span>
                  </td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-[#5B6470]">
                    <Users className="w-10 h-10 mx-auto text-[#5B6470]/40 mb-2" />
                    <p className="font-bold text-sm text-[#14181F]">لم يتم العثور على موظفين</p>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((staff) => (
                  <tr
                    key={staff.id}
                    className={`hover:bg-[#F6F8F5]/60 transition-colors ${
                      !staff.isActive ? "opacity-60 bg-gray-50/50" : ""
                    }`}
                  >
                    <td className="p-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-full bg-[#14181F] text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {staff.name.charAt(0)}
                        </div>
                        <div>
                          <span className="font-bold text-[#14181F] block">{staff.name}</span>
                          {staff.phone && (
                            <span className="text-[11px] text-[#5B6470] font-mono dir-ltr">
                              {staff.phone}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 font-mono text-[11px] text-[#5B6470]">{staff.email}</td>

                    <td className="p-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-full font-bold text-[10px] ${
                          staff.role === "GYM_ADMIN"
                            ? "bg-purple-100 text-purple-800"
                            : staff.role === "COACH"
                            ? "bg-amber-100 text-amber-800"
                            : staff.role === "RECEPTION"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-blue-100 text-blue-800"
                        }`}
                      >
                        {t(`staffManagement.roles.${staff.role}`)}
                      </span>
                    </td>

                    <td className="p-3.5 font-bold text-[#14181F]">
                      {formatMoney(staff.baseSalary)}
                    </td>

                    <td className="p-3.5">
                      <Badge variant={staff.isActive ? "g" : "default"} className="font-bold text-[11px]">
                        {staff.isActive ? t("staffManagement.active") : t("staffManagement.inactive")}
                      </Badge>
                    </td>

                    <td className="p-3.5 text-[#5B6470] font-mono text-[11px]">
                      {staff.lastLoginAt
                        ? new Date(staff.lastLoginAt).toLocaleDateString("ar-EG")
                        : "لم يدخل بعد"}
                    </td>

                    <td className="p-3.5 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openEditDialog(staff)}
                          className="p-1.5 rounded-lg border border-[#E1E5DF] hover:bg-[#F6F8F5] text-[#5B6470] hover:text-[#14181F] transition-colors"
                          title="تعديل الموظف"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleToggleActive(staff)}
                          className={`p-1.5 rounded-lg border transition-colors ${
                            staff.isActive
                              ? "border-red-200 text-red-600 hover:bg-red-50"
                              : "border-emerald-200 text-emerald-600 hover:bg-emerald-50"
                          }`}
                          title={staff.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                        >
                          <Power className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE / EDIT STAFF DIALOG */}
      {isDialogOpen && (
        <Dialog
          isOpen={isDialogOpen}
          onClose={() => setIsDialogOpen(false)}
          title={
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-[#C6F24E]/20 text-[#14181F]">
                <Users className="w-5 h-5 text-[#4D6B00]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#14181F]">
                  {editingStaff
                    ? t("staffManagement.editStaff")
                    : t("staffManagement.createStaff")}
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
                onClick={handleSaveStaff}
                disabled={isSubmitting}
                className="font-bold"
              >
                {isSubmitting ? "جاري الحفظ..." : "حفظ الموظف"}
              </Button>
            </div>
          }
        >
          <form onSubmit={handleSaveStaff} className="space-y-4 text-xs">
            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{modalError}</span>
              </div>
            )}

            <div>
              <label className="font-bold text-[#14181F] block mb-1">
                {t("staffManagement.name")} *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثلاً: أحمد محمود"
                className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#14181F] block mb-1">
                  {t("staffManagement.email")} *
                </label>
                <input
                  type="email"
                  required
                  disabled={Boolean(editingStaff)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@powercore.gym"
                  className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs font-mono disabled:opacity-60 disabled:bg-gray-50"
                />
              </div>

              <div>
                <label className="font-bold text-[#14181F] block mb-1">
                  {t("staffManagement.phone")}
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                  className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="font-bold text-[#14181F] block mb-1">
                  {t("staffManagement.role")} *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as StaffRole)}
                  className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs"
                >
                  <option value="RECEPTION">{t("staffManagement.roles.RECEPTION")}</option>
                  <option value="COACH">{t("staffManagement.roles.COACH")}</option>
                  <option value="BAR_CASHIER">{t("staffManagement.roles.BAR_CASHIER")}</option>
                  <option value="GYM_ADMIN">{t("staffManagement.roles.GYM_ADMIN")}</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-[#14181F] block mb-1">
                  {t("staffManagement.baseSalary")}
                </label>
                <input
                  type="number"
                  min="0"
                  value={baseSalaryEgp}
                  onChange={(e) => setBaseSalaryEgp(e.target.value)}
                  placeholder="4000"
                  className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs font-bold"
                />
              </div>
            </div>

            <div>
              <label className="font-bold text-[#14181F] block mb-1">
                {t("staffManagement.password")}
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("staffManagement.passwordPlaceholder")}
                className="w-full h-10 px-3 bg-white border border-[#E1E5DF] rounded-xl text-xs font-mono"
              />
            </div>
          </form>
        </Dialog>
      )}
    </div>
  );
}

