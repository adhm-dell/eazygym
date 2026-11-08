const TOKEN_KEY = "gym_access_token";
const USER_KEY = "gym_active_user";
const COOKIE_NAME = "gym_staff_token";

let cachedToken: string | null = null;

export function getStoredToken(): string | null {
  if (typeof window !== "undefined") {
    const local = localStorage.getItem(TOKEN_KEY);
    if (local) return local;

    // Check cookie fallback
    const match = document.cookie.match(new RegExp(`(^|;\\s*)(${COOKIE_NAME})=([^;]*)`));
    if (match && match[3]) {
      return decodeURIComponent(match[3]);
    }
  }
  return cachedToken;
}

export function setStoredToken(token: string, user?: any) {
  cachedToken = token;
  if (typeof window !== "undefined") {
    localStorage.setItem(TOKEN_KEY, token);
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
    // Set cookie for Next.js middleware guard (7 days)
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`;
  }
}

export function clearStoredAuth() {
  cachedToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    // Clear cookie
    document.cookie = `${COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
  }
}

export async function loginUser(email: string, password: string = "123456") {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const error: any = new Error(err.message || "فشل تسجيل الدخول");
    error.statusCode = res.status;
    error.code = err.code;
    throw error;
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
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login";
  }
  return "";
}

async function makeRequest<T>(
  url: string,
  method: string,
  body?: any,
  isRetry = false,
  extraHeaders?: Record<string, string>
): Promise<T> {
  const token = await ensureToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...extraHeaders,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`/api/v1${url}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 401 && !isRetry) {
    // Token may have expired, clear auth and redirect to login
    clearStoredAuth();
    if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
      window.location.href = "/login";
    }
    throw new Error("الجلسة منتهية، يرجى تسجيل الدخول مجدداً");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const error: any = new Error(err.message || "Request failed");
    error.statusCode = res.status;
    error.code = err.code;
    error.response = err;
    throw error;
  }

  const json = await res.json();
  if (json && typeof json === "object" && "data" in json) {
    return json.data as T;
  }
  return json as T;
}

/**
 * Real HTTP API Client for Staff Portal calling /api/v1 (proxied to NestJS on port 4000).
 */
export const http = {
  get: <T>(url: string, extraHeaders?: Record<string, string>) =>
    makeRequest<T>(url, "GET", undefined, false, extraHeaders),
  post: <T>(url: string, body?: any, extraHeaders?: Record<string, string>) =>
    makeRequest<T>(url, "POST", body, false, extraHeaders),
  patch: <T>(url: string, body?: any, extraHeaders?: Record<string, string>) =>
    makeRequest<T>(url, "PATCH", body, false, extraHeaders),
  put: <T>(url: string, body?: any, extraHeaders?: Record<string, string>) =>
    makeRequest<T>(url, "PUT", body, false, extraHeaders),
  delete: <T>(url: string, extraHeaders?: Record<string, string>) =>
    makeRequest<T>(url, "DELETE", undefined, false, extraHeaders),
};

export async function apiFetch(url: string, init?: RequestInit): Promise<Response> {
  const token = await ensureToken();
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && init?.body) {
    headers.set("Content-Type", "application/json");
  }
  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const endpoint = url.startsWith("/api/v1") ? url : `/api/v1${url.startsWith("/") ? url : `/${url}`}`;
  return fetch(endpoint, {
    ...init,
    headers,
  });
}

export const apiClient = http;
