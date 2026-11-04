"use client";

import React, { useState, useEffect } from "react";
import { Languages } from "lucide-react";
import { Button } from "./button";

export interface LanguageToggleProps {
  currentLang?: "ar" | "en";
  onLanguageChange?: (lang: "ar" | "en") => void;
  className?: string;
}

export function LanguageToggle({
  currentLang,
  onLanguageChange,
  className,
}: LanguageToggleProps) {
  const [lang, setLang] = useState<"ar" | "en">(currentLang || "ar");

  useEffect(() => {
    if (currentLang && currentLang !== lang) {
      setLang(currentLang);
    }
  }, [currentLang]);

  const toggleLanguage = () => {
    const nextLang = lang === "ar" ? "en" : "ar";
    setLang(nextLang);
    document.documentElement.dir = nextLang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = nextLang;
    localStorage.setItem("lang", nextLang);
    onLanguageChange?.(nextLang);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={toggleLanguage}
      className={className}
      title={lang === "ar" ? "Switch to English" : "التبديل إلى العربية"}
    >
      <Languages className="h-4 w-4 me-1.5" />
      <span className="font-semibold">{lang === "ar" ? "EN" : "عربي"}</span>
    </Button>
  );
}
