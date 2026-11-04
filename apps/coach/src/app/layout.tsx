import React from "react";

export const metadata = {
  title: "EazyGym - Coach Portal",
  description: "بوابة المدربين لمتابعة المتدربين والحصص",
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

