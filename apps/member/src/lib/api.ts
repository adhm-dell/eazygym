const MEMBER_TOKEN_KEY = "eazygym_member_token";
const MEMBER_DATA_KEY = "eazygym_member_data";
const MEMBER_OFFLINE_QR_KEY = "eazygym_member_offline_qr";
const COOKIE_NAME = "gym_member_token";

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
    const local = localStorage.getItem(MEMBER_TOKEN_KEY);
    if (local) return local;

    // Fallback to cookie
    const match = document.cookie.match(
      new RegExp(`(^|;\\s*)(${COOKIE_NAME})=([^;]*)`),
    );
    if (match && match[3]) {
      return decodeURIComponent(match[3]);
    }
  }
  return null;
}

export function setStoredToken(token: string, member?: any) {
  if (typeof window !== "undefined") {
    localStorage.setItem(MEMBER_TOKEN_KEY, token);
    if (member) {
      localStorage.setItem(MEMBER_DATA_KEY, JSON.stringify(member));
    }
    // Set cookie for Next.js middleware guard (7 days)
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
  }
}

export function clearStoredAuth() {
  if (typeof window !== "undefined") {
    localStorage.removeItem(MEMBER_TOKEN_KEY);
    localStorage.removeItem(MEMBER_DATA_KEY);
    // Clear cookie
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
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

  // No auto-login! Require real authentication.
  if (
    typeof window !== "undefined" &&
    !window.location.pathname.startsWith("/login")
  ) {
    window.location.href = "/login";
  }
  return "";
}

export async function memberRequest<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = await ensureToken();

  const url = path.startsWith("http")
    ? path
    : `/api/v1${path.startsWith("/") ? path : `/${path}`}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    clearStoredAuth();
    if (
      typeof window !== "undefined" &&
      !window.location.pathname.startsWith("/login")
    ) {
      window.location.href = "/login";
    }
    throw new Error("انتهت جلسة تسجيل الدخول، يرجى الدخول مرة أخرى");
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
  getWallet: (memberId: string) =>
    memberRequest<{ balance: number; transactions: any[] }>(
      `/members/${memberId}/wallet`,
    ),
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
      body: JSON.stringify({
        note: note || "فك التجميد بواسطة العضو عبر البوابة",
      }),
    }),
};

export const apiClient = memberApi;
