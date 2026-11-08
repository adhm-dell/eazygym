"use client";

import React, { useState } from "react";
import { Dialog, Button } from "@gym/ui";
import { formatMoney } from "../../../lib/money";
import { Printer } from "lucide-react";
import type { ShiftReport } from "@gym/mock-data";

interface ShiftReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: ShiftReport | null;
}

export function ShiftReportModal({
  isOpen,
  onClose,
  report,
}: ShiftReportModalProps) {
  const [printFormat, setPrintFormat] = useState<"80mm" | "a4">("80mm");

  if (!isOpen || !report) return null;

  const shift = report.shift || ({} as any);
  const variance = report.variance ?? null;
  const isCounted = report.countedCash !== null && report.countedCash !== undefined;

  return (
    <Dialog
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center justify-between w-full pe-6">
          <span>تقرير إقفال وتسليم الوردية #{shift.id}</span>
          <div className="flex items-center gap-1 bg-[#F2F4F1] p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setPrintFormat("80mm")}
              className={`px-3 py-1 text-[12px] font-bold rounded-lg transition-colors ${
                printFormat === "80mm"
                  ? "bg-white shadow text-[#14181F]"
                  : "text-[#5B6470]"
              }`}
            >
              إيصال 80 مم
            </button>
            <button
              type="button"
              onClick={() => setPrintFormat("a4")}
              className={`px-3 py-1 text-[12px] font-bold rounded-lg transition-colors ${
                printFormat === "a4"
                  ? "bg-white shadow text-[#14181F]"
                  : "text-[#5B6470]"
              }`}
            >
              تقرير رسمي A4
            </button>
          </div>
        </div>
      }
      maxWidth="xl"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose}>
            إغلاق
          </Button>
          <Button
            onClick={() => window.print()}
            className="bg-[#14181F] text-[#C6F24E] hover:bg-[#262D38] font-bold"
          >
            <Printer className="h-4 w-4 me-1.5" />
            طباعة التقرير الآن
          </Button>
        </div>
      }
    >
      <div className="py-2">
        {printFormat === "80mm" ? (
          /* 80mm Thermal Receipt Layout */
          <div className="bg-white border-2 border-dashed border-[#E1E5DF] p-5 rounded-2xl max-w-sm mx-auto font-mono text-[13px] text-center">
            <div className="font-bold text-[18px] text-[#14181F]">
              EazyGym - المعادي
            </div>
            <div className="text-[11px] text-[#5B6470]">
              تقرير تسليم وردية الخزينة
            </div>
            <div className="my-2.5 border-t border-dashed border-[#14181F]" />

            <div className="text-start space-y-0.5 text-[12px]">
              <div>كود الوردية: #{shift.id}</div>
              <div>
                مسؤول الوردية: {shift.staff?.name || "سارة حسن (استقبال)"}
              </div>
              <div>
                وقت البدء: {new Date(shift.openedAt).toLocaleString("ar-EG")}
              </div>
              {shift.closedAt && (
                <div>
                  وقت الإقفال: {new Date(shift.closedAt).toLocaleString("ar-EG")}
                </div>
              )}
              {shift.closedBy && (
                <div>أقفل بواسطة: {shift.closedBy.name}</div>
              )}
            </div>

            <div className="my-2.5 border-t border-dashed border-[#14181F]" />

            {/* Cash Drawer Movements */}
            <div className="text-start space-y-1 text-[12px]">
              <div className="font-bold text-[13px] mb-1">حركة الخزينة النقدية:</div>
              <div className="flex justify-between">
                <span>العهدة الافتتاحية:</span>
                <span>{formatMoney(report.openingCash)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>(+) مبيعات نقدية:</span>
                <span>+{formatMoney(report.cashPayments)}</span>
              </div>
              <div className="flex justify-between text-emerald-800">
                <span>(+) سندات قبض نقدية:</span>
                <span>+{formatMoney(report.cashReceiptVouchers)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>(-) مصروفات من الخزينة:</span>
                <span>-{formatMoney(report.expensesFromDrawer)}</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>(-) سندات صرف نقدية:</span>
                <span>-{formatMoney(report.cashDisbursementVouchers)}</span>
              </div>
            </div>

            <div className="my-2.5 border-t border-dashed border-[#14181F]" />

            {/* Expected vs Counted */}
            <div className="text-start space-y-1 text-[12px] font-bold">
              <div className="flex justify-between text-[14px]">
                <span>الكاش المتوقع بالدرج:</span>
                <span className="font-mono">{formatMoney(report.expectedCash)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span>الكاش الفعلي بعد الجرد:</span>
                <span className="font-mono">
                  {isCounted ? formatMoney(report.countedCash!) : "لم يُجرد (إقفال إداري)"}
                </span>
              </div>
              {isCounted && variance !== null && (
                <div
                  className={`flex justify-between text-[14px] pt-1 border-t border-dashed ${
                    variance < 0
                      ? "text-red-700"
                      : variance > 0
                      ? "text-emerald-700"
                      : "text-emerald-800"
                  }`}
                >
                  <span>
                    {variance < 0
                      ? "عجز الخزينة:"
                      : variance > 0
                      ? "زيادة الخزينة:"
                      : "الفارق (مطابقة):"}
                  </span>
                  <span className="font-mono">
                    {variance > 0 && "+"}
                    {formatMoney(variance)}
                  </span>
                </div>
              )}
            </div>

            <div className="my-2.5 border-t border-dashed border-[#14181F]" />

            {/* Electronic Rails */}
            <div className="text-start space-y-0.5 text-[11px] text-[#5B6470]">
              <div className="font-bold text-[#14181F] text-[12px] mb-1">
                المدفوعات الإلكترونية (خارج الدرج):
              </div>
              <div className="flex justify-between">
                <span>إنستاباي (Instapay):</span>
                <span className="font-mono font-bold">
                  {formatMoney(report.instapayPayments)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>بطاقات بنكية (Visa/Mastercard):</span>
                <span className="font-mono font-bold">
                  {formatMoney(report.cardPayments)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>خصم من المحفظة:</span>
                <span className="font-mono font-bold">
                  {formatMoney(report.walletPayments)}
                </span>
              </div>
            </div>

            {shift.note && (
              <>
                <div className="my-2.5 border-t border-dashed border-[#14181F]" />
                <div className="text-start text-[11px] text-[#5B6470]">
                  <b>ملاحظات:</b> {shift.note}
                </div>
              </>
            )}

            <div className="my-2.5 border-t border-dashed border-[#14181F]" />
            <div className="text-[10px] text-[#5B6470]">
              تم استخراج التقرير بواسطة EazyGym Cloud System
            </div>
          </div>
        ) : (
          /* Formal A4 Sheet Layout */
          <div className="bg-white border border-[#E1E5DF] p-6 rounded-2xl text-[13px] space-y-5">
            {/* Header */}
            <div className="flex justify-between items-start border-b border-[#E1E5DF] pb-4">
              <div>
                <h2 className="text-[22px] font-bold text-[#14181F]">
                  EazyGym Egypt - فرع المعادي
                </h2>
                <p className="text-[#5B6470] text-[12px]">
                  سجل تجاري: 109283 · بطاقة ضريبية: 492-881-019
                </p>
                <div className="mt-1 text-[12px] text-[#14181F] font-bold">
                  تقرير إقفال وتسليم عهدة الوردية (Shift Handover Report)
                </div>
              </div>
              <div className="text-end">
                <b className="text-[16px] text-[#14181F]">
                  كود الوردية: #{shift.id}
                </b>
                <p className="text-[#5B6470] text-[12px]">
                  تاريخ الطباعة: {new Date().toLocaleDateString("ar-EG")}
                </p>
                <span
                  className={`inline-block px-2.5 py-0.5 mt-1 rounded-full text-[11px] font-black ${
                    shift.status === "OPEN"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-emerald-100 text-emerald-800"
                  }`}
                >
                  {shift.status === "OPEN" ? "وردية مفتوحة" : "وردية مقفلة ومجمدة"}
                </span>
              </div>
            </div>

            {/* Shift Meta Info */}
            <div className="bg-[#F2F4F1] p-3.5 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-3 text-[12px]">
              <div>
                <span className="text-[#5B6470] block text-[11px]">
                  مسؤول الوردية:
                </span>
                <b>{shift.staff?.name || "سارة حسن (استقبال)"}</b>
              </div>
              <div>
                <span className="text-[#5B6470] block text-[11px]">وقت الفتح:</span>
                <b>{new Date(shift.openedAt).toLocaleString("ar-EG")}</b>
              </div>
              <div>
                <span className="text-[#5B6470] block text-[11px]">
                  وقت الإقفال:
                </span>
                <b>
                  {shift.closedAt
                    ? new Date(shift.closedAt).toLocaleString("ar-EG")
                    : "الوردية ما زالت مفتوحة"}
                </b>
              </div>
              <div>
                <span className="text-[#5B6470] block text-[11px]">
                  مغلق بواسطة:
                </span>
                <b>{shift.closedBy?.name || "نفس مسؤول الوردية"}</b>
              </div>
            </div>

            {/* Cash Movements Summary Table */}
            <div>
              <h3 className="font-bold text-[14px] text-[#14181F] mb-2">
                1. بيان حركة الخزينة النقدية (Cash Movements)
              </h3>
              <table className="w-full text-start border border-[#E1E5DF] rounded-xl overflow-hidden text-[12px]">
                <thead className="bg-[#F2F4F1] text-[#5B6470]">
                  <tr>
                    <th className="p-2.5 text-start">البند / البيان</th>
                    <th className="p-2.5 text-start">النوع</th>
                    <th className="p-2.5 text-end">القيمة (ج.م)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E1E5DF]">
                  <tr>
                    <td className="p-2.5 font-bold">العهدة الافتتاحية المسجلة</td>
                    <td className="p-2.5 text-[#5B6470]">رصيد بداية</td>
                    <td className="p-2.5 text-end font-mono font-bold">
                      {formatMoney(report.openingCash)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">مبيعات الفواتير النقدية (Cash Sales)</td>
                    <td className="p-2.5 text-emerald-700">وارد نقدي (+)</td>
                    <td className="p-2.5 text-end font-mono font-bold text-emerald-800">
                      +{formatMoney(report.cashPayments)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">سندات قبض نقدية للخزينة</td>
                    <td className="p-2.5 text-emerald-700">وارد نقدي (+)</td>
                    <td className="p-2.5 text-end font-mono font-bold text-emerald-800">
                      +{formatMoney(report.cashReceiptVouchers)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">مصروفات تشغيلية مدفوعة من الخزينة</td>
                    <td className="p-2.5 text-red-700">منصرف نقدي (-)</td>
                    <td className="p-2.5 text-end font-mono font-bold text-red-700">
                      -{formatMoney(report.expensesFromDrawer)}
                    </td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold">سندات صرف نقدية من الخزينة</td>
                    <td className="p-2.5 text-red-700">منصرف نقدي (-)</td>
                    <td className="p-2.5 text-end font-mono font-bold text-red-700">
                      -{formatMoney(report.cashDisbursementVouchers)}
                    </td>
                  </tr>
                  <tr className="bg-[#F2F4F1]/60 font-bold text-[13px]">
                    <td className="p-2.5">إجمالي الكاش المتوقع بالدرج (Expected Cash)</td>
                    <td className="p-2.5 text-[#14181F]">صافي الدرج</td>
                    <td className="p-2.5 text-end font-mono text-[#14181F]">
                      {formatMoney(report.expectedCash)}
                    </td>
                  </tr>
                  <tr className="bg-white font-bold text-[13px]">
                    <td className="p-2.5">الكاش الفعلي بعد الجرد والتسليم (Counted Cash)</td>
                    <td className="p-2.5 text-[#5B6470]">جرد فعلي</td>
                    <td className="p-2.5 text-end font-mono">
                      {isCounted ? formatMoney(report.countedCash!) : "لم يُجرد"}
                    </td>
                  </tr>
                  {isCounted && variance !== null && (
                    <tr
                      className={`font-black text-[14px] ${
                        variance < 0
                          ? "bg-red-50 text-red-900"
                          : variance > 0
                          ? "bg-emerald-50 text-emerald-900"
                          : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      <td className="p-2.5">
                        {variance < 0
                          ? "فارق الجرد: عجز نقدي بالخزينة (Shortage)"
                          : variance > 0
                          ? "فارق الجرد: زيادة نقدية بالخزينة (Surplus)"
                          : "فارق الجرد: مطابقة تامة (Matched)"}
                      </td>
                      <td className="p-2.5">فارق العهدة</td>
                      <td className="p-2.5 text-end font-mono">
                        {variance > 0 && "+"}
                        {formatMoney(variance)}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Non-drawer Payment Summary & Sales Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border border-[#E1E5DF] p-3.5 rounded-xl">
                <h4 className="font-bold text-[13px] text-[#14181F] mb-2">
                  2. المدفوعات الإلكترونية (خارج الدرج)
                </h4>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">إنستاباي (Instapay):</span>
                    <b className="font-mono">{formatMoney(report.instapayPayments)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">بطاقات فيزا / ماستركارد:</span>
                    <b className="font-mono">{formatMoney(report.cardPayments)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">استخدام رصيد المحفظة:</span>
                    <b className="font-mono">{formatMoney(report.walletPayments)}</b>
                  </div>
                  <div className="flex justify-between border-t border-[#E1E5DF] pt-1">
                    <span className="font-bold">إجمالي المبيعات الإلكترونية:</span>
                    <b className="font-mono text-blue-900">
                      {formatMoney(
                        report.instapayPayments +
                          report.cardPayments +
                          report.walletPayments
                      )}
                    </b>
                  </div>
                </div>
              </div>

              <div className="border border-[#E1E5DF] p-3.5 rounded-xl">
                <h4 className="font-bold text-[13px] text-[#14181F] mb-2">
                  3. تحليل مبيعات الوردية بحسب البند
                </h4>
                <div className="space-y-1.5 text-[12px]">
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">اشتراكات الجيم والـ PT:</span>
                    <b className="font-mono">{formatMoney(report.salesByKind.subscriptions)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">الخدمات الفردية:</span>
                    <b className="font-mono">{formatMoney(report.salesByKind.services)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#5B6470]">منتجات البار والمشروبات:</span>
                    <b className="font-mono">{formatMoney(report.salesByKind.products)}</b>
                  </div>
                  <div className="flex justify-between border-t border-[#E1E5DF] pt-1">
                    <span className="font-bold">إجمالي الفواتير الصادرة:</span>
                    <b className="font-mono text-[#14181F]">
                      {report.invoicesCount} فواتير · {formatMoney(report.invoicesTotal)}
                    </b>
                  </div>
                </div>
              </div>
            </div>

            {shift.note && (
              <div className="p-3 bg-[#F2F4F1] rounded-xl text-[12px]">
                <span className="font-bold text-[#14181F] block mb-0.5">
                  ملاحظات مسؤول الوردية / الإدارة:
                </span>
                <p className="text-[#5B6470]">{shift.note}</p>
              </div>
            )}

            {/* Signature Blocks */}
            <div className="grid grid-cols-2 gap-8 pt-8 border-t border-[#E1E5DF] text-[12px]">
              <div className="text-center space-y-12">
                <div>
                  <b>توقيع مسؤول الوردية (المسلم)</b>
                  <p className="text-[#5B6470] text-[11px]">
                    {shift.staff?.name || "سارة حسن"}
                  </p>
                </div>
                <div className="border-b border-dashed border-[#14181F] w-48 mx-auto" />
              </div>
              <div className="text-center space-y-12">
                <div>
                  <b>توقيع إدارة الصالة / المستلم</b>
                  <p className="text-[#5B6470] text-[11px]">
                    {shift.closedBy?.name || "إدارة الفرع"}
                  </p>
                </div>
                <div className="border-b border-dashed border-[#14181F] w-48 mx-auto" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  );
}
