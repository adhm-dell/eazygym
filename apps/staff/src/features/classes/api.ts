import { http } from "../../lib/api";
import type {
  CreateClassScheduleDto,
  UpdateClassScheduleDto,
  CreateClassExceptionDto,
  StartClassDto,
  Staff,
} from "@gym/contracts";

export interface ClassMember {
  id: string;
  code: string;
  name: string;
  phone: string;
  gender?: string | null;
}

export interface TodayClassSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  actualCoachId: string | null;
}

export interface TodayClassOccurrence {
  id: string;
  name: string;
  coach: { id: string; name: string };
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  capacity: number;
  registeredCount: number;
  status: "NOT_STARTED" | "RUNNING" | "ENDED" | "CANCELLED";
  session: TodayClassSession | null;
  members: ClassMember[];
}

export interface ClassScheduleItem {
  id: string;
  gymId: string;
  name: string;
  coachId: string;
  coach: { id: string; name: string };
  dayOfWeek: number; // 0 = Sunday .. 6 = Saturday
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  capacity: number;
  isActive: boolean;
  registeredCount?: number;
  members?: ClassMember[];
}

export interface ScheduleRegisteredMember {
  subscriptionId: string;
  subscriptionStatus: string;
  planName: string;
  member: ClassMember;
}

export interface ClassScheduleException {
  id: string;
  classScheduleId: string;
  date: string;
  isCancelled: boolean;
  newStartTime: string | null;
  newEndTime: string | null;
  substituteCoachId: string | null;
}

export const classesApi = {
  // Today's classes
  listTodayClasses: (): Promise<TodayClassOccurrence[]> =>
    http.get<TodayClassOccurrence[]>("/classes/today").catch(() => []),

  startClass: (scheduleId: string, dto?: StartClassDto): Promise<any> =>
    http.post<any>(`/classes/${scheduleId}/start`, dto || {}),

  endClass: (scheduleId: string): Promise<any> =>
    http.post<any>(`/classes/${scheduleId}/end`, {}),

  // Timetable schedules
  listSchedules: (): Promise<ClassScheduleItem[]> =>
    http.get<ClassScheduleItem[]>("/class-schedules"),

  createSchedule: (dto: CreateClassScheduleDto): Promise<ClassScheduleItem> =>
    http.post<ClassScheduleItem>("/class-schedules", dto),

  updateSchedule: (id: string, dto: UpdateClassScheduleDto): Promise<ClassScheduleItem> =>
    http.patch<ClassScheduleItem>(`/class-schedules/${id}`, dto),

  // Exceptions (Cancel date, reschedule, substitute coach)
  addException: (
    scheduleId: string,
    dto: CreateClassExceptionDto
  ): Promise<ClassScheduleException> =>
    http.post<ClassScheduleException>(`/class-schedules/${scheduleId}/exceptions`, dto),

  // Registered members for a schedule
  getScheduleMembers: (scheduleId: string): Promise<ScheduleRegisteredMember[]> =>
    http.get<ScheduleRegisteredMember[]>(`/class-schedules/${scheduleId}/members`),

  // Active coaches
  listCoaches: async (): Promise<Staff[]> => {
    const staff = await http.get<Staff[]>("/staff").catch(() => []);
    return staff.filter((s) => s.role === "COACH" && s.isActive);
  },
};
