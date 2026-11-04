import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "../utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "lime" | "secondary" | "destructive" | "outline" | "ghost" | "link" | "success";
  size?: "sm" | "md" | "lg" | "icon";
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles =
      "inline-flex items-center justify-center font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 select-none rounded-[10px] cursor-pointer";

    const variantStyles = {
      default: "bg-[#14181F] text-white hover:bg-[#262D38] active:bg-[#0E1116]",
      lime: "bg-[#C6F24E] text-[#14181F] hover:bg-[#b5e03e] active:bg-[#a6d132]",
      secondary: "bg-[#E1E5DF] text-[#14181F] hover:bg-[#d5d9d2]",
      destructive: "bg-[#B3261E] text-white hover:bg-[#971f18]",
      success: "bg-[#1B7F4B] text-white hover:bg-[#15673c]",
      outline: "border border-[#E1E5DF] bg-white text-[#14181F] hover:bg-[#F2F4F1]",
      ghost: "text-[#14181F] hover:bg-[#E1E5DF]/60",
      link: "text-[#14181F] underline-offset-4 hover:underline p-0 h-auto min-h-0",
    };

    const sizeStyles = {
      sm: "min-h-[36px] px-3 text-xs gap-1.5",
      md: "min-h-[44px] px-[18px] py-[12px] text-[15px] gap-2",
      lg: "min-h-[52px] px-6 text-base gap-2.5",
      icon: "h-11 w-11 p-0 min-h-[44px]",
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin shrink-0" />}
        {children}
      </button>
    );
  }
);
Button.displayName = "Button";
