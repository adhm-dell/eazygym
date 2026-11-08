import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("gym_coach_token")?.value;
  const isLoginRoute = request.nextUrl.pathname.startsWith("/login");

  // If not logged in and not on login page, redirect to /login
  if (!token && !isLoginRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // If already logged in and visiting login page, redirect to /
  if (token && isLoginRoute) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};

