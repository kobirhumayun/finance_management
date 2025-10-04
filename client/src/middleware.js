// File: src/middleware.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/pricing", "/request-password-reset", "/reset-password"];
const USER_DASHBOARD_ROUTE = "/dashboard";
const ADMIN_DASHBOARD_ROUTE = "/admin/dashboard";

// Determine whether a pathname belongs to the public marketing surface.
function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

// Helper to decide if the current plan is considered free-tier.
function isFreePlan(token) {
  const planCandidate =
    token?.user?.plan?.slug ||
    token?.user?.planSlug ||
    token?.planSlug ||
    (typeof token?.user?.plan === "string" ? token.user.plan : token?.user?.plan?.name);

  return typeof planCandidate === "string" && planCandidate.toLowerCase().includes("free");
}

function getRole(token) {
  return token?.user?.role ?? token?.role ?? null;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/_next") || pathname.startsWith("/static") || pathname.startsWith("/api") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  let token = null;
  try {
    token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  } catch (error) {
    console.error("[middleware] getToken failed", error);
  }

  const isAuthenticated = Boolean(token);
  const role = getRole(token);

  if (isPublicRoute(pathname)) {
    if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
      const redirectUrl = role === "admin" ? ADMIN_DASHBOARD_ROUTE : USER_DASHBOARD_ROUTE;
      return NextResponse.redirect(new URL(redirectUrl, request.url));
    }
    return NextResponse.next();
  }

  if (!isAuthenticated && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL(USER_DASHBOARD_ROUTE, request.url));
  }

  if (pathname.startsWith("/summary") && isFreePlan(token)) {
    return NextResponse.redirect(new URL("/pricing", request.url));
  }

  if (pathname === "/dashboard" && role === "admin") {
    return NextResponse.redirect(new URL(ADMIN_DASHBOARD_ROUTE, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/(.*)"]
};
