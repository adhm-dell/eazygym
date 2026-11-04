import React from "react";

export const metadata = {
  title: "EazyGym - Member Portal",
  description: "بوابة الأعضاء لمتابعة الاشتراكات والحضور",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="min-h-screen bg-slate-900 text-slate-100 font-sans">
        {children}
      </body>
    </html>
  );
}

