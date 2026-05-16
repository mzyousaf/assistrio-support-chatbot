import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  getBackendApiBase,
  mayHaveStaffSessionCookie,
  fetchAdminMe,
  parseAdminMeResponse,
} from "@/lib/adminSessionVerify";

const ADMIN_LOGIN = "/admin/login";
const ADMIN_HOME = "/admin/dashboard";

function isAdminLoginPath(pathname: string): boolean {
  return pathname === ADMIN_LOGIN || pathname.startsWith(`${ADMIN_LOGIN}/`);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const cookieHeader = request.headers.get("cookie");
  const apiBase = getBackendApiBase();

  // Misconfigured: cannot verify against Nest — fall through (client + server layouts still apply).
  if (!apiBase) {
    return NextResponse.next();
  }

  let staffUser = false;
  if (mayHaveStaffSessionCookie(cookieHeader)) {
    try {
      const res = await fetchAdminMe(cookieHeader);
      staffUser = (await parseAdminMeResponse(res)) != null;
    } catch {
      staffUser = false;
    }
  }

  if (isAdminLoginPath(pathname)) {
    if (staffUser) {
      return NextResponse.redirect(new URL(ADMIN_HOME, request.url));
    }
    return NextResponse.next();
  }

  if (!staffUser) {
    const loginUrl = new URL(ADMIN_LOGIN, request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/admin" || pathname === "/super-admin") {
    return NextResponse.redirect(new URL(ADMIN_HOME, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/:path*", "/super-admin", "/super-admin/:path*"],
};
