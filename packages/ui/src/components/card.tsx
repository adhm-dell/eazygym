import React from "react";
import { cn } from "../utils";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hoverEffect?: boolean;
}

export function Card({
  className,
  children,
  hoverEffect = false,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "bg-white border border-[#E1E5DF] rounded-[14px] p-[18px] text-[#14181F]",
        hoverEffect && "transition-shadow hover:shadow-card",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

