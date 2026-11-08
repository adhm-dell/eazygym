import React from "react";
import "./globals.css";

export const metadata = {
  title: "EazyGym - Member Portal",
  description: "بوابة الأعضاء لمتابعة الاشتراكات والحضور",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-[#F2F4F1] text-[#14181F] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
