import { http } from "../../lib/api";

export interface PlatformGym {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  currency: string;
  isActive: boolean;
  membersCount: number;
  staffCount: number;
  subscriptionsCount: number;
  createdAt: string;
}

export interface CreateGymDto {
  name: string;
  slug: string;
  timezone?: string;
  admin: {
    name: string;
    email: string;
    password?: string;
  };
}

export const platformApi = {
  listGyms: (): Promise<PlatformGym[]> => http.get<PlatformGym[]>("/admin/gyms"),
  createGym: (dto: CreateGymDto): Promise<PlatformGym> => http.post<PlatformGym>("/admin/gyms", dto),
  toggleGymStatus: (id: string, isActive: boolean): Promise<any> =>
    http.patch<any>(`/admin/gyms/${id}/status`, { isActive }),
};

