import React from "react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../utils";

export interface StatCardProps {
  title: string;
  value: React.ReactNode;
  subtitle?: string;
  icon?: React.ReactNode;
  valueClassName?: string;
  trend?: {
    value: string | number;
    positive?: boolean;
    label?: string;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  valueClassName,
  trend,
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-[14px] border border-[#E1E5DF] bg-white p-[18px] text-[#14181F] text-start transition-all",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-[#5B6470]">{title}</span>
        {icon && (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#F2F4F1] text-[#14181F]">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-1.5 flex items-baseline gap-2">
        <div className={cn("text-[32px] font-bold leading-tight tracking-tight", valueClassName)}>
          {value}
        </div>
      </div>

      {(subtitle || trend) && (
        <div className="mt-2 flex items-center gap-2 text-xs text-[#5B6470]">
          {trend && (
            <span
              className={cn(
                "inline-flex items-center gap-0.5 font-bold",
                trend.positive ? "text-[#1B7F4B]" : "text-[#B3261E]"
              )}
            >
              {trend.positive ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5" />
              )}
              {trend.value}
            </span>
          )}
          {subtitle && <span>{subtitle}</span>}
        </div>
      )}
    </div>
  );
}
