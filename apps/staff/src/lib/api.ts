const USER_KEY = "gym_active_user";

// In-memory short-lived access token as per B00_BACKEND_RULES.md
let memoryAccessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export function getStoredToken(): string | null {
  return memoryAccessToken;
}

export function setStoredToken(token: string, user?: any) {
  memoryAccessToken = token;
  if (typeof window !== "undefined" && user) {
    try {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
      // ignore
    }
  }
}

export function getStoredUser(): any | null {
  if (typeof window !== "undefined") {
    const raw = localStorage.getItem(USER_KEY);
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

export function clearStoredAuth() {
  memoryAccessToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(USER_KEY);
    fetch("/api/v1/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {});
  }
}

export async function loginUser(email: string, password: string) {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
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

/**
 * Silently refresh the short-lived access token using httpOnly refresh cookie.
 * Deduplicates concurrent refresh requests using refreshPromise.
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

  // Attempt silent refresh via httpOnly refresh cookie
  const refreshed = await refreshAccessToken();
  if (refreshed) return refreshed;

  // No active session -> redirect to /login
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
    credentials: "include",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Handle automatic refresh on 401
  if (res.status === 401) {
    if (!isRetry) {
      const refreshedToken = await refreshAccessToken();
      if (refreshedToken) {
        return makeRequest<T>(url, method, body, true, extraHeaders);
      }
    }

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
    credentials: "include",
    headers,
  });
}

export const apiClient = http;
