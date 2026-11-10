"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { type Shift, type Staff } from "@gym/contracts";
import { shiftApi } from "../features/shift/api";
import { useToast } from "@gym/ui";

interface ShiftContextType {
  shift: Shift | null;
  isOpen: boolean;
  isLoading: boolean;
  currentUser: Staff | null;
  switchUser: (staffId: string) => Promise<Staff>;
  isShiftModalOpen: boolean;
  openShiftModal: () => void;
  closeShiftModal: () => void;
  isCloseShiftModalOpen: boolean;
  openCloseShiftModal: () => void;
  closeCloseShiftModal: () => void;
  openShift: (openingCashPiasters: number) => Promise<Shift>;
  closeShift: (countedCashPiasters: number, note?: string) => Promise<Shift>;
  refreshShift: () => Promise<void>;
}

const ShiftContext = createContext<ShiftContextType | undefined>(undefined);

export function ShiftProvider({ children }: { children: React.ReactNode }) {
  const [shift, setShift] = useState<Shift | null>(null);
  const [currentUser, setCurrentUser] = useState<Staff | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isCloseShiftModalOpen, setIsCloseShiftModalOpen] = useState(false);
  const { toast } = useToast();

  const refreshShift = useCallback(async () => {
    try {
      const user = await shiftApi.getCurrentUser();
      setCurrentUser(user);
      if (user && user.role !== "SUPER_ADMIN" && (user as any).gymId) {
        const current = await shiftApi.getCurrentShift();
        setShift(current);
      } else {
        setShift(null);
      }
    } catch {
      // error handling
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshShift();
  }, [refreshShift]);

  const switchUser = async (staffId: string) => {
    try {
      const u = await shiftApi.switchActiveUser(staffId);
      setCurrentUser(u);
      await refreshShift();
      toast({
        title: "تم تغيير المستخدم الحالي",
        description: `المستخدم الحالي الآن: ${u.name} (${u.role})`,
        variant: "info",
      });
      return u;
    } catch (err: any) {
      toast({
        title: "خطأ",
        description: err.message,
        variant: "error",
      });
      throw err;
    }
  };

  const openShift = async (openingCashPiasters: number) => {
    try {
      const user = await shiftApi.getCurrentUser();
      const newShift = await shiftApi.openShift(user.id, openingCashPiasters / 100);
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
      const closed = await shiftApi.closeShift(shift.id, countedCashPiasters / 100, note);
      setShift(closed);
      setIsCloseShiftModalOpen(false);
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
        currentUser,
        switchUser,
        isShiftModalOpen,
        openShiftModal: () => setIsShiftModalOpen(true),
        closeShiftModal: () => setIsShiftModalOpen(false),
        isCloseShiftModalOpen,
        openCloseShiftModal: () => setIsCloseShiftModalOpen(true),
        closeCloseShiftModal: () => setIsCloseShiftModalOpen(false),
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

