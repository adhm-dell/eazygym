"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { mockClient, type Shift } from "@gym/mock-data";
import { useToast } from "@gym/ui";

interface ShiftContextType {
  shift: Shift | null;
  isOpen: boolean;
  isLoading: boolean;
  isShiftModalOpen: boolean;
  openShiftModal: () => void;
  closeShiftModal: () => void;
  openShift: (openingCashPiasters: number) => Promise<Shift>;
  closeShift: (countedCashPiasters: number, note?: string) => Promise<Shift>;
  refreshShift: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const { toast } = useToast();

  const refreshShift = useCallback(async () => {
    try {
      const current = await mockClient.getCurrentShift();
      setShift(current);
    } catch {
      // error handling
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  const openShift = async (openingCashPiasters: number) => {
    try {
      const user = await mockClient.getCurrentUser();
      const newShift = await mockClient.openShift(user.id, openingCashPiasters);
      setShift(newShift);
      setIsShiftModalOpen(false);
      toast({
        title: "تم فتح الوردية بنجاح",
        description: `تم تسجيل العهدة الافتتاحية: ${(openingCashPiasters / 100).toFixed(2)} ج.م`,
        variant: "success",
      });
      return newShift;
    } catch (err: any) {
      toast({
        title: "تعذر فتح الوردية",
        description: err.message || "حدث خطأ أثناء فتح الوردية",
        variant: "error",
      });
      throw err;
    }
  };

  const closeShift = async (countedCashPiasters: number, note?: string) => {
    if (!shift) throw new Error("No open shift");
    try {
      const closed = await mockClient.closeShift(shift.id, countedCashPiasters, note);
      setShift(closed);
      toast({
        title: "تم إغلاق الوردية",
        description: `تم إغلاق الوردية برصيد فعلي: ${(countedCashPiasters / 100).toFixed(2)} ج.م`,
        variant: "info",
      });
      return closed;
    } catch (err: any) {
      toast({
        title: "تعذر إغلاق الوردية",
        description: err.message,
        variant: "error",
      });
      throw err;
    }
  };

  return (
    <ShiftContext.Provider
      value={{
        shift,
        isOpen: shift?.status === "OPEN",
        isLoading,
        isShiftModalOpen,
        openShiftModal: () => setIsShiftModalOpen(true),
        closeShiftModal: () => setIsShiftModalOpen(false),
        openShift,
        closeShift,
        refreshShift,
      }}
    >
      {children}
    </ShiftContext.Provider>
  );
}

export function useShift(): ShiftContextType {
  const context = useContext(ShiftContext);
  if (!context) {
    throw new Error("useShift must be used within a ShiftProvider");
  }
  return context;
}
