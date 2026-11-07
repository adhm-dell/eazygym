import { mockClient } from "@gym/mock-data";

const TOKEN_KEY = "coach_access_token";
const USER_KEY = "coach_active_user";

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

export async function loginCoach(email: string = "coach.ahmed@powercore.gym", password: string = "123456") {
  const res = await fetch("/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || "فشل تسجيل دخول المدرب");
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
      const res = await loginCoach();
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

export const http = {
  get: <T>(url: string) => makeRequest<T>(url, "GET"),
  post: <T>(url: string, body?: any) => makeRequest<T>(url, "POST", body),
  patch: <T>(url: string, body?: any) => makeRequest<T>(url, "PATCH", body),
  put: <T>(url: string, body?: any) => makeRequest<T>(url, "PUT", body),
  delete: <T>(url: string) => makeRequest<T>(url, "DELETE"),
};

export const apiClient = Object.assign(mockClient, http);
