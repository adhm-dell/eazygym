"use client";

import React, { useState } from "react";
import { Edit3, AlertCircle, CheckCircle2 } from "lucide-react";
import { membersApi } from "../api";
import type { Member } from "@gym/mock-data";

interface EditMemberDialogProps {
  member: Member;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (updated: Member) => void;
}

export function EditMemberDialog({ member, isOpen, onClose, onSuccess }: EditMemberDialogProps) {
  const [name, setName] = useState(member.name);
  const [phone, setPhone] = useState(member.phone);
  const [email, setEmail] = useState(member.email || "");
  const [gender, setGender] = useState<"MALE" | "FEMALE">(member.gender === "FEMALE" ? "FEMALE" : "MALE");
  const [birthDate, setBirthDate] = useState(member.birthDate ? member.birthDate.slice(0, 10) : "");
  const [notes, setNotes] = useState(member.notes || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("الاسم مطلوب");
      return;
    }
    if (!phone.trim()) {
      setError("رقم الهاتف مطلوب");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await membersApi.updateMember(member.id, {
        name: name.trim(),
        phone: phone.trim(),
        email: email.trim() || undefined,
        gender,
        birthDate: birthDate || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess(updated);
      onClose();
    } catch (err: any) {
      setError(err?.message || "حدث خطأ أثناء تعديل البيانات");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]"
        dir="rtl"
      >
        <div className="p-5 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gray-900 text-white flex items-center justify-center font-bold">
              <Edit3 className="h-5 w-5 text-[#C6F24E]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">تعديل بيانات العضو</h2>
              <p className="text-xs text-gray-500">كود العضو: {member.code}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-lg font-bold p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                الاسم بالكامل <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                رقم الموبايل <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">البريد الإلكتروني</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">النوع / الجنس</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setGender("MALE")}
                  className={`py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                    gender === "MALE"
                      ? "border-black bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  ذكر
                </button>
                <button
                  type="button"
                  onClick={() => setGender("FEMALE")}
                  className={`py-2 px-3 rounded-xl border text-sm font-medium transition-colors ${
                    gender === "FEMALE"
                      ? "border-black bg-gray-900 text-white"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  أنثى
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">تاريخ الميلاد</label>
            <input
              type="date"
              value={birthDate}
              onChange={(e) => setBirthDate(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">الملاحظات</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#C6F24E] focus:border-black"
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl bg-gray-900 hover:bg-black text-white text-sm font-bold shadow-sm transition-colors flex items-center gap-2"
            >
              {isSubmitting ? (
                <span>جاري الحفظ...</span>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-[#C6F24E]" />
                  <span>حفظ التعديلات</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
