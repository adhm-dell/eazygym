import React from "react";
import { cn } from "../utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "g" | "w" | "r" | "default" | "lime";
}

export function Badge({
  variant = "g",
  className,
  children,
  ...props
}: BadgeProps) {
  const variantStyles = {
    g: "bg-[#E3F5EA] text-[#1B7F4B]",
    w: "bg-[#FFF1D6] text-[#8A5A00]",
    r: "bg-[#FDE7E4] text-[#B3261E]",
    default: "bg-[#14181F] text-white",
    lime: "bg-[#C6F24E] text-[#14181F]",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full px-2.5 py-1 text-xs font-bold leading-normal select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
