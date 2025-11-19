// File: src/middleware.js
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const PUBLIC_ROUTES = ["/", "/login", "/register", "/pricing", "/request-password-reset", "/reset-password"];
const USER_DASHBOARD_ROUTE = "/dashboard";
const ADMIN_DASHBOARD_ROUTE = "/admin/dashboard";
const AUTH_COOKIE_NAMES = [
  "next-auth.session-token",
  "__Secure-next-auth.session-token",
  "next-auth.callback-url",
  "__Secure-next-auth.callback-url",
];

function stripAuthCookiesFromHeaders(request) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  const filtered = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => {
      const eqIndex = part.indexOf("=");
      const name = eqIndex === -1 ? part : part.slice(0, eqIndex);
      return !AUTH_COOKIE_NAMES.includes(name);
    });

  const headers = new Headers(request.headers);
  if (filtered.length === 0) {
    headers.delete("cookie");
  } else {
    headers.set("cookie", filtered.join("; "));
  }
  return headers;
}

function clearAuthCookies(response, shouldClear) {
  if (!shouldClear) return response;
  for (const name of AUTH_COOKIE_NAMES) {
    try {
      response.cookies.delete(name);
    } catch {
      // ignore – deleting is best effort inside middleware
    }
  }
  return response;
}

function isDecryptSecretError(error) {
  if (!error) return false;
  if (error.name === "JWTSessionError") return true;
  const message = String(error.message || error);
  return /no matching decryption secret/i.test(message);
}

// Determine whether a pathname belongs to the public marketing surface.
function isPublicRoute(pathname) {
  return PUBLIC_ROUTES.includes(pathname);
}

function getRole(token) {
  return token?.user?.role ?? token?.role ?? null;
}

export async function middleware(request) {
  const { pathname } = request.nextUrl;
  const isAuthApiRoute = pathname.startsWith("/api/auth");

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico" ||
    (pathname.startsWith("/api") && !isAuthApiRoute)
  ) {
    return NextResponse.next();
  }

  let token = null;
  let tokenError = null;
  try {
    token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET });
  } catch (error) {
    tokenError = error;
    console.error("[middleware] getToken failed", error);
  }

  const shouldStripAuthCookies = isDecryptSecretError(tokenError) &&
    AUTH_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)));
  const requestHeaders = shouldStripAuthCookies ? stripAuthCookiesFromHeaders(request) : null;

  const nextOptions = requestHeaders ? { request: { headers: requestHeaders } } : undefined;

  const forward = () => clearAuthCookies(NextResponse.next(nextOptions), shouldStripAuthCookies);
  const redirect = (url) => clearAuthCookies(NextResponse.redirect(new URL(url, request.url)), shouldStripAuthCookies);

  const isAuthenticated = Boolean(token);
  const role = getRole(token);

  if (isAuthApiRoute) {
    // Let Auth.js handle API routes, but ensure bad cookies are stripped when necessary.
    return forward();
  }

  if (isPublicRoute(pathname)) {
    if (isAuthenticated && (pathname === "/login" || pathname === "/register")) {
      const redirectUrl = role === "admin" ? ADMIN_DASHBOARD_ROUTE : USER_DASHBOARD_ROUTE;
      return redirect(redirectUrl);
    }
    return forward();
  }

  if (!isAuthenticated && (pathname.startsWith("/dashboard") || pathname.startsWith("/admin"))) {
    return redirect("/login");
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return redirect(USER_DASHBOARD_ROUTE);
  }

  if (pathname === "/dashboard" && role === "admin") {
    return redirect(ADMIN_DASHBOARD_ROUTE);
  }

  return forward();
}

export const config = {
  matcher: ["/(.*)"]
};
