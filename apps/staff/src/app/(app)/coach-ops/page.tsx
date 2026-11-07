"use client";

import React, { useState } from "react";
import { ShiftsBoard } from "../../../features/coach-ops/components/shifts-board";
import { BreaksBoard } from "../../../features/coach-ops/components/breaks-board";
import { RotationQueueBoard } from "../../../features/coach-ops/components/rotation-queue-board";
import { SessionsBoard } from "../../../features/coach-ops/components/sessions-board";
import { Clock, Coffee, Users, Calendar } from "lucide-react";

export default function CoachOpsPage() {
  const [activeTab, setActiveTab] = useState<"shifts" | "breaks" | "rotation" | "sessions">("shifts");

  return (
    <div className="space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-black text-[#14181F] tracking-tight">
          إدارة عمليات المدربين (Coach Operations)
        </h1>
        <p className="text-xs text-[#5B6470] mt-1 font-medium">
          متابعة ورديات المدربين، وإدارة الاستراحات الفورية، وطابور الدور لتكليف الأعضاء الجدد، وجدول الجلسات التدريبية
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E1E5DF] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab("shifts")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "shifts"
              ? "bg-[#14181F] text-[#C6F24E] shadow-sm"
              : "bg-white text-[#5B6470] hover:text-[#14181F] border border-[#E1E5DF]"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>جدول الورديات</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("breaks")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "breaks"
              ? "bg-[#14181F] text-[#C6F24E] shadow-sm"
              : "bg-white text-[#5B6470] hover:text-[#14181F] border border-[#E1E5DF]"
          }`}
        >
          <Coffee className="h-4 w-4" />
          <span>لوحة الاستراحات الحية</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("rotation")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "rotation"
              ? "bg-[#14181F] text-[#C6F24E] shadow-sm"
              : "bg-white text-[#5B6470] hover:text-[#14181F] border border-[#E1E5DF]"
          }`}
        >
          <Users className="h-4 w-4" />
          <span>دور المدربين وتكليف الأعضاء</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("sessions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === "sessions"
              ? "bg-[#14181F] text-[#C6F24E] shadow-sm"
              : "bg-white text-[#5B6470] hover:text-[#14181F] border border-[#E1E5DF]"
          }`}
        >
          <Calendar className="h-4 w-4" />
          <span>جدول الجلسات والحضور</span>
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === "shifts" && <ShiftsBoard />}
        {activeTab === "breaks" && <BreaksBoard />}
        {activeTab === "rotation" && <RotationQueueBoard />}
        {activeTab === "sessions" && <SessionsBoard />}
      </div>
    </div>
  );
}

