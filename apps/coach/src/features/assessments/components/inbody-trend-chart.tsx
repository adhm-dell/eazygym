"use client";

import React, { useMemo } from "react";
import type { FitnessAssessment } from "../api";
import { TrendingUp, Activity, Scale, Percent } from "lucide-react";

interface InBodyTrendChartProps {
  assessments: FitnessAssessment[];
  onOpenAddModal: () => void;
}

export function InBodyTrendChart({ assessments, onOpenAddModal }: InBodyTrendChartProps) {
  // Sort by date ascending for trend calculation
  const sorted = useMemo(() => {
    return [...assessments].sort(
      (a, b) => new Date(a.assessmentDate).getTime() - new Date(b.assessmentDate).getTime()
    );
  }, [assessments]);

  const latest = sorted[sorted.length - 1];
  const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;

  const weightChange = latest?.metrics.weight && previous?.metrics.weight
    ? (latest.metrics.weight - previous.metrics.weight).toFixed(1)
    : null;

  const fatChange = latest?.metrics.bodyFatPercent && previous?.metrics.bodyFatPercent
    ? (latest.metrics.bodyFatPercent - previous.metrics.bodyFatPercent).toFixed(1)
    : null;

  // Generate SVG path points for sparkline (width 260, height 50)
  const sparklinePoints = useMemo(() => {
    const valid = sorted.filter((a) => typeof a.metrics.weight === "number");
    if (valid.length < 2) return null;

    const weights = valid.map((a) => a.metrics.weight as number);
    const min = Math.min(...weights);
    const max = Math.max(...weights);
    const range = max - min || 1;

    const w = 260;
    const h = 40;
    const padding = 6;

    return weights
      .map((val, idx) => {
        const x = (idx / (weights.length - 1)) * (w - padding * 2) + padding;
        const y = h - ((val - min) / range) * (h - padding * 2) - padding;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }, [sorted]);

  return (
    <div className="bg-white border border-[#E1E5DF] rounded-2xl p-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-[#14181F]">
          <Activity className="w-4 h-4 text-[#C6F24E]" />
          <span>سجل قياسات InBody ومسار التطور</span>
        </div>
        <button
          type="button"
          onClick={onOpenAddModal}
          className="px-2.5 py-1 bg-[#14181F] text-[#C6F24E] text-[11px] font-bold rounded-lg hover:bg-black transition-colors"
        >
          + فحص جديد
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="text-center py-4 text-xs text-[#5B6470] bg-[#F2F4F1] rounded-xl">
          لم يتم تسجيل أي فحوصات InBody لهذا المتدرب بعد.
        </div>
      ) : (
        <>
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-[#F2F4F1] rounded-xl">
              <span className="text-[10px] text-[#5B6470] block">الوزن</span>
              <span className="text-sm font-bold text-[#14181F]">
                {latest?.metrics.weight ? `${latest.metrics.weight} كجم` : "—"}
              </span>
              {weightChange && (
                <span
                  className={`text-[9px] font-bold block ${
                    Number(weightChange) <= 0 ? "text-emerald-600" : "text-amber-600"
                  }`}
                >
                  {Number(weightChange) > 0 ? `+${weightChange}` : weightChange} كجم
                </span>
              )}
            </div>

            <div className="p-2 bg-[#F2F4F1] rounded-xl">
              <span className="text-[10px] text-[#5B6470] block">نسبة الدهون</span>
              <span className="text-sm font-bold text-[#14181F]">
                {latest?.metrics.bodyFatPercent ? `${latest.metrics.bodyFatPercent}%` : "—"}
              </span>
              {fatChange && (
                <span
                  className={`text-[9px] font-bold block ${
                    Number(fatChange) <= 0 ? "text-emerald-600" : "text-red-600"
                  }`}
                >
                  {Number(fatChange) > 0 ? `+${fatChange}` : fatChange}%
                </span>
              )}
            </div>

            <div className="p-2 bg-[#F2F4F1] rounded-xl">
              <span className="text-[10px] text-[#5B6470] block">كتلة العضل</span>
              <span className="text-sm font-bold text-[#14181F]">
                {latest?.metrics.muscleMass ? `${latest.metrics.muscleMass} كجم` : "—"}
              </span>
            </div>
          </div>

          {/* Sparkline Trend Chart */}
          {sparklinePoints && (
            <div className="p-2.5 bg-[#14181F] rounded-xl text-white">
              <div className="flex items-center justify-between text-[10px] text-[#C9CFD6] mb-1">
                <span>تطور الوزن عبر الوقت</span>
                <span className="text-[#C6F24E] font-mono">
                  {sorted[0]?.metrics.weight} ← {latest?.metrics.weight} كجم
                </span>
              </div>
              <svg viewBox="0 0 260 40" className="w-full h-10 overflow-visible">
                <polyline
                  fill="none"
                  stroke="#C6F24E"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  points={sparklinePoints}
                />
              </svg>
            </div>
          )}

          {/* Recent History Table */}
          <div className="space-y-1.5 max-h-36 overflow-y-auto">
            <span className="text-[10px] font-bold text-[#5B6470] block">الفحوصات السابقة ({sorted.length})</span>
            {[...sorted].reverse().map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-2 rounded-lg bg-[#F9FAF8] border border-[#E1E5DF] text-[11px]"
              >
                <span className="font-mono text-[#5B6470]">
                  {new Date(a.assessmentDate).toLocaleDateString("ar-EG")}
                </span>
                <div className="flex gap-2">
                  <span>وزن: <b className="text-[#14181F]">{a.metrics.weight ?? "—"}</b> كجم</span>
                  <span>دهون: <b className="text-[#14181F]">{a.metrics.bodyFatPercent ?? "—"}%</b></span>
                  <span>عضل: <b className="text-[#14181F]">{a.metrics.muscleMass ?? "—"}</b> كجم</span>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

