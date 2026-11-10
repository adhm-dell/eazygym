import type { AuthUserDto } from "@gym/contracts";

export interface Session {
  user: AuthUserDto | null;
  isAuthenticated: boolean;
}
