import { http } from "../../lib/api";
import type { UpdateGymSettingsDto } from "@gym/contracts";

export interface GymSettings {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  defaultMinUpfrontPercent: number;
  defaultDueAfterDays: number | null;
  defaultDueAfterPercent: number | null;
  classEntryMode: "RECEPTION_STARTS" | "SCHEDULED";
  classCheckinEarlyMinutes: number;
  expiryNotifyDays: number[];
  maxCoachBreaksPerDay: number;
  coachBreakDurationMinutes: number;
  freeSessionsOnFitnessProfile: number;
  manualDiscountLimitPercent: number;
  isActive: boolean;
}

export const settingsApi = {
  getSettings: (): Promise<GymSettings> => http.get<GymSettings>("/gym/settings"),
  updateSettings: (dto: UpdateGymSettingsDto): Promise<GymSettings> =>
    http.patch<GymSettings>("/gym/settings", dto),
};

