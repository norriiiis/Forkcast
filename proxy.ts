import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Next.js 16 renamed Middleware → Proxy. Per Next's guidance, this does only an
// *optimistic* redirect (cookie presence); the authoritative auth + entitlement
// checks live in the pages/route handlers themselves.
const PROTECTED = ["/account", "/app", "/history", "/report"];

export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isProtected = PROTECTED.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (isProtected) {
    const hasSession =
      request.cookies.has("authjs.session-token") ||
      request.cookies.has("__Secure-authjs.session-token");
    if (!hasSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      url.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(url);
    }
  }
  const response = NextResponse.next();

  // Capture a referral code from ?ref=… into a cookie, read at sign-up.
  const ref = searchParams.get("ref");
  if (ref) {
    response.cookies.set("fc_ref", ref.slice(0, 40), { maxAge: 60 * 60 * 24 * 30, path: "/" });
  }
  return response;
}

export const config = {
  matcher: ["/", "/account/:path*", "/app/:path*", "/history/:path*", "/report/:path*"],
};
