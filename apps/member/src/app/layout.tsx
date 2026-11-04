import React from "react";
import "./globals.css";

export const metadata = {
  title: "EazyGym - Member Portal",
  description: "بوابة الأعضاء لمتابعة الاشتراكات والحضور",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <body className="min-h-screen bg-[#F2F4F1] text-[#14181F] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
