import { getStoredToken, getOfflineMember } from "./api";

export interface MemberSession {
  memberId: string | null;
  isAuthenticated: boolean;
  name?: string;
  code?: string;
}

export const authStub = {
  async getSession(): Promise<MemberSession> {
    const token = getStoredToken();
    const offline = getOfflineMember();
    return {
      memberId: offline?.id || (token ? "current" : null),
      isAuthenticated: Boolean(token || offline),
      name: offline?.name,
      code: offline?.code,
    };
  },
};
