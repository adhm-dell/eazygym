const MEMBER_TOKEN_KEY = "eazygym_member_token";
const MEMBER_DATA_KEY = "eazygym_member_data";
const MEMBER_OFFLINE_QR_KEY = "eazygym_member_offline_qr";

export interface StoredOfflineMember {
  id: string;
  name: string;
  code: string;
  phone: string;
  status: "ACTIVE" | "FROZEN" | "EXPIRED" | "SUSPENDED_UNPAID";
  statusTextAr: string;
  daysLeft: number;
  primaryPlanName: string;
  walletBalance: number;
  lastUpdated: string;
}

export function getStoredToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(MEMBER_TOKEN_KEY);
  }
  return null;
}

export function setStoredToken(token: string, member?: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem(MEMBER_TOKEN_KEY, token);
    if (member) {
      localStorage.setItem(MEMBER_DATA_KEY, JSON.stringify(member));
    }
  }
}

export function clearStoredAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(MEMBER_TOKEN_KEY);
    localStorage.removeItem(MEMBER_DATA_KEY);
  }
}

export function getOfflineMember(): StoredOfflineMember | null {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(MEMBER_OFFLINE_QR_KEY);
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function saveOfflineMember(data: StoredOfflineMember) {
  if (typeof window !== "undefined") {
    localStorage.setItem(MEMBER_OFFLINE_QR_KEY, JSON.stringify(data));
  }
}

let loginPromise: Promise<string> | null = null;

export async function loginMember(phone: string, password: string = "123456") {
  const res = await fetch("/api/v1/auth/member/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "فشل تسجيل دخول العضو");
  }

  const json = await res.json();
  const data = json.data || json;
  setStoredToken(data.accessToken, data.member);
  return data;
}

export async function switchMember(memberPhone: string) {
  const res = await fetch("/api/v1/auth/switch", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ memberPhone }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "فشل التبديل لحساب العضو");
  }

  const json = await res.json();
  const data = json.data || json;
  setStoredToken(data.accessToken, data.user);
  return data;
}

async function ensureToken(): Promise<string> {
  const existing = getStoredToken();
  if (existing) return existing;

  if (loginPromise) return loginPromise;

  loginPromise = (async () => {
    try {
      // Default to Mohamed Ahmed (100245)
      const res = await switchMember("01011122233");
      return res.accessToken;
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
}

export async function memberRequest<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = await ensureToken();

  const url = path.startsWith("http") ? path : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${token}`,
  };

  let res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearStoredAuth();
    token = await ensureToken();
    headers.Authorization = `Bearer ${token}`;
    res = await fetch(url, { ...options, headers });
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Request failed: ${res.status}`);
  }

  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export const memberApi = {
  getMe: () => memberRequest<any>("/auth/me"),
  getSubscriptions: () => memberRequest<any[]>("/subscriptions"),
  getWallet: (memberId: string) => memberRequest<{ balance: number; transactions: any[] }>(`/members/${memberId}/wallet`),
  getTodayClasses: () => memberRequest<any[]>("/classes/today"),
  getClassSchedules: () => memberRequest<any[]>("/class-schedules"),

  freezeSubscription: (subscriptionId: string, days: number, reason: string) =>
    memberRequest(`/subscriptions/${subscriptionId}/freeze`, {
      method: "POST",
      body: JSON.stringify({ days, reason }),
    }),

  unfreezeSubscription: (subscriptionId: string, note?: string) =>
    memberRequest(`/subscriptions/${subscriptionId}/unfreeze`, {
      method: "POST",
      body: JSON.stringify({ note: note || "فك التجميد بواسطة العضو عبر البوابة" }),
    }),
};

export const apiClient = memberApi;
