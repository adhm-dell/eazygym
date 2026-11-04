"use client";

import React, { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "./button";

export function ThemeToggle({ className }: { className?: string }) {
  const [isDark, setIsDark] = useState<boolean>(true);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    if (nextDark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={toggleTheme}
      className={className}
      title={isDark ? "تفعيل الوضع النهاري" : "تفعيل الوضع الليلي"}
    >
      {isDark ? <Sun className="h-4 w-4 text-warning" /> : <Moon className="h-4 w-4 text-slate-700" />}
      <span className="sr-only">تبديل المظهر</span>
    </Button>
  );
}
