import React from "react";
import { cn } from "../utils";

export interface ChipProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "dark" | "outline";
}

export function Chip({
  variant = "dark",
  className,
  children,
  ...props
}: ChipProps) {
  const variantStyles = {
    dark: "bg-[#14181F] text-[#C6F24E]",
    outline: "border border-[#14181F] text-[#14181F] bg-transparent",
  };

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium select-none",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

