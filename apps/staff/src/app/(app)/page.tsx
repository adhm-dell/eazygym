"use client";

import React from "react";
import Link from "next/link";
import { Button } from "@gym/ui";
import { Sparkles } from "lucide-react";

export default function StaffHomePage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
      <div className="max-w-md w-full rounded-2xl border border-border bg-card p-8 shadow-card space-y-6">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Sparkles className="h-7 w-7" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">EazyGym</h1>
          <p className="text-sm text-muted-foreground">
            بوابة الإدارة والاستقبال - المرحلة الأولى (نظام التصميم والمكونات)
          </p>
        </div>

        <div className="pt-2">
          <Link href="/design" className="block">
            <Button size="lg" className="w-full font-bold gap-2">
              <span>استعراض دليل المكونات (/design)</span>
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
