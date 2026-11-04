import type { AuthUserDto } from "@gym/contracts";

export interface Session {
  user: AuthUserDto | null;
  isAuthenticated: boolean;
}

export const authStub = {
  async getSession(): Promise<Session> {
    return {
      user: {
        id: "staff_02",
        gymId: "gym_cairo_01",
        name: "كابتن إسلام زكي (مدرب)",
        email: "coach.islam@powercore.gym",
        role: "COACH",
      },
      isAuthenticated: true,
    };
  },
};

