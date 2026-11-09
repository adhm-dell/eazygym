import { http } from "../../lib/api";
import type { CreateStaffDto, UpdateStaffDto, StaffRole } from "@gym/contracts";

export interface StaffMember {
  id: string;
  gymId: string;
  name: string;
  email: string;
  phone?: string | null;
  role: StaffRole;
  baseSalary: number; // in piasters
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const staffApi = {
  listStaff: (): Promise<StaffMember[]> => http.get<StaffMember[]>("/staff"),
  getStaffById: (id: string): Promise<StaffMember> => http.get<StaffMember>(`/staff/${id}`),
  createStaff: (dto: CreateStaffDto): Promise<StaffMember> => http.post<StaffMember>("/staff", dto),
  updateStaff: (id: string, dto: UpdateStaffDto): Promise<StaffMember> =>
    http.patch<StaffMember>(`/staff/${id}`, dto),
};

