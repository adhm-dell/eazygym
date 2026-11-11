"use client";

import React, { useState, useEffect } from "react";
import { coachOpsApi, type CoachSessionItem } from "../api";
import { Button, Input, useToast } from "@gym/ui";
import { Calendar, Plus, Check, X, Users, UserCheck, AlertCircle } from "lucide-react";

export function SessionsBoard() {
  const { toast } = useToast();
  const [sessions, setSessions] = useState<CoachSessionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Create session modal state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [coachId, setCoachId] = useState("staff_coach");
  const [type, setType] = useState<"PRIVATE" | "GROUP">("PRIVATE");
  const [startTime, setStartTime] = useState("2026-11-20T10:00");
  const [endTime, setEndTime] = useState("2026-11-20T11:00");
  const [capacity, setCapacity] = useState(10);
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Add participant modal state
  const [selectedSessionForAdd, setSelectedSessionForAdd] = useState<CoachSessionItem | null>(null);
  const [participantMemberId, setParticipantMemberId] = useState("");
  const [participantSource, setParticipantSource] = useState<"PT_LINKED" | "FREE_GRANT" | "CLASS_LINKED">("PT_LINKED");
  const [isAddingPart, setIsAddingPart] = useState(false);

  // Attendance modal state
  const [selectedSessionForAtt, setSelectedSessionForAtt] = useState<CoachSessionItem | null>(null);
  const [attendedMemberIds, setAttendedMemberIds] = useState<string[]>([]);
  const [isSavingAtt, setIsSavingAtt] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const data = await coachOpsApi.getSessions();
      setSessions(data || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await coachOpsApi.createSession({
        coachId,
        type,
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        capacity: type === "GROUP" ? capacity : null,
        notes,
      });
      toast({
        title: "تم جدولة الجلسة بنجاح",
        description: `جلسة تدريب ${type === "PRIVATE" ? "خاصة (PT)" : "جماعية"} للمدرب`,
        variant: "success",
      });
      setIsCreateOpen(false);
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSessionForAdd || !participantMemberId) return;
    setIsAddingPart(true);
    try {
      await coachOpsApi.addParticipant(selectedSessionForAdd.id, {
        memberId: participantMemberId,
        source: participantSource,
      });
      toast({ title: "تم إضافة المتدرب للجلسة بنجاح", variant: "success" });
      setSelectedSessionForAdd(null);
      setParticipantMemberId("");
      loadData();
    } catch (err: any) {
      toast({ title: "تعذر إضافة المتدرب", description: err.message, variant: "error" });
    } finally {
      setIsAddingPart(false);
    }
  };

  const handleSaveAttendance = async () => {
    if (!selectedSessionForAtt) return;
    setIsSavingAtt(true);
    try {
      const res = await coachOpsApi.recordAttendance(selectedSessionForAtt.id, {
        attendedMemberIds,
      });
      toast({
        title: "تم تسجيل الحضور وإتمام الجلسة",
        description: `تم خصم ${res.ptDeductionsCount} جلسة PT و ${res.freeDeductionsCount} جلسة مجانية. (الغياب لم يتم خصمه)`,
        variant: "success",
      });
      setSelectedSessionForAtt(null);
      loadData();
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "error" });
    } finally {
      setIsSavingAtt(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pb-3 border-b border-[#E1E5DF]">
        <div>
          <h3 className="font-bold text-sm text-[#14181F] flex items-center gap-2">
            <Calendar className="h-5 w-5 text-[#14181F]" />
            <span>جدول جلسات التدريب (PT & Group Sessions)</span>
          </h3>
          <p className="text-xs text-[#5B6470]">
            الخصم المالي للحصص يتم فقط عند تأكيد الحضور الفعلي للمتدرب (الغياب لا يتم خصمه)
          </p>
        </div>

        <Button
          variant="lime"
          size="sm"
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center gap-1 font-bold"
        >
          <Plus className="h-4 w-4" />
          <span>جلسة جديدة</span>
        </Button>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-[#5B6470]">
          <div className="animate-spin h-7 w-7 border-2 border-[#14181F] border-t-transparent rounded-full mx-auto mb-2" />
          <p className="text-xs">جاري تحميل الجلسات...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="p-10 text-center bg-white rounded-xl border border-[#E1E5DF] text-[#5B6470] space-y-3">
          <Calendar className="h-9 w-9 mx-auto text-[#C6F24E]" />
          <h4 className="font-bold text-sm text-[#14181F]">لا توجد جلسات مجدولة</h4>
          <p className="text-xs">اضغط على &quot;جلسة جديدة&quot; لإضافة جلسة تدريب خاصة أو جماعية.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((sess) => (
            <div
              key={sess.id}
              className="bg-white rounded-xl border border-[#E1E5DF] p-5 shadow-sm space-y-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      sess.type === "PRIVATE"
                        ? "bg-[#14181F] text-[#C6F24E]"
                        : "bg-blue-100 text-blue-800"
                    }`}
                  >
                    {sess.type === "PRIVATE" ? "برايفت (PT)" : "جماعية (Group)"}
                  </span>
                  <h4 className="font-bold text-sm text-[#14181F] mt-1">
                    المدرب: {sess.coach?.name || sess.coachId}
                  </h4>
                </div>

                <span
                  className={`px-2.5 py-1 rounded text-xs font-bold ${
                    sess.status === "COMPLETED"
                      ? "bg-[#C6F24E] text-[#14181F]"
                      : sess.status === "CANCELLED"
                      ? "bg-red-100 text-red-800"
                      : sess.status === "NO_SHOW"
                      ? "bg-gray-200 text-gray-800"
                      : "bg-amber-100 text-amber-800"
                  }`}
                >
                  {sess.status === "COMPLETED"
                    ? "مكتملة"
                    : sess.status === "CANCELLED"
                    ? "ملغاة"
                    : sess.status === "NO_SHOW"
                    ? "لم يحضر أحد"
                    : "مجدولة"}
                </span>
              </div>

              <div className="text-xs text-[#5B6470] space-y-1">
                <p>
                  📅 الموعد:{" "}
                  {new Date(sess.startTime).toLocaleString("ar-EG", {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                {sess.capacity && (
                  <p>👥 السعة القصوى: {sess.capacity} متدربين</p>
                )}
                {sess.notes && <p>📝 ملاحظات: {sess.notes}</p>}
              </div>

              {/* Participants */}
              <div className="pt-2 border-t border-[#E1E5DF] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#14181F]">
                    المتدربون المسجلون ({sess.participants.length})
                  </span>
                  {sess.status === "SCHEDULED" && (
                    <button
                      type="button"
                      onClick={() => setSelectedSessionForAdd(sess)}
                      className="text-[11px] font-bold text-[#14181F] hover:underline cursor-pointer"
                    >
                      + إضافة متدرب
                    </button>
                  )}
                </div>

                {sess.participants.length === 0 ? (
                  <p className="text-[11px] text-[#5B6470] italic">لا يوجد متدربون مضافون</p>
                ) : (
                  <div className="space-y-1">
                    {sess.participants.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between p-1.5 rounded bg-[#F2F4F1] text-xs"
                      >
                        <span className="font-medium text-[#14181F]">
                          {p.member?.name || p.memberId}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-[#5B6470]">
                            {p.source === "PT_LINKED"
                              ? "اشتراك PT"
                              : p.source === "FREE_GRANT"
                              ? "حصة مجانية"
                              : "حصة جماعية"}
                          </span>
                          {p.attended && (
                            <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-[#C6F24E] text-[#14181F]">
                              حضر ✅
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              {sess.status === "SCHEDULED" && (
                <div className="pt-2 flex justify-end gap-2 border-t">
                  <Button
                    variant="lime"
                    size="sm"
                    onClick={() => {
                      setSelectedSessionForAtt(sess);
                      setAttendedMemberIds(sess.participants.map((p) => p.memberId));
                    }}
                    className="font-bold text-xs"
                  >
                    تسجيل الحضور وإتمام الجلسة
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Create Session Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-md my-auto max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col text-start">
            <div className="p-4 border-b border-[#E1E5DF] shrink-0 bg-white flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#14181F]">جدولة جلسة تدريب جديدة</h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleCreateSession} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
                <div>
                  <label className="text-xs font-bold text-[#14181F] block mb-1">المدرب</label>
                  <Input
                    value={coachId}
                    onChange={(e) => setCoachId(e.target.value)}
                    placeholder="معرف المدرب"
                    required
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-[#14181F] block mb-1">نوع الجلسة</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setType("PRIVATE")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                        type === "PRIVATE"
                          ? "bg-[#14181F] text-[#C6F24E] border-[#14181F]"
                          : "bg-white text-[#14181F]"
                      }`}
                    >
                      خاصة (PT)
                    </button>
                    <button
                      type="button"
                      onClick={() => setType("GROUP")}
                      className={`flex-1 py-2 text-xs font-bold rounded-lg border ${
                        type === "GROUP"
                          ? "bg-[#14181F] text-[#C6F24E] border-[#14181F]"
                          : "bg-white text-[#14181F]"
                      }`}
                    >
                      جماعية (Group)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="وقت البدء"
                    type="datetime-local"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    required
                  />
                  <Input
                    label="وقت الانتهاء"
                    type="datetime-local"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>

                {type === "GROUP" && (
                  <Input
                    label="السعة القصوى"
                    type="number"
                    value={capacity.toString()}
                    onChange={(e) => setCapacity(parseInt(e.target.value, 10) || 1)}
                    min="1"
                    required
                  />
                )}

                <Input
                  label="ملاحظات"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="ملاحظات خاصة بالجلسة"
                />
              </div>

              <div className="flex justify-end gap-2 p-4 border-t border-[#E1E5DF] shrink-0 bg-white">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCreateOpen(false)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="lime"
                  size="sm"
                  isLoading={isSubmitting}
                  className="font-bold"
                >
                  حفظ الجلسة
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Participant Modal */}
      {selectedSessionForAdd && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-sm my-auto max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col text-start">
            <div className="p-4 border-b border-[#E1E5DF] shrink-0 bg-white flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#14181F]">إضافة متدرب للجلسة</h3>
              <button
                type="button"
                onClick={() => setSelectedSessionForAdd(null)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAddParticipant} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
                <Input
                  label="معرّف العضو (Member ID)"
                  value={participantMemberId}
                  onChange={(e) => setParticipantMemberId(e.target.value)}
                  placeholder="mem_..."
                  required
                />

                <div>
                  <label className="text-xs font-bold text-[#14181F] block mb-1">مصدر الحصة</label>
                  <select
                    value={participantSource}
                    onChange={(e) => setParticipantSource(e.target.value as any)}
                    className="w-full text-xs p-2.5 border rounded-lg bg-white"
                  >
                    <option value="PT_LINKED">اشتراك PT نشط</option>
                    <option value="FREE_GRANT">حصة مجانية (Free PT)</option>
                    <option value="CLASS_LINKED">اشتراك حصص جماعية</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 p-4 border-t border-[#E1E5DF] shrink-0 bg-white">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedSessionForAdd(null)}
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  variant="lime"
                  size="sm"
                  isLoading={isAddingPart}
                  className="font-bold"
                >
                  إضافة المتدرب
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Confirmation Modal */}
      {selectedSessionForAtt && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="relative w-full max-w-md my-auto max-h-[90vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col text-start">
            <div className="p-4 border-b border-[#E1E5DF] shrink-0 bg-white flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#14181F]">تسجيل الحضور الفعلي للجلسة</h3>
              <button
                type="button"
                onClick={() => setSelectedSessionForAtt(null)}
                className="text-gray-400 hover:text-gray-700 font-bold p-1 rounded-lg"
              >
                ✕
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto flex-1 min-h-0">
              <p className="text-xs text-[#5B6470]">
                حدد المتدربين الذين حضروا بالفعل. المتدربون غير المحددين يعتبرون غائبين (No-Show) ولن يتم خصم أي حصة من رصيدهم.
              </p>

              <div className="space-y-2 border p-3 rounded-xl max-h-60 overflow-y-auto">
                {selectedSessionForAtt.participants.map((p) => {
                  const isChecked = attendedMemberIds.includes(p.memberId);
                  return (
                    <label
                      key={p.id}
                      className="flex items-center gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer text-xs"
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setAttendedMemberIds([...attendedMemberIds, p.memberId]);
                          } else {
                            setAttendedMemberIds(
                              attendedMemberIds.filter((id) => id !== p.memberId)
                            );
                          }
                        }}
                        className="rounded"
                      />
                      <span className="font-bold text-[#14181F]">
                        {p.member?.name || p.memberId}
                      </span>
                      <span className="text-[10px] text-[#5B6470]">
                        ({p.source})
                      </span>
                    </label>
                  );
                })}
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  سيتم خصم {attendedMemberIds.length} حصة فقط، ولن يتم خصم حصص الغائبين.
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-4 border-t border-[#E1E5DF] shrink-0 bg-white">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedSessionForAtt(null)}
              >
                إلغاء
              </Button>
              <Button
                variant="lime"
                size="sm"
                onClick={handleSaveAttendance}
                isLoading={isSavingAtt}
                className="font-bold"
              >
                تأكيد الحضور وإتمام الجلسة
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

