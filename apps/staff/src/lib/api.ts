import { mockClient } from "@gym/mock-data";

const TOKEN_KEY = "gym_access_token";
const USER_KEY = "gym_active_user";

let cachedToken: string | null = null;
let loginPromise: Promise<string> | null = null;

export function getStoredToken(): string | null {
  if (typeof window !== "undefined") {
    return localStorage.getItem(TOKEN_KEY) || cachedToken;
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
  }
}

export function clearStoredAuth() {
  cachedToken = null;
  if (typeof window !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
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
    throw new Error(err.message || "فشل تسجيل الدخول");
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
      const res = await loginUser("reception@powercore.gym", "123456");
      return res.accessToken;
    } catch (e) {
      console.warn("Auto-login failed:", e);
      return "";
    } finally {
      loginPromise = null;
    }
  })();

  return loginPromise;
}

async function makeRequest<T>(
  url: string,
  method: string,
  body?: any,
  isRetry = false
): Promise<T> {
  const token = await ensureToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
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
    // Token may have expired, clear and attempt re-login once
    clearStoredAuth();
    return makeRequest<T>(url, method, body, true);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "Request failed");
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
  get: <T>(url: string) => makeRequest<T>(url, "GET"),
  post: <T>(url: string, body?: any) => makeRequest<T>(url, "POST", body),
  patch: <T>(url: string, body?: any) => makeRequest<T>(url, "PATCH", body),
  put: <T>(url: string, body?: any) => makeRequest<T>(url, "PUT", body),
  delete: <T>(url: string) => makeRequest<T>(url, "DELETE"),
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

export const apiClient = Object.assign(mockClient, http);
