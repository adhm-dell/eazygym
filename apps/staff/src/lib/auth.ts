import type { AuthUserDto } from "@gym/contracts";

export interface Session {
  user: AuthUserDto | null;
  isAuthenticated: boolean;
}

export const authStub = {
  async getSession(): Promise<Session> {
    return {
      user: {
        id: "staff_01",
        gymId: "gym_cairo_01",
        name: "سلمى أحمد (استقبال)",
        email: "reception@powercore.gym",
        role: "RECEPTION",
      },
      isAuthenticated: true,
    };
  },
};

