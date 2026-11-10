import { http } from "../../lib/api";

export interface SetupStatus {
  isComplete: boolean;
  plans: boolean;
  services: boolean;
  reception: boolean;
  coaches: boolean;
  coachShifts: boolean;
  commissionTiers: boolean;
  paymentPolicy: boolean;
  classes: boolean;
  counts: {
    plans: number;
    services: number;
    reception: number;
    coaches: number;
    coachesWithoutShifts: number;
    commissionTiers: number;
    classes: number;
  };
  completedSteps: number;
  totalRequiredSteps: number;
}

export const fetchSetupStatus = (): Promise<SetupStatus> =>
  http.get<SetupStatus>("/setup/status");
