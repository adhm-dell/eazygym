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

// In-memory short-lived access token as per B00_BACKEND_RULES.md
let memoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getStoredToken(): string | null {
  return memoryAccessToken;
}

export function setStoredToken(token: string, member?: any) {
  memoryAccessToken = token;
  if (typeof window !== "undefined" && member) {
    try {
      localStorage.setItem(MEMBER_DATA_KEY, JSON.stringify(member));
    } catch {
      // ignore
    }
  }
}

export function clearStoredAuth() {
  memoryAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(MEMBER_DATA_KEY);
    fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
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
    try {
      localStorage.setItem(MEMBER_OFFLINE_QR_KEY, JSON.stringify(data));
    } catch {
      // ignore
    }
  }
}

export async function loginMember(phone: string, password: string) {
  const res = await fetch("/api/v1/auth/member/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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
    credentials: "include",
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

/**
 * Silently refresh short-lived access token using httpOnly refresh cookie.
 */
export async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const res = await fetch("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        memoryAccessToken = null;
        return null;
      }

      const json = await res.json();
      const token = json.accessToken || json.data?.accessToken;
      if (token) {
        memoryAccessToken = token;
        return token;
      }
      return null;
    } catch {
      memoryAccessToken = null;
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

async function ensureToken(): Promise<string> {
  if (memoryAccessToken) return memoryAccessToken;

  const refreshed = await refreshAccessToken();
  if (refreshed) return refreshed;

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
  isRetry = false
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

  const res = await fetch(url, {
    ...options,
    credentials: "include",
    headers,
  });

  // Handle automatic refresh on 401
  if (res.status === 401) {
    if (!isRetry) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return memberRequest<T>(path, options, true);
      }
    }

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
    const error: any = new Error(err.message || `Request failed: ${res.status}`);
    error.statusCode = res.status;
    error.code = err.code || err.message;
    error.response = err;
    throw error;
  }

  const json = await res.json();
  return (json.data !== undefined ? json.data : json) as T;
}

export const memberApi = {
  getMe: () => memberRequest<any>("/auth/me"),
  getSubscriptions: () => memberRequest<any[]>("/subscriptions"),
  getInvoices: () => memberRequest<any[]>("/invoices"),
  getNotifications: () => memberRequest<{ items: any[]; unreadCount: number }>("/notifications"),
  markNotificationRead: (id: string) => memberRequest(`/notifications/${id}/read`, { method: "POST" }),
  markAllNotificationsRead: () => memberRequest("/notifications/read-all", { method: "POST" }),
  getWallet: (memberId: string) =>
    memberRequest<{ balance: number; transactions: any[] }>(
      `/members/${memberId}/wallet`,
    ),
  getTodayClasses: () => memberRequest<any[]>("/classes/today"),
  getClassSchedules: () => memberRequest<any[]>("/class-schedules"),
  bookClass: (scheduleId: string) =>
    memberRequest(`/class-schedules/${scheduleId}/book`, { method: "POST" }),
  cancelClassBooking: (scheduleId: string) =>
    memberRequest(`/class-schedules/${scheduleId}/cancel-booking`, { method: "POST" }),

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
