import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const refreshToken = request.cookies.get("refresh_token")?.value;
  const token = request.cookies.get("token")?.value;
  const hasAuth = Boolean(refreshToken || token);
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  // If not logged in and not on login page, redirect to /login
  if (!hasAuth && !isLoginRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If already logged in and visiting login page, redirect to /
  if (hasAuth && isLoginRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

