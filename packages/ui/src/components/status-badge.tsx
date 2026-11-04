import React from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PauseCircle,
  Clock,
  Ban,
  AlertCircle,
  HelpCircle,
  CalendarX,
} from "lucide-react";
import { cn } from "../utils";

export type StatusType =
  | "ACTIVE"
  | "EXPIRING_SOON"
  | "EXPIRED"
  | "FROZEN"
  | "PENDING_PAYMENT"
  | "SUSPENDED_UNPAID"
  | "PAYMENT_OVERDUE"
  | "CANCELLED"
  | "BLOCKED"
  | "NO_SUBSCRIPTION"
  | "NO_SESSIONS_LEFT"
  | "CLASS_OUT_OF_TIME"
  | "CLASS_CANCELLED"
  | "CLASS_NOT_STARTED"
  | "CLASS_NOT_TODAY"
  | "CLASS_ENDED"
  | "OPEN"
  | "CLOSED"
  | "PAID"
  | "VOID";

export interface StatusBadgeProps {
  status: StatusType | string;
  label?: string;
  locale?: "ar" | "en";
  className?: string;
  size?: "sm" | "md";
  showIcon?: boolean;
}

interface StatusConfig {
  variant: "success" | "warning" | "destructive" | "muted" | "info";
  icon: React.ComponentType<{ className?: string }>;
  labelAr: string;
  labelEn: string;
}

const statusConfigs: Record<string, StatusConfig> = {
  ACTIVE: {
    variant: "success",
    icon: CheckCircle2,
    labelAr: "ACTIVE",
    labelEn: "ACTIVE",
  },
  EXPIRING_SOON: {
    variant: "warning",
    icon: Clock,
    labelAr: "ينتهي قريباً",
    labelEn: "Expiring Soon",
  },
  EXPIRED: {
    variant: "destructive",
    icon: XCircle,
    labelAr: "الاشتراك منتهي",
    labelEn: "Expired",
  },
  FROZEN: {
    variant: "info",
    icon: PauseCircle,
    labelAr: "مجمّد",
    labelEn: "Frozen",
  },
  PENDING_PAYMENT: {
    variant: "warning",
    icon: Clock,
    labelAr: "في انتظار السداد",
    labelEn: "Pending Payment",
  },
  SUSPENDED_UNPAID: {
    variant: "destructive",
    icon: AlertTriangle,
    labelAr: "متوقف لوجود متبقي مستحق",
    labelEn: "Suspended (Unpaid)",
  },
  PAYMENT_OVERDUE: {
    variant: "destructive",
    icon: AlertTriangle,
    labelAr: "قسط متأخر",
    labelEn: "Payment Overdue",
  },
  CANCELLED: {
    variant: "muted",
    icon: XCircle,
    labelAr: "ملغي",
    labelEn: "Cancelled",
  },
  BLOCKED: {
    variant: "destructive",
    icon: Ban,
    labelAr: "محظور",
    labelEn: "Blocked",
  },
  NO_SUBSCRIPTION: {
    variant: "destructive",
    icon: AlertCircle,
    labelAr: "بدون اشتراك",
    labelEn: "No Subscription",
  },
  NO_SESSIONS_LEFT: {
    variant: "destructive",
    icon: AlertCircle,
    labelAr: "نفدت الحصص",
    labelEn: "No Sessions Remaining",
  },
  CLASS_OUT_OF_TIME: {
    variant: "warning",
    icon: Clock,
    labelAr: "خارج موعد الحصة",
    labelEn: "Out of Class Time",
  },
  CLASS_CANCELLED: {
    variant: "destructive",
    icon: CalendarX,
    labelAr: "الحصة ملغاة",
    labelEn: "Class Cancelled",
  },
  CLASS_NOT_STARTED: {
    variant: "warning",
    icon: Clock,
    labelAr: "لم تبدأ",
    labelEn: "Not Started",
  },
  OPEN: {
    variant: "success",
    icon: CheckCircle2,
    labelAr: "مفتوح",
    labelEn: "Open",
  },
  CLOSED: {
    variant: "muted",
    icon: XCircle,
    labelAr: "مغلق",
    labelEn: "Closed",
  },
  PAID: {
    variant: "success",
    icon: CheckCircle2,
    labelAr: "مدفوع",
    labelEn: "Paid",
  },
  VOID: {
    variant: "destructive",
    icon: XCircle,
    labelAr: "ملغي / مسترد",
    labelEn: "Voided",
  },
};

export function StatusBadge({
  status,
  label,
  locale = "ar",
  className,
  size = "md",
  showIcon = false,
}: StatusBadgeProps) {
  const config = statusConfigs[status] || {
    variant: "muted",
    icon: HelpCircle,
    labelAr: status,
    labelEn: status,
  };

  const Icon = config.icon;
  const displayLabel = label || (locale === "ar" ? config.labelAr : config.labelEn);

  const variantStyles = {
    success: "bg-[#E3F5EA] text-[#1B7F4B]",
    warning: "bg-[#FFF1D6] text-[#8A5A00]",
    destructive: "bg-[#FDE7E4] text-[#B3261E]",
    info: "bg-[#E1E5DF] text-[#14181F]",
    muted: "bg-[#E1E5DF]/70 text-[#5B6470]",
  };

  const sizeStyles = {
    sm: "px-2 py-0.5 text-xs gap-1",
    md: "px-2.5 py-1 text-xs font-bold gap-1.5",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full select-none leading-normal font-bold",
        variantStyles[config.variant],
        sizeStyles[size],
        className
      )}
    >
      {showIcon && <Icon className={cn("shrink-0", size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5")} />}
      <span>{displayLabel}</span>
    </span>
  );
}
