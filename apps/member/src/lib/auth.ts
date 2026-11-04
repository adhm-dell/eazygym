export interface MemberSession {
  memberId: string | null;
  isAuthenticated: boolean;
}

export const authStub = {
  async getSession(): Promise<MemberSession> {
    return {
      memberId: "mem_01",
      isAuthenticated: true,
    };
  },
};

