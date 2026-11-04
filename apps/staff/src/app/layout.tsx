import React from "react";
import "./globals.css";
import { ToastProvider } from "@gym/ui";

export const metadata = {
  title: "EazyGym - Staff Portal",
  description: "منظومة إدارة الاستقبال والإدارة للصالات الرياضية",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className="dark">
      <body className="min-h-screen bg-background text-foreground font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
